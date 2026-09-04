import { NextResponse } from "next/server";
import { atualizarAnalises } from "@/lib/prioridades";
import { getSessao } from "@/lib/session";
import { escopoDaLista } from "@/lib/escopo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/prioridades/atualizar — botão manual (sessão). Analisa os leads que
// mudaram, gera o plano consolidado e cacheia tudo.
export async function POST() {
  const sess = await getSessao();
  if (!sess) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  // Consultor regenera só o PRÓPRIO plano (e nunca recebe o dos outros).
  const escopo = escopoDaLista(sess) ?? "";
  const r = await atualizarAnalises(escopo);
  return NextResponse.json({
    ok: true,
    analisados: r.analisados,
    pendentes: r.pendentes,
    tinha_pendentes: r.pendentes > 0,
    plano: r.plano,
    gerado_em: new Date().toISOString(),
  });
}
