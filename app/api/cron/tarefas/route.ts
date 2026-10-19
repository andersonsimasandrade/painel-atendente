import { NextResponse } from "next/server";
import { rodarExecutorDeTarefas, rodarTarefasDoDia } from "@/lib/tarefas-rotinas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/tarefas?acao=resumo|executar  (Bearer CRON_SECRET) — disparo manual das rotinas de tarefas.
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const acao = new URL(req.url).searchParams.get("acao") ?? "";
  if (acao === "resumo") return NextResponse.json(await rodarTarefasDoDia({ forcar: true }));
  if (acao === "executar") return NextResponse.json(await rodarExecutorDeTarefas());
  return NextResponse.json({ ok: false, error: "Use ?acao=resumo ou ?acao=executar." }, { status: 400 });
}
export const POST = handler;
export const GET = handler;
