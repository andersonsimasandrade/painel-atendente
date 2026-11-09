import { NextResponse } from "next/server";
import { clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";
import { registrarCheckin } from "@/lib/exercicios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/site/exercicios/<codigo>/checkin { dias_feitos, dor, comentario } — o paciente conta como foi (página do plano, sem login).
export async function POST(req: Request, { params }: { params: { codigo: string } }) {
  if (await rateLimited(`site-checkin:${clientIp(req)}`, 20, 3600)) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde um pouco." }, { status: 429 });
  }
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.site_url === "string" && b.site_url.trim()) return NextResponse.json({ ok: true }); // honeypot
  const r = await registrarCheckin(params.codigo, b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
