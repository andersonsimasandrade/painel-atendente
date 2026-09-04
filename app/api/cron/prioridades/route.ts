import { NextResponse } from "next/server";
import { atualizarAnalises } from "@/lib/prioridades";
import { listarVendedores } from "@/lib/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST/GET /api/cron/prioridades — atualização AUTOMÁTICA das análises (chamada
// por um workflow n8n de hora em hora nos horários comerciais). Bearer CRON_SECRET.
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  // Plano GLOBAL (visão do admin) primeiro — ele também roda a análise por lead,
  // que é compartilhada. Depois um plano por consultor, com os leads dele.
  const global = await atualizarAnalises("");
  const vendedores = await listarVendedores();
  const porConsultor: Record<string, number> = {};
  for (const v of vendedores) {
    const r = await atualizarAnalises(v.slug);
    porConsultor[v.slug] = r.pendentes;
  }
  return NextResponse.json({
    ok: true,
    analisados: global.analisados,
    pendentes: global.pendentes,
    consultores: porConsultor,
  });
}

export const POST = handler;
export const GET = handler;
