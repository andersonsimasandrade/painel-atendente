import { createHash } from "node:crypto";
import { getClient } from "@/lib/db";
import { destinatariosAlerta } from "@/lib/config";
import { enviarEmail } from "@/lib/email";

// Token do Instagram (login do Instagram): vale 60 dias e precisa ser renovado antes de vencer.
// A primeira cópia vem de INSTAGRAM_ACCESS_TOKEN; cada renovação é guardada na tabela ig_credencial
// (só o servidor lê). Se você trocar INSTAGRAM_ACCESS_TOKEN por um token novo, ele passa a valer na hora
// (a renovação guardada só vale enquanto a variável for a mesma que deu origem a ela).
const GRAPH = "https://graph.instagram.com";
const ID = "painel";
const VALIDADE_CACHE_MS = 5 * 60 * 1000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const doAmbiente = () => (process.env.INSTAGRAM_ACCESS_TOKEN ?? "").trim();

let cache: { token: string; ate: number } | null = null;

/** Token em uso: a renovação guardada (se for da mesma variável de ambiente) ou o da variável. */
export async function tokenIG(): Promise<string> {
  const env = doAmbiente();
  if (!env) return "";
  if (cache && cache.ate > Date.now()) return cache.token;
  let token = env;
  try {
    const { data } = await getClient()
      .from("ig_credencial")
      .select("token, base_hash")
      .eq("id", ID)
      .maybeSingle();
    if (data?.token && data.base_hash === sha(env)) token = data.token;
  } catch {
    /* sem banco: segue com o da variável */
  }
  cache = { token, ate: Date.now() + VALIDADE_CACHE_MS };
  return token;
}

export interface ResultadoRenovacao {
  ok: boolean;
  mensagem: string;
  expiraEm?: string;
}

/** Renova o token (a Meta só aceita com mais de 24 h de vida e antes de vencer). */
export async function renovarTokenIG(): Promise<ResultadoRenovacao> {
  const env = doAmbiente();
  if (!env) return { ok: false, mensagem: "INSTAGRAM_ACCESS_TOKEN ausente" };
  const atual = await tokenIG();
  try {
    const r = await fetch(
      `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(atual)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!r.ok || !j.access_token) {
      return { ok: false, mensagem: (j.error?.message ?? `HTTP ${r.status}`).slice(0, 200) };
    }
    const expira = new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString();
    const { error } = await getClient()
      .from("ig_credencial")
      .upsert({ id: ID, token: j.access_token, base_hash: sha(env), renovado_em: new Date().toISOString(), expira_em: expira });
    if (error) return { ok: false, mensagem: `renovou mas não gravou: ${error.message}` };
    cache = { token: j.access_token, ate: Date.now() + VALIDADE_CACHE_MS };
    return { ok: true, mensagem: "renovado", expiraEm: expira };
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "falha de rede" };
  }
}

/** Quando o token guardado vence (null = ainda não renovado pelo painel). */
async function expiraEm(): Promise<Date | null> {
  try {
    const { data } = await getClient().from("ig_credencial").select("expira_em").eq("id", ID).maybeSingle();
    return data?.expira_em ? new Date(data.expira_em) : null;
  } catch {
    return null;
  }
}

let avisadoEm = 0;
let falhas = 0;

/** Roda todo dia: renova se faltar menos de 40 dias (ou se nunca foi renovado) e avisa por e-mail se falhar. */
export async function manterTokenIG(): Promise<ResultadoRenovacao | null> {
  if (!doAmbiente()) return null;
  const vence = await expiraEm();
  const faltam = vence ? (vence.getTime() - Date.now()) / 86400000 : 0;
  if (vence && faltam > 40) return null;
  const r = await renovarTokenIG();
  if (r.ok) {
    falhas = 0;
    console.log(`[ig-token] renovado; vale até ${r.expiraEm}`);
    return r;
  }
  falhas++;
  console.error("[ig-token] falha ao renovar:", r.mensagem);
  // Avisa no máximo 1 vez por dia, e só depois de 3 falhas seguidas (a Meta recusa token com menos de 24 h) ou quando já está perto de vencer.
  if ((falhas >= 3 || (vence && faltam < 10)) && Date.now() - avisadoEm > 20 * 3600 * 1000) {
    avisadoEm = Date.now();
    for (const d of destinatariosAlerta()) {
      if (!d.email) continue;
      await enviarEmail(
        d.email,
        "Atenção: a chave do Instagram do robô precisa ser renovada",
        `<p>O robô do Instagram não conseguiu renovar a chave de acesso (${r.mensagem}).</p>` +
          `<p>Se ela vencer, o robô para de responder o direct. Gere uma chave nova no painel de desenvolvedores da Meta ` +
          `(app Atendente 24h Fisio → API do Instagram → Gerar token) e cole em INSTAGRAM_ACCESS_TOKEN no EasyPanel.</p>`,
      );
    }
  }
  return r;
}
