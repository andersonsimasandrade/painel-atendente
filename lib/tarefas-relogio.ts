import { rodarExecutorDeTarefas, rodarTarefasDoDia } from "@/lib/tarefas-rotinas";

// Relógio das tarefas: a cada 5 minutos
//   • de segunda a sexta, entre 7h30 e 10h, monta o plano do dia (uma vez por dia) e manda o resumo ao Anderson;
//   • envia as tarefas aprovadas que já venceram (só no expediente).
const g = globalThis as unknown as { __tarefasRelogio?: boolean };

export function iniciarRelogioDeTarefas() {
  if (g.__tarefasRelogio) return;
  g.__tarefasRelogio = true;
  let rodando = false;
  const volta = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const sp = new Date(Date.now() - 3 * 3600 * 1000);
      const dia = sp.getUTCDay();
      const minutos = sp.getUTCHours() * 60 + sp.getUTCMinutes();
      if (dia >= 1 && dia <= 5 && minutos >= 7 * 60 + 30 && minutos < 10 * 60) await rodarTarefasDoDia();
      await rodarExecutorDeTarefas();
    } catch (e) {
      console.error("[tarefas-relogio]", e instanceof Error ? e.message : e);
    } finally {
      rodando = false;
    }
  };
  setTimeout(volta, 3 * 60 * 1000);
  setInterval(volta, 5 * 60 * 1000);
}
