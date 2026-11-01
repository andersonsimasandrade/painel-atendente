import { NextResponse } from "next/server";
import { horariosLivres } from "@/lib/marcar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cron/robo/horarios?dias=8 (Bearer CRON_SECRET) — horários livres para o robô oferecer ao paciente.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const dias = Number(new URL(req.url).searchParams.get("dias")) || 8;
  const r = await horariosLivres(dias);
  return NextResponse.json({ ok: r.ok, texto: r.texto, erro: r.erro });
}
