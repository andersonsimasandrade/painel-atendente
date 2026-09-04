"use client";

import { useState } from "react";

/**
 * Marcar a conversa como lida / não lida (como no WhatsApp).
 *  • lida  → silencia o "Aguardando" até o lead falar de novo;
 *  • não lida → força o destaque de volta, pra voltar nela depois.
 * O estado inicial vem do `aguardando` calculado pelo servidor; daí em diante
 * o componente é otimista (o poll da lista reconcilia em ~7s).
 */
export function MarcarLida({
  telefone,
  aguardando,
  onMudou,
}: {
  telefone: string;
  aguardando: boolean;
  onMudou?: (aguardando: boolean) => void;
}) {
  const [naoLida, setNaoLida] = useState(aguardando);
  const [salvando, setSalvando] = useState(false);
  // Antes as duas saídas de falha só revertiam o estado, sem nenhum aviso: o
  // chip piscava e voltava, e o consultor não sabia se tinha sido toque mal
  // registrado ou falha de rede. Tocava de novo, e de novo — e a conversa
  // continuava em "Aguardando" sem ninguém entender por quê.
  const [erro, setErro] = useState(false);

  async function alternar() {
    const alvoLida = naoLida; // se está "não lida", a ação é marcar como lida
    const anterior = naoLida;
    setNaoLida(!alvoLida);
    onMudou?.(!alvoLida);
    setSalvando(true);
    setErro(false);
    const falhou = () => {
      setNaoLida(anterior);
      onMudou?.(anterior);
      setErro(true);
    };
    try {
      const res = await fetch(`/api/conversa/${encodeURIComponent(telefone)}/lida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lida: alvoLida }),
      });
      if (!res.ok) falhou();
    } catch {
      falhou();
    } finally {
      setSalvando(false);
    }
  }

  if (erro) {
    return (
      <button
        type="button"
        onClick={() => void alternar()}
        disabled={salvando}
        title="Não consegui salvar. Toque para tentar de novo."
        className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-2.5 py-1 text-[11.5px] font-medium leading-none text-amber ring-1 ring-inset ring-amber/30 transition hover:bg-amber/15 disabled:opacity-50"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 8v5m0 3.5h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Não salvou — tentar de novo
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void alternar()}
      disabled={salvando}
      title={naoLida ? "Marcar como lida" : "Marcar como não lida"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium leading-none ring-1 ring-inset transition disabled:opacity-50 ${
        naoLida
          ? "bg-brand/12 text-brand ring-brand/25 hover:bg-brand/20"
          : "bg-white/[0.04] text-ink-faint ring-line hover:text-ink-muted"
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {naoLida ? (
          <path
            d="M4 6h16v12H4zM4 7l8 6 8-6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M4 12.5 9 17.5 20 6.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {naoLida ? "Não lida" : "Lida"}
    </button>
  );
}
