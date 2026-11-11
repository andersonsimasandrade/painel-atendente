// Enquanto um formulário está aberto, a atualização automática da página (LiveStatus, a cada 60 s) fica pausada,
// para não derrubar o que a pessoa está digitando. Também guarda rascunhos na aba (sessionStorage), que sobrevivem
// a um recarregamento (comum no celular quando o calendário nativo abre).

// A pausa é CURTA e só vale enquanto a pessoa está escrevendo: uma caixa aberta e parada por mais de 10 minutos não segura mais
// a atualização (assim a tela não fica desatualizada por horas ou dias). O que foi digitado continua guardado no navegador
// (rascunhos) e volta sozinho se a página recarregar.
const PAUSA_MAXIMA_MS = 10 * 60 * 1000; // sem digitar por 10 min, a atualização volta
const PAUSA_APOS_DIGITAR_MS = 2 * 60 * 1000; // logo depois de digitar, espera 2 min antes de atualizar

type Global = { __pausaRefresh?: number; __pausaDesde?: number; __pausaAte?: number };

export function pausarRefresh(ligado: boolean) {
  if (typeof window === "undefined") return;
  const g = window as unknown as Global;
  const antes = g.__pausaRefresh ?? 0;
  g.__pausaRefresh = Math.max(0, antes + (ligado ? 1 : -1));
  if (antes === 0 && g.__pausaRefresh > 0) g.__pausaDesde = Date.now();
}

/** Chame a cada tecla digitada: renova a pausa enquanto a pessoa estiver escrevendo. */
export function registrarAtividade() {
  if (typeof window === "undefined") return;
  const g = window as unknown as Global;
  g.__pausaDesde = Date.now();
  g.__pausaAte = Date.now() + PAUSA_APOS_DIGITAR_MS;
}

export function refreshPausado(): boolean {
  if (typeof window === "undefined") return false;
  const g = window as unknown as Global;
  const agora = Date.now();
  if ((g.__pausaRefresh ?? 0) > 0 && agora - (g.__pausaDesde ?? 0) < PAUSA_MAXIMA_MS) return true;
  return agora < (g.__pausaAte ?? 0);
}

export function lerRascunho<T>(chave: string): T | null {
  try {
    const s = window.sessionStorage.getItem(chave);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export function guardarRascunho(chave: string, valor: unknown | null) {
  try {
    if (valor === null) window.sessionStorage.removeItem(chave);
    else window.sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento: segue sem rascunho */
  }
}
