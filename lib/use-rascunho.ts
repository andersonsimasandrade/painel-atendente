"use client";

import { useEffect, useRef } from "react";
import { guardarRascunho, lerRascunho, pausarRefresh } from "./pausa-refresh";

/**
 * Mantém um formulário longo vivo: enquanto estiver aberto, pausa a atualização automática da página (a cada 60 s)
 * e guarda um rascunho na aba do navegador. Se a página recarregar, o formulário volta aberto, com o que já foi digitado.
 * Ao fechar/salvar (aberto = false), o rascunho é apagado.
 */
export function useRascunho<T extends object>(chave: string, aberto: boolean, estado: T, restaurar: (e: T) => void) {
  const restaurado = useRef(false);
  const restaurarRef = useRef(restaurar);
  restaurarRef.current = restaurar;

  useEffect(() => {
    if (restaurado.current) return;
    restaurado.current = true;
    const r = lerRascunho<T>(chave);
    if (r) restaurarRef.current(r);
  }, [chave]);

  useEffect(() => {
    if (!aberto) return;
    pausarRefresh(true);
    return () => pausarRefresh(false);
  }, [aberto]);

  const instantaneo = JSON.stringify(estado);
  useEffect(() => {
    if (!restaurado.current) return;
    guardarRascunho(chave, aberto ? estado : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, instantaneo, chave]);
}
