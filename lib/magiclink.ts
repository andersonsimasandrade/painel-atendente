// Magic link por e-mail (login sem senha, restrito a uma allowlist).
// Server-only (roda em route handlers Node): usa a service_role via getClient e
// o crypto do Node. Nunca importar num Client Component.

import crypto from "crypto";
import { getClient } from "./db";
import { empresaNome } from "./config";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min

export function normalizarEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** true se o e-mail está na tabela de autorizados e ativo. */
export async function emailAutorizado(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const supabase = getClient();
    const res = await supabase
      .from("dashboard_usuarios")
      .select("email")
      .eq("email", email)
      .eq("ativo", true)
      .limit(1);
    if (res.error) {
      console.error("[magiclink] emailAutorizado:", res.error.message);
      return false;
    }
    return !!(res.data && res.data.length);
  } catch (e) {
    console.error("[magiclink] emailAutorizado exceção:", e);
    return false;
  }
}

/** Papel + vendedor_slug do usuário (p/ montar a sessão). FAIL-CLOSED: em erro
 *  ou linha ausente devolve papel=null (não resolvido) — o chamador NÃO deve
 *  emitir sessão (senão uma falha do banco escalaria vendedor→admin). */
export async function dadosUsuario(
  email: string,
): Promise<{ papel: string | null; vslug: string | null }> {
  try {
    const res = await getClient()
      .from("dashboard_usuarios")
      .select("papel, vendedor_slug")
      .eq("email", email)
      .eq("ativo", true)
      .limit(1);
    if (res.error || !res.data?.length) return { papel: null, vslug: null };
    const r = res.data[0] as { papel: string | null; vendedor_slug: string | null };
    return { papel: r.papel || "admin", vslug: r.vendedor_slug };
  } catch (e) {
    console.error("[magiclink] dadosUsuario:", e);
    return { papel: null, vslug: null };
  }
}

/**
 * Cria um token de uso único (guarda só o hash) e devolve o token cru para o
 * link. Retorna null em falha (o chamador não deve vazar o motivo).
 */
export async function criarMagicToken(email: string, tipo: "login" | "senha" = "login"): Promise<string | null> {
  try {
    const raw = crypto.randomBytes(32).toString("hex");
    const supabase = getClient();
    const res = await supabase.from("magic_tokens").insert({
      token_hash: sha256(raw),
      email,
      tipo,
      expires_at: new Date(Date.now() + (tipo === "senha" ? 30 * 60 * 1000 : TOKEN_TTL_MS)).toISOString(),
    });
    if (res.error) {
      console.error("[magiclink] criarMagicToken:", res.error.message);
      return null;
    }
    return raw;
  } catch (e) {
    console.error("[magiclink] criarMagicToken exceção:", e);
    return null;
  }
}

/**
 * Consome um token: valida hash + não-usado + não-expirado e o marca como usado
 * de forma atômica (update WHERE used_at IS NULL). Revalida a allowlist (caso o
 * acesso tenha sido revogado depois do link ter sido enviado). Retorna o e-mail
 * autenticado, ou null.
 */
export async function consumirMagicToken(raw: string, tipo: "login" | "senha" = "login"): Promise<string | null> {
  if (!raw || raw.length < 32) return null;
  try {
    const supabase = getClient();
    const hash = sha256(raw);
    const sel = await supabase
      .from("magic_tokens")
      .select("id, email, expires_at, used_at")
      .eq("token_hash", hash)
      .eq("tipo", tipo)
      .limit(1);
    if (sel.error || !sel.data || !sel.data.length) return null;
    const row = sel.data[0] as {
      id: string;
      email: string;
      expires_at: string;
      used_at: string | null;
    };
    if (row.used_at) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;

    // Marca usado só se ainda estiver nulo (uma corrida só ganha uma vez).
    const upd = await supabase
      .from("magic_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null)
      .select("id");
    if (upd.error || !upd.data || !upd.data.length) return null;

    // Revalida allowlist no momento do consumo.
    if (!(await emailAutorizado(row.email))) return null;
    return row.email;
  } catch (e) {
    console.error("[magiclink] consumirMagicToken exceção:", e);
    return null;
  }
}

/** Hash da senha própria do usuário (null se ele ainda não criou uma ou se o e-mail não é autorizado) + papel/vendedor. */
export async function usuarioParaSenha(
  email: string,
): Promise<{ hash: string | null; papel: string | null; vslug: string | null } | null> {
  if (!email) return null;
  try {
    const res = await getClient()
      .from("dashboard_usuarios")
      .select("senha_hash, papel, vendedor_slug")
      .eq("email", email)
      .eq("ativo", true)
      .limit(1);
    if (res.error || !res.data?.length) return null;
    const r = res.data[0] as { senha_hash: string | null; papel: string | null; vendedor_slug: string | null };
    return { hash: r.senha_hash, papel: r.papel || "admin", vslug: r.vendedor_slug };
  } catch (e) {
    console.error("[magiclink] usuarioParaSenha:", e);
    return null;
  }
}

export async function gravarSenha(email: string, hash: string): Promise<boolean> {
  try {
    const res = await getClient()
      .from("dashboard_usuarios")
      .update({ senha_hash: hash, senha_atualizada_em: new Date().toISOString() })
      .eq("email", email)
      .eq("ativo", true)
      .select("email");
    return !res.error && !!res.data?.length;
  } catch (e) {
    console.error("[magiclink] gravarSenha:", e);
    return false;
  }
}

/** Envia o e-mail "crie ou troque a sua senha" via Resend. */
export async function enviarLinkSenha(email: string, link: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = (process.env.EMAIL_REMETENTE ?? "").trim();
  if (!key || !from) return { ok: false, error: "E-mail não configurado." };
  const empresa = empresaNome();
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;margin:0 auto;padding:24px;color:#0f1b14">
    <h2 style="margin:0 0 8px;font-size:18px">Criar ou trocar a senha do painel</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563">Clique no botão abaixo para escolher a sua senha do painel da ${empresa}. O link vale por 30 minutos e só pode ser usado uma vez.</p>
    <a href="${link}" style="display:inline-block;background:#12a150;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">Escolher minha senha</a>
    <p style="margin:22px 0 0;font-size:12px;color:#9ca3af">Se você não pediu isso, pode ignorar este e-mail: a sua senha continua a mesma.</p>
  </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: `Criar ou trocar a senha do painel da ${empresa}`, html }),
    });
    if (!res.ok) {
      console.error("[magiclink] Resend (senha) falhou:", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[magiclink] enviarLinkSenha exceção:", e);
    return { ok: false, error: "Falha ao enviar o e-mail." };
  }
}

/** Envia o link de acesso via Resend. */
export async function enviarMagicLink(
  email: string,
  link: string,
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY não configurada." };
  // O Resend só envia de um domínio verificado na conta — sem remetente
  // configurado o e-mail sumiria em silêncio, então falamos claro.
  const from = (process.env.EMAIL_REMETENTE ?? "").trim();
  if (!from) {
    return {
      ok: false,
      error:
        "EMAIL_REMETENTE não configurado — sem ele o login por e-mail não " +
        "funciona (use a senha do painel enquanto isso).",
    };
  }
  const empresa = empresaNome();
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;margin:0 auto;padding:24px;color:#0f1b14">
    <h2 style="margin:0 0 8px;font-size:18px">Acesso ao painel da ${empresa}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563">Clique no botão abaixo para entrar. O link vale por 15 minutos e só pode ser usado uma vez.</p>
    <a href="${link}" style="display:inline-block;background:#12a150;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">Entrar no painel</a>
    <p style="margin:22px 0 0;font-size:12px;color:#9ca3af">Se você não pediu este acesso, pode ignorar este e-mail.</p>
  </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Seu link de acesso ao painel da ${empresa}`,
        html,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[magiclink] Resend falhou:", res.status, t.slice(0, 300));
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[magiclink] enviarMagicLink exceção:", e);
    return { ok: false, error: "Falha ao enviar o e-mail." };
  }
}
