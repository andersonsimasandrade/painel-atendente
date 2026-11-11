// Acesso protegido à devolutiva (documento de saúde: LGPD). O link tem código secreto E pede a data de nascimento do paciente.
// Acertou: cookie assinado (HMAC) só deste documento, válido por 12 horas. Errou 5 vezes: trava por 15 minutos. Server-only.
import { createHmac, timingSafeEqual } from "node:crypto";

const VALIDADE_MS = 12 * 3600 * 1000;
const JANELA_MS = 15 * 60 * 1000;
const MAX_ERROS = 5;

const segredo = () => process.env.AUTH_SECRET || process.env.DASHBOARD_PASSWORD || "";

export const cookieDevolutiva = (codigo: string) => `dv_${codigo.slice(0, 16)}`;
export const VALIDADE_COOKIE_S = VALIDADE_MS / 1000;

const mac = (codigo: string, exp: number) => createHmac("sha256", segredo()).update(`devolutiva|${codigo}|${exp}`).digest("base64url");

export function criarToken(codigo: string): string {
  const exp = Date.now() + VALIDADE_MS;
  return `${exp}.${mac(codigo, exp)}`;
}

/** Sem segredo configurado, nada é liberado (falha fechada). */
export function tokenValido(codigo: string, token?: string | null): boolean {
  if (!segredo() || !token) return false;
  const [e, m] = token.split(".");
  const exp = Number(e);
  if (!Number.isFinite(exp) || exp < Date.now() || !m) return false;
  const a = new TextEncoder().encode(m);
  const b = new TextEncoder().encode(mac(codigo, exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Controle de tentativas (memória do servidor: basta para uma instância só).
const falhas = new Map<string, { n: number; desde: number }>();

/** Minutos que faltam para liberar nova tentativa (0 = pode tentar). */
export function minutosBloqueado(codigo: string): number {
  const f = falhas.get(codigo);
  if (!f) return 0;
  if (Date.now() - f.desde > JANELA_MS) {
    falhas.delete(codigo);
    return 0;
  }
  return f.n >= MAX_ERROS ? Math.max(1, Math.ceil((JANELA_MS - (Date.now() - f.desde)) / 60000)) : 0;
}
export function registrarFalha(codigo: string): void {
  const f = falhas.get(codigo);
  if (!f || Date.now() - f.desde > JANELA_MS) falhas.set(codigo, { n: 1, desde: Date.now() });
  else f.n += 1;
  if (falhas.size > 5000) falhas.clear();
}
export function limparFalhas(codigo: string): void {
  falhas.delete(codigo);
}

/** "15/03/1970", "15031970" ou "1970-03-15" → "1970-03-15". Data inválida → null. */
export function nascimentoIso(txt: string): string | null {
  const s = String(txt ?? "").trim();
  let d: string, m: string, a: string;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) [, a, m, d] = iso;
  else {
    const n = s.replace(/\D/g, "");
    if (n.length !== 8) return null;
    d = n.slice(0, 2);
    m = n.slice(2, 4);
    a = n.slice(4, 8);
  }
  const ano = Number(a);
  const dt = new Date(Date.UTC(ano, Number(m) - 1, Number(d)));
  const ok = dt.getUTCFullYear() === ano && dt.getUTCMonth() === Number(m) - 1 && dt.getUTCDate() === Number(d) && ano >= 1900 && ano <= new Date().getFullYear();
  return ok ? `${a}-${m}-${d}` : null;
}
