import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { getClient } from "@/lib/db";
import { credencialYT, responderComentarioYT } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/youtube/responder { id, texto } — o Anderson responde um comentário do canal pelo painel (resposta pública).
export async function POST(req: Request) {
  if (!(await ehAdmin())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const id = String(b.id ?? "").trim();
  const texto = String(b.texto ?? "").trim().slice(0, 1000);
  if (!id || !texto) return NextResponse.json({ ok: false, error: "Escreva a resposta." }, { status: 400 });
  const cred = await credencialYT();
  if (!cred) return NextResponse.json({ ok: false, error: "Canal não conectado." }, { status: 400 });
  const r = await responderComentarioYT(cred, id, texto);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.erro ?? "O YouTube não aceitou a resposta." }, { status: 502 });
  await getClient()
    .from("yt_comentarios")
    .update({ status: "respondido", resposta_id: r.id ?? null, respondido_em: new Date().toISOString(), erro: null })
    .eq("comentario_id", id);
  return NextResponse.json({ ok: true });
}
