import { NextResponse } from "next/server";
import { barrarSemSessao, conversaIG } from "@/lib/ig-dados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/instagram/contatos/[id] — contato + mensagens da conversa.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  const id = decodeURIComponent(params.id ?? "").replace(/\D/g, "");
  if (!id) return NextResponse.json({ ok: false, error: "Id inválido." }, { status: 400 });
  const r = await conversaIG(id);
  if (!r.contato) return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, ...r });
}
