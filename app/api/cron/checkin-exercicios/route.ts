import { NextResponse } from "next/server";
import { rodarCheckinExercicios } from "@/lib/exercicios-checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET/POST /api/cron/checkin-exercicios (Bearer CRON_SECRET) — roda o check-in semanal dos exercícios (o relógio interno do painel já faz isso a cada 30 min).
async function rodar(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await rodarCheckinExercicios()) });
}
export const GET = rodar;
export const POST = rodar;
