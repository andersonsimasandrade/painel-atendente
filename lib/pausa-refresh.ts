// Enquanto um formulário está aberto, a atualização automática da página (LiveStatus, a cada 60 s) fica pausada,
// para não derrubar o que a pessoa está digitando. Também guarda rascunhos na aba (sessionStorage), que sobrevivem
// a um recarregamento (comum no celular quando o calendário nativo abre).

type Global = { __pausaRefresh?: number };

export function pausarRefresh(ligado: boolean) {
  if (typeof window === "undefined") return;
  const g = window as unknown as Global;
  g.__pausaRefresh = Math.max(0, (g.__pausaRefresh ?? 0) + (ligado ? 1 : -1));
}

export function refreshPausado(): boolean {
  if (typeof window === "undefined") return false;
  return ((window as unknown as Global).__pausaRefresh ?? 0) > 0;
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
