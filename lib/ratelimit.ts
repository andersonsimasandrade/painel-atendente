// Rate limit simples via tabela rate_events (serverless não guarda estado em
// memória). Registra o evento e conta os do bucket na janela. Fail-OPEN em erro
// (não trava usuário legítimo se a tabela falhar).

import { getClient } from "./db";

// failClosed: em erro da tabela, retorna `true` (bloqueia) em vez do padrão
// fail-OPEN. Use nos tetos anti-abuso que protegem o número do WhatsApp (risco
// de ban) — ali um falso 429 é uma falha suave aceitável. Mantenha fail-open no
// teto por IP de agendamento público (senão um soluço do DB vira DoS).
export async function rateLimited(
  bucket: string,
  max: number,
  windowSec: number,
  opts: { failClosed?: boolean } = {},
): Promise<boolean> {
  const onError = opts.failClosed ?? false;
  try {
    const supabase = getClient();
    await supabase.from("rate_events").insert({ bucket });
    const desde = new Date(Date.now() - windowSec * 1000).toISOString();
    const res = await supabase
      .from("rate_events")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .gte("criado_em", desde);
    if (res.error) {
      console.error("[ratelimit]", res.error.message);
      return onError;
    }
    return (res.count ?? 0) > max;
  } catch (e) {
    console.error("[ratelimit] exceção:", e);
    return onError;
  }
}

/**
 * "Já avisei há pouco?" para alertas que devem REPETIR a cada janela (ex.: WhatsApp caído, a cada 30 min).
 * Diferente de rateLimited: só o aviso realmente enviado entra no registro (marcarAviso). Com rateLimited, cada
 * verificação do vigia (a cada 10 min) renovava a janela e o alerta saía UMA vez e nunca mais.
 * Em erro do banco devolve false (melhor avisar de novo do que ficar mudo).
 */
export async function avisouRecentemente(bucket: string, janelaSec: number): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - janelaSec * 1000).toISOString();
    const r = await getClient().from("rate_events").select("id", { count: "exact", head: true }).eq("bucket", bucket).gte("criado_em", desde);
    if (r.error) return false;
    return (r.count ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function marcarAviso(bucket: string): Promise<void> {
  try {
    await getClient().from("rate_events").insert({ bucket });
  } catch {
    /* sem registro, o próximo ciclo avisa de novo: aceitável */
  }
}
