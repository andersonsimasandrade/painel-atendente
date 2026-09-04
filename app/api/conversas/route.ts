import { NextResponse } from "next/server";
import { getConversas } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { escopoDaLista } from "@/lib/escopo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/conversas[?consultor=] — lista do inbox, usada pelo poll de ~7s.
//
// PRECISA do mesmo escopo da página. Sem isso, o poll substituía — poucos
// segundos depois de a tela abrir — a lista escopada vinda do servidor pela
// lista GLOBAL, vazando nome, telefone e a PRÉVIA da última mensagem de leads
// de outro consultor (e desfazendo o filtro ?consultor= do admin).
export async function GET(req: Request) {
  const sess = await getSessao();
  if (!sess) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const consultor = new URL(req.url).searchParams.get("consultor") ?? undefined;
  const result = await getConversas(escopoDaLista(sess, consultor));
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
