import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { getSessao } from "@/lib/session";
import { setEstagioManual } from "@/lib/db";
import { enfileirarSequencia } from "@/lib/funil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lead/[telefone]/estagio  { stage }
// Ajuste MANUAL da etapa do funil pelo operador (registra evento na timeline).
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  if (!(await getSessao())) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  // Escopo (multi-consultor): consultor só age sobre lead DELE. 403 caso contrário.
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }

  let stage = "";
  try {
    const b = (await req.json()) as { stage?: unknown };
    stage = String(b.stage ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const r = await setEstagioManual(telefone, stage);
  if (!r.ok) {
    const status = r.error === "Lead não encontrado." ? 404 : r.error === "Etapa inválida." ? 400 : 500;
    return NextResponse.json(r, { status });
  }

  // Movimento MANUAL dispara a sequência da etapa (se houver) e SEMPRE cancela
  // a régua pendente do movimento anterior. Best-effort: mover nunca falha por
  // causa disso.
  const seq = await enfileirarSequencia(telefone, stage);
  return NextResponse.json({ ok: true, stage, sequencia: seq.enfileiradas });
}
