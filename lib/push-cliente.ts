// Funções do navegador para os avisos no celular (usadas na tela Ajustes e no religamento automático).

/** Lembra, neste aparelho, se a pessoa ligou ou desligou os avisos (para não religar quem desligou de propósito). */
export const CHAVE_PREFERENCIA = "painel-avisos";

export function chaveParaBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function lembrarPreferencia(valor: "ligado" | "desligado"): void {
  try {
    localStorage.setItem(CHAVE_PREFERENCIA, valor);
  } catch {
    /* sem armazenamento: o religamento automático só usa a permissão do aparelho */
  }
}

export function preferencia(): string | null {
  try {
    return localStorage.getItem(CHAVE_PREFERENCIA);
  } catch {
    return null;
  }
}
