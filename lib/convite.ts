// Token de convite de agenda — autoriza um NÃO-lead a agendar, travado a um
// telefone específico e com validade. Emitido só atrás do login; a rota pública
// /api/agendar só pula o gate existeLead com um token válido cujo telefone bate.
//
// Runtime nodejs (rotas /api/agendar e /api/agenda/convite) → usa node:crypto.
// Funções puras recebem o segredo por parâmetro (testáveis isoladas).

import crypto from "node:crypto";
import { getSecret } from "./auth";

const DIAS_VALIDADE = 3; // janela curta: reduz exposição de um link vazado
const KEY_INFO = "agenda-convite-key-v1"; // namespaced: NÃO assina com o segredo cru
const MSG_PREFIX = "agenda-convite:v1:";

// Chave de convite derivada do segredo de auth (namespaced). Em hex (string) —
// evita passar Buffer como chave (fricção de tipos TS x @types/node).
function inviteKey(secret: string): string {
  return crypto.createHmac("sha256", secret).update(KEY_INFO).digest("hex");
}

function hmac(payload: string, secret: string): string {
  return crypto.createHmac("sha256", inviteKey(secret)).update(MSG_PREFIX + payload).digest("base64url");
}

// Comparação em tempo constante entre duas strings (mesmo padrão de lib/auth).
function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// token = base64url(`${slug}.${telefone}.${exp}`) + "." + base64url(hmac). O
// slug (vendedor) é ASSINADO junto → um convite emitido p/ um vendedor não vale
// pra outro (audience binding). slug/telefone não contêm ".", então o split do
// payload em 3 é inequívoco; e base64url não contém "." → o token tem 1 ponto só.
export function assinarConvite(
  slug: string,
  telefone: string,
  expEpoch: number,
  secret: string,
): string {
  const payload = `${slug}.${telefone}.${expEpoch}`;
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${payloadB64}.${hmac(payload, secret)}`;
}

export type ResultadoConvite =
  | { ok: true; slug: string; telefone: string }
  | { ok: false; motivo: "formato" | "assinatura" | "expirado" };

export function verificarConvite(token: string, secret: string, agoraMs: number): ResultadoConvite {
  const i = token.indexOf(".");
  if (i <= 0 || i === token.length - 1) return { ok: false, motivo: "formato" };
  const payloadB64 = token.slice(0, i);
  const sigB64 = token.slice(i + 1);

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return { ok: false, motivo: "formato" };
  }

  const esperado = hmac(payload, secret);
  if (!ctEqual(sigB64, esperado)) {
    return { ok: false, motivo: "assinatura" };
  }

  const partes = payload.split(".");
  if (partes.length !== 3) return { ok: false, motivo: "formato" };
  const [slug, telefone, expStr] = partes;
  const exp = Number(expStr);
  if (!slug || !telefone || !Number.isFinite(exp)) return { ok: false, motivo: "formato" };
  if (exp * 1000 <= agoraMs) return { ok: false, motivo: "expirado" };

  return { ok: true, slug, telefone };
}

// ── Wrappers que leem o segredo do ambiente ────────────────────────────────
export function assinarConviteEnv(slug: string, telefone: string): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + DIAS_VALIDADE * 86400;
  return { token: assinarConvite(slug, telefone, exp, getSecret()), exp };
}

export function verificarConviteEnv(token: string): ResultadoConvite {
  const s = getSecret();
  if (!s) return { ok: false, motivo: "assinatura" };
  return verificarConvite(token, s, Date.now());
}
