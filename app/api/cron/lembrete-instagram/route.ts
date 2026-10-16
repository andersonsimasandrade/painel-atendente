import { NextResponse } from "next/server";
import { rodarLembreteInstagram } from "@/lib/ig-lembrete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lembrete único de 4h do Instagram (regras em lib/ig-lembrete.ts).
// Normalmente roda sozinho pelo relógio interno do painel; esta rota existe para chamada manual/n8n (Bearer CRON_SECRET).

async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const r = await rodarLembreteInstagram();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}

export const POST = handler;
export const GET = handler;
