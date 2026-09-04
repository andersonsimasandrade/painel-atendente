"use client";

import { useEffect, useState } from "react";

/**
 * Interruptor claro/escuro do painel. A escolha vive no
 * navegador de cada um (localStorage "painel-tema"); o script no layout aplica
 * antes da pintura pra não piscar. Padrão: escuro.
 */
export function ThemeToggle() {
  const [claro, setClaro] = useState<boolean | null>(null); // null até hidratar

  useEffect(() => {
    setClaro(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function alternar() {
    const novo = !claro;
    if (novo) document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    // A meta theme-color não muda sozinha: ela é resolvida na renderização e não
    // acompanha o data-theme. Sem isto, quem liga o modo claro no celular fica
    // com a barra do navegador preta em cima de uma página branca.
    try {
      let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
      if (!m) {
        m = document.createElement("meta");
        m.name = "theme-color";
        document.head.appendChild(m);
      }
      m.content = novo ? "#F3F7F4" : "#080B0A";
    } catch {
      /* não impede a troca de tema */
    }
    try {
      localStorage.setItem("painel-tema", novo ? "light" : "dark");
    } catch {
      /* modo anônimo etc. — o tema vale só até fechar */
    }
    setClaro(novo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={claro ? "Mudar para o modo escuro" : "Mudar para o modo claro"}
      title={claro ? "Modo escuro" : "Modo claro"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-white/[0.05] hover:text-ink"
    >
      {claro ? (
        // lua (voltar pro escuro)
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // sol (ir pro claro)
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
