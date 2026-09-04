// Utilidades de HTTP/segurança compartilhadas pelas rotas de auth.

import { envObrigatoria } from "./config";

/** Domínio canônico FIXO (env), nunca o header Host — usado nos links de e-mail
 *  e nos redirects. Evita host-header poisoning.
 *  Ex.: APP_BASE_URL=https://painel.suaempresa.com.br (sem barra no final). */
export function appBaseUrl(): string {
  return envObrigatoria("APP_BASE_URL", process.env.APP_BASE_URL);
}

// Caracteres de controle (C0 0x00–0x1F + DEL 0x7F) não podem aparecer num path.
function temControle(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

/**
 * Sanitiza um destino de redirect pós-login. Só aceita caminho relativo ao
 * PRÓPRIO domínio. Bloqueia open redirect incluindo o bypass por barra
 * invertida (`/\evil.com`), `//host`, `http://`, `javascript:` e caracteres de
 * controle. Resolve com new URL e compara a origem — se sair do domínio, cai
 * pra "/".
 */
export function safePath(from: unknown): string {
  const raw = typeof from === "string" ? from : "/";
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    temControle(raw)
  ) {
    return "/";
  }
  try {
    const base = appBaseUrl();
    const u = new URL(raw, base);
    return u.origin === new URL(base).origin ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

/** IP do cliente a partir dos headers do proxy (Vercel).
 *  Prefere x-real-ip (populado pela Vercel com o IP REAL do cliente) — o
 *  x-forwarded-for da esquerda é controlável pelo cliente e não deve ser
 *  usado como chave de rate-limit em rota pública. */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0]?.trim() || "unknown";
}
