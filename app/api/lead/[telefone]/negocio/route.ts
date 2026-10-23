import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { novoNegocio, perderNegocio } from "@/lib/negocios";
import type { TipoNegocio } from "@/lib/negocios-tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lead/[telefone]/negocio
//   { acao: "perder", motivo, observacao? }       → negociação PERDIDA: sai do funil e fica no histórico
//   { acao: "nova", tipo: "recompra"|"reativacao", observacao? } → abre OUTRA negociação (a pessoa voltou ou é recompra)
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const acao = String(b.acao ?? "");
  const obs = typeof b.observacao === "string" ? b.observacao : undefined;

  if (acao === "perder") {
    const r = await perderNegocio(telefone, String(b.motivo ?? ""), obs);
    return NextResponse.json(r, { status: r.ok ? 200 : r.error === "Lead não encontrado." ? 404 : 500 });
  }
  if (acao === "nova") {
    const r = await novoNegocio(telefone, String(b.tipo ?? "reativacao") as TipoNegocio, obs);
    return NextResponse.json(r, { status: r.ok ? 200 : r.error.startsWith("Já existe") ? 409 : r.error === "Lead não encontrado." ? 404 : 500 });
  }
  return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
}
