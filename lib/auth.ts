// Autenticação simples baseada em cookie assinado (HMAC-SHA256).
// Usa apenas Web Crypto + Text(En|De)coder => compatível tanto com o
// runtime Node (route handlers) quanto com o Edge (middleware).
//
// O segredo que assina o cookie é o AUTH_SECRET (veja getSecret abaixo).

export const COOKIE_NAME = "atendente_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 dias
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_S * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Segredo de assinatura da sessão. Preferimos AUTH_SECRET (aleatório, alta
// entropia) — assim o segredo que assina o cookie NÃO é a senha de login. Se
// AUTH_SECRET não estiver setado, cai na DASHBOARD_PASSWORD (retrocompatível).
export function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.DASHBOARD_PASSWORD || "";
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64: string): Uint8Array {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function strToB64url(str: string): string {
  return bytesToB64url(encoder.encode(str));
}

function b64urlToStr(b64: string): string {
  return decoder.decode(b64urlToBytes(b64));
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Constrói um token assinado para a sessão atual. Opcionalmente carimba o
 * e-mail de quem entrou (magic link) — a validação em verifyToken continua a
 * mesma (assinatura + idade), então o campo é retrocompatível.
 */
export async function signToken(
  email?: string,
  papel?: string,
  vslug?: string | null,
): Promise<string> {
  const claims: { v: number; iat: number; email?: string; papel?: string; vslug?: string } = {
    v: 1,
    iat: Date.now(),
  };
  if (email) claims.email = email;
  if (papel) claims.papel = papel;
  if (vslug) claims.vslug = vslug;
  const payload = strToB64url(JSON.stringify(claims));
  const key = await importKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${bytesToB64url(new Uint8Array(sig))}`;
}

export interface SessionClaims {
  email?: string;
  papel: string; // 'admin' (default p/ retrocompat) | 'vendedor'
  vslug?: string; // vendedor_slug quando papel = 'vendedor'
}

/** Verifica assinatura + validade e devolve as claims (ou null). Edge-safe. */
export async function getSessionClaims(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token || !getSecret()) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;

  try {
    const key = await importKey(getSecret());
    const expected = bytesToB64url(
      new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))),
    );
    if (!timingSafeEqual(expected, sig)) return null;

    const data = JSON.parse(b64urlToStr(payload)) as {
      iat?: number;
      email?: string;
      papel?: string;
      vslug?: string;
    };
    if (typeof data.iat !== "number") return null;
    if (Date.now() - data.iat > SESSION_MAX_AGE_MS) return null;
    return { email: data.email, papel: data.papel || "admin", vslug: data.vslug };
  } catch {
    return null;
  }
}

/** Verifica assinatura + validade (idade) do token. */
export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  return (await getSessionClaims(token)) !== null;
}
