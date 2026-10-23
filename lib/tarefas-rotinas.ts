import { getClient, getPainelConfig } from "@/lib/db";
import { dentroDoExpediente } from "@/lib/ig-robo";
import { dentroDaJanelaDeEnvio } from "@/lib/janela-envio";
import { diaSP, enviarAoDono, executarVencidas, gerarSugestoes, montarResumoDoDia, spParaUTC } from "@/lib/tarefas";

// Rotinas das tarefas, chamadas pelo relógio interno do painel (lib/tarefas-relogio.ts) ou pela rota /api/cron/tarefas.

async function diario(rota: string, resumo: Record<string, unknown>) {
  try {
    await getClient().from("cron_log").insert({ rota, resumo });
  } catch (e) {
    console.error(`[tarefas] cron_log ${rota}:`, e);
  }
}

/** Plano do dia: cria as sugestões, confere o contexto de cada tarefa e manda o resumo para o WhatsApp do Anderson. Uma vez por dia. */
export async function rodarTarefasDoDia(opts: { forcar?: boolean } = {}): Promise<Record<string, unknown>> {
  const sb = getClient();
  const inicioDoDia = spParaUTC(diaSP(new Date()), "00:00").toISOString();
  if (!opts.forcar) {
    const ja = await sb.from("cron_log").select("id").eq("rota", "tarefas-resumo").gte("criado_em", inicioDoDia).limit(1);
    if (ja.data?.length) return { ok: true, motivo: "já rodou hoje" };
  }
  const sugestoes = await gerarSugestoes();
  const { texto, total } = await montarResumoDoDia();
  const enviados = await enviarAoDono(texto);
  const r = { ok: true, sugestoes, tarefasNoPlano: total, mensagensEnviadas: enviados };
  await diario("tarefas-resumo", r);
  return r;
}

/** Envia as tarefas aprovadas que venceram (só no expediente), conferindo o contexto antes de cada uma. */
export async function rodarExecutorDeTarefas(): Promise<Record<string, unknown>> {
  const cfg = await getPainelConfig();
  if (!dentroDaJanelaDeEnvio(new Date()) || !dentroDoExpediente(cfg.horario_bot, new Date())) return { ok: true, motivo: "fora do expediente" };
  const r = await executarVencidas();
  if (r.enviadas || r.devolvidas || r.falhas) await diario("tarefas-executar", r as unknown as Record<string, unknown>);
  return { ok: true, ...r };
}
