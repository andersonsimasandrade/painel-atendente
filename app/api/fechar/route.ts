import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { setLeadFechado } from "@/lib/db";
import { parseValorBR } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { telefone, valor, desfazer? }
// Protegido pelo mesmo cookie de sessão do middleware (verifyToken). Sem
// sessão válida => 401. Usa o Supabase server (service_role) via lib/db.
export async function POST(req: Request) {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!(await verifyToken(token))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  let telefone = "";
  let valor: number | null = null;
  let desfazer = false;

  try {
    const body = (await req.json()) as {
      telefone?: string;
      valor?: unknown;
      desfazer?: unknown;
    };
    telefone = String(body.telefone ?? "").trim();
    desfazer = body.desfazer === true;
    if (!desfazer) {
      const v =
        typeof body.valor === "number" ? body.valor : parseValorBR(String(body.valor ?? ""));
      valor = Number.isFinite(v) ? v : null;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }
  // Escopo (multi-consultor): consultor só fecha negócio de lead DELE.
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!desfazer && (valor == null || valor <= 0)) {
    return NextResponse.json(
      { ok: false, error: "Informe um valor de fechamento válido." },
      { status: 400 },
    );
  }

  const result = await setLeadFechado(telefone, valor, desfazer);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
