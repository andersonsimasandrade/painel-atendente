import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { getVendedorBySlug, listarHistorico } from "@/lib/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agenda/[id]/historico — o que aconteceu com esta consulta (marcada, remarcada, cancelada, realizada, faltou).
// Só logado. Consultor (papel vendedor) só vê a própria agenda.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const id = String(params.id ?? "").trim();
  if (sess.papel === "vendedor") {
    const v = sess.vslug ? await getVendedorBySlug(sess.vslug) : null;
    const r = await getClient().from("agendamentos").select("vendedor_id").eq("id", id).limit(1);
    if (!v || (r.data?.[0] as { vendedor_id?: string } | undefined)?.vendedor_id !== v.id) return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, historico: await listarHistorico(id) });
}
