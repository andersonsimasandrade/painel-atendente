import { NextResponse } from "next/server";
import { enviarMetaPendentes } from "@/lib/conversoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST/GET /api/cron/conversoes (Bearer CRON_SECRET): envia à Meta as conversões pendentes.
// O relógio interno do painel também faz isso a cada 10 minutos.
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json(await enviarMetaPendentes());
}

export const POST = handler;
export const GET = handler;
