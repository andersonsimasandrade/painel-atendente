// Webhook de pausa/retomada do bot (n8n) — SOMENTE no servidor. Lê o segredo
// do ambiente, então nunca importe em um Client Component.
//
// ENV:
//   PAUSE_WEBHOOK_URL     ex.: https://SEU-N8N.seudominio.com.br/webhook/painel-pausa
//   PAUSE_WEBHOOK_SECRET  segredo compartilhado com o workflow
//
// O workflow recebe { telefone, action, secret } e liga/desliga a pausa do bot
// (silêncio de 24h) para aquele telefone.

export type PausaAction = "pause" | "resume";

/** URL de LEITURA do estado, derivada da de escrita trocando o último
 *  segmento. Evita mais uma variável de ambiente pra configurar errado. */
function urlEstado(): string | null {
  const custom = process.env.PAUSE_STATE_WEBHOOK_URL;
  if (custom) return custom;
  const base = process.env.PAUSE_WEBHOOK_URL;
  if (!base) return null;
  return base.replace(/\/[^/]*$/, "/painel-pausa-estado");
}

/**
 * O bot está pausado nesta conversa?
 *
 * A pausa mora no Redis, escrita pelo n8n — o painel não tem acesso direto,
 * então lê por um webhook só de leitura. Antes disto o selo "bot ativo" era
 * estado local otimista: abria sempre dizendo ativo, mesmo com o consultor
 * tendo assumido a conversa dezessete vezes.
 *
 * `null` = não deu pra saber. Quem chama decide o que mostrar; inventar
 * "ativo" num erro de rede é justamente o que a gente está consertando.
 */
export async function lerPausaWebhook(
  telefone: string,
): Promise<{ pausado: boolean | null; error?: string }> {
  const url = urlEstado();
  const secret = process.env.PAUSE_WEBHOOK_SECRET ?? "";
  if (!url) return { pausado: null, error: "Webhook de pausa não configurado." };

  try {
    const alvo = `${url}?secret=${encodeURIComponent(secret)}&telefone=${encodeURIComponent(telefone)}`;
    const res = await fetch(alvo, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { pausado: null, error: `Webhook respondeu ${res.status}.` };
    const j = (await res.json().catch(() => ({}))) as { pausado?: unknown; erro?: string };
    if (j.erro) return { pausado: null, error: j.erro };
    // A chave é um CONTADOR com validade de 24h: existir já significa pausado.
    // Some sozinha quando a pausa expira, então não há estado velho pra limpar.
    const bruto = j.pausado;
    return { pausado: bruto !== null && bruto !== undefined && String(bruto) !== "" };
  } catch (e) {
    return {
      pausado: null,
      error: e instanceof Error ? e.message : "Falha ao ler o estado do bot.",
    };
  }
}

/**
 * Chama o webhook de pausa. `pause` = painel assumiu (bot em silêncio);
 * `resume` = devolve ao bot (limpa a pausa). Devolve {ok} + erro legível.
 * Ausência de PAUSE_WEBHOOK_URL não derruba nada: retorna ok:false com erro.
 */
export async function chamarPausaWebhook(
  telefone: string,
  action: PausaAction,
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.PAUSE_WEBHOOK_URL;
  const secret = process.env.PAUSE_WEBHOOK_SECRET ?? "";

  if (!url) {
    return {
      ok: false,
      error: "Webhook de pausa não configurado (defina PAUSE_WEBHOOK_URL).",
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone, action, secret }),
      cache: "no-store",
      // Sem timeout, um n8n pendurado segurava o cron além do maxDuration e
      // matava mensagens agendadas entre o claim e o envio.
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Webhook de pausa respondeu ${res.status}.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao contatar o webhook de pausa.",
    };
  }
}
