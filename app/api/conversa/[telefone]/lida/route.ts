import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { getSessao } from "@/lib/session";
import { setLidaConversa } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/conversa/[telefone]/lida  { lida: boolean }
// lida=true  → silencia o "aguardando" até o lead falar de novo
// lida=false → força o destaque de volta (marcar como não lida)
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

  let lida = true;
  try {
    const b = (await req.json()) as { lida?: unknown };
    lida = b.lida !== false;
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const r = await setLidaConversa(telefone, lida);
  if (!r.ok) {
    return NextResponse.json(r, { status: r.error === "Lead não encontrado." ? 404 : 500 });
  }
  return NextResponse.json({ ok: true, lida });
}
