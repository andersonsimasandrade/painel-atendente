import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { instanciasPermitidas, podeGerenciarInstancia } from "@/lib/escopo";
import { evolutionState } from "@/lib/evolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ordem de gravidade: quanto maior, pior. Usada pra resumir várias instâncias
// num estado só (o pontinho do menu deve acender se QUALQUER número caiu).
const GRAVIDADE: Record<string, number> = {
  open: 0,
  connecting: 1,
  unknown: 2,
  close: 3,
};

// GET /api/evolution/status[?instancia=X]
//  • sem ?instancia → resumo de TODAS as instâncias que a sessão pode ver
//    (state = a pior delas, p/ o pontinho do menu) + a lista detalhada;
//  • com ?instancia → só aquela, se a sessão puder vê-la.
export async function GET(req: Request) {
  const sess = await getSessao();
  if (!sess) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const qual = new URL(req.url).searchParams.get("instancia")?.trim();

  if (qual) {
    if (!(await podeGerenciarInstancia(sess, qual))) {
      return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
    }
    const r = await evolutionState(qual);
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }

  const permitidas = await instanciasPermitidas(sess);
  if (!permitidas.length) {
    return NextResponse.json({ ok: true, state: "unknown", instancias: [] });
  }

  const estados = await Promise.all(
    permitidas.map(async (v) => {
      const r = await evolutionState(v.instancia);
      return {
        slug: v.slug,
        nome: v.nome,
        instancia: v.instancia,
        state: r.ok ? String(r.state ?? "unknown") : "unknown",
        erro: r.ok ? undefined : r.error,
      };
    }),
  );

  // O resumo é o PIOR estado — assim o pontinho não fica verde com um número caído.
  const pior = estados.reduce(
    (acc, e) => ((GRAVIDADE[e.state] ?? 2) > (GRAVIDADE[acc] ?? 2) ? e.state : acc),
    "open",
  );

  return NextResponse.json({ ok: true, state: pior, instancias: estados });
}
