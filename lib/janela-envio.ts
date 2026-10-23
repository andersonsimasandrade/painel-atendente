// JANELA FIXA para mensagens AUTOMÁTICAS que partem do sistema sem a pessoa ter escrito agora:
// lembrete de 4h, sequência do funil, tarefas aprovadas, lembrete de consulta, lembrete do Instagram.
// Só entre 08:00 e 20:00 (horário de Brasília). De madrugada e à noite, nada é enviado por iniciativa do sistema.
// Vale SEMPRE, independente do "horário do robô" nos Ajustes (que pode estar desligado).
//
// NÃO se aplica a respostas: se a pessoa escreveu, o robô responde normalmente, a qualquer hora, inclusive
// quando a conversa atravessa as 19:50–20:10 (a conversa em andamento não é cortada).
// Funções puras (sem I/O).

const SP_OFFSET_MS = 3 * 3600 * 1000; // Brasil sem horário de verão: UTC-3 fixo
export const JANELA_INICIO_MIN = 8 * 60; // 08:00
export const JANELA_FIM_MIN = 20 * 60; // 20:00

function minutosSP(agora: Date): number {
  const sp = new Date(agora.getTime() - SP_OFFSET_MS);
  return sp.getUTCHours() * 60 + sp.getUTCMinutes();
}

/** Pode o sistema iniciar uma mensagem agora? (08:00 ≤ hora < 20:00, horário de Brasília) */
export function dentroDaJanelaDeEnvio(agora: Date = new Date()): boolean {
  const m = minutosSP(agora);
  return m >= JANELA_INICIO_MIN && m < JANELA_FIM_MIN;
}

/** Próximo 08:00 de Brasília (agora, se já estiver dentro da janela). */
export function proximaAberturaDaJanela(agora: Date = new Date()): Date {
  if (dentroDaJanelaDeEnvio(agora)) return agora;
  const sp = new Date(agora.getTime() - SP_OFFSET_MS);
  const hoje8 = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 8, 0) + SP_OFFSET_MS;
  // antes das 08:00: abre hoje às 08:00; depois das 20:00: abre amanhã às 08:00
  return new Date(hoje8 > agora.getTime() ? hoje8 : hoje8 + 86400000);
}
