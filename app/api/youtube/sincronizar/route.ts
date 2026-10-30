import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { rodarComentariosYT } from "@/lib/yt-robo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/youtube/sincronizar — lê os comentários agora (sem esperar os 15 minutos) e responde o que for devido.
// Só funciona entre 8h e 20h e com o canal conectado.
export async function POST() {
  if (!(await ehAdmin())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await rodarComentariosYT()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "erro" }, { status: 500 });
  }
}
