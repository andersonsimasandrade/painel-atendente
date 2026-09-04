// Lógica PURA do lembrete pré-reunião (sem I/O) — testável isoladamente.
// O lembrete dispara ~3h antes: a rota roda de hora em hora e pega tudo que
// está a ≤ 3h30 da reunião e ainda não foi lembrado (idempotência na coluna
// lembrete_enviado_em garante 1 envio). Nunca dispara depois da hora.

const JANELA_MS = 3.5 * 3600 * 1000; // 3h30 — cobre o gap do cron horário sem atrasar

const p2 = (n: number) => String(n).padStart(2, "0");

// HH:MM no fuso de São Paulo (offset fixo -03:00; BR sem horário de verão desde 2019).
export function horaSP(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

// Dos agendamentos ativos (já filtrados: status agendado/confirmado e sem lembrete),
// devolve os que estão dentro da janela: agora < data_hora ≤ agora + 3h30.
export function selecionarLembretes<T extends { data_hora: string }>(
  rows: T[],
  agora: Date = new Date(),
): T[] {
  const now = agora.getTime();
  const limite = now + JANELA_MS;
  return rows.filter((r) => {
    const t = new Date(r.data_hora).getTime();
    return Number.isFinite(t) && t > now && t <= limite;
  });
}

// Mensagem "como se fosse o vendedor", pra aumentar a taxa de presença.
export function mensagemLembrete(
  vendedorNome: string,
  nomeLead: string | null,
  iso: string,
): string {
  const primeiro = nomeLead ? nomeLead.trim().split(/\s+/)[0] : "";
  const hora = horaSP(iso);
  return (
    `*${vendedorNome}:*\nOi${primeiro ? " " + primeiro : ""}! Passando pra confirmar nossa reunião de hoje às *${hora}* 😊 ` +
    `Tá tudo certo por aí? Qualquer coisa é só me chamar. Até já! 👊`
  );
}
