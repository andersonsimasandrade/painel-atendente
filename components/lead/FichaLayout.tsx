"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

export interface AbaFicha {
  id: string;
  label: string;
  conteudo: ReactNode;
  /** Número ou texto curto ao lado do nome da aba (ex.: sessões sem data). */
  selo?: string | null;
  /** Ids (âncoras #id) que abrem esta aba. */
  ancoras?: string[];
}

/**
 * Ficha do paciente em abas, com a CONVERSA fixa ao lado (telas largas) ou como uma aba (telas menores):
 * dá para ler e responder o paciente sem sair da ficha. As abas continuam montadas (só escondidas), então o que
 * está sendo escrito em uma delas não se perde ao trocar de aba.
 */
export function FichaLayout({ abas, chat }: { abas: AbaFicha[]; chat: ReactNode }) {
  const [ativa, setAtiva] = useState(abas[0]?.id ?? "");
  const [largo, setLargo] = useState(false);
  // A página se atualiza sozinha de tempos em tempos (as abas chegam como propriedades novas): a âncora (#...) só vale
  // quando a pessoa a aciona, nunca a cada atualização.
  const abasRef = useRef(abas);
  abasRef.current = abas;
  const largoRef = useRef(false);
  largoRef.current = largo;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const ler = () => setLargo(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);

  // Âncoras (#prontuario, #exercicios, #conversa...) abrem a aba certa e rolam até o ponto.
  useEffect(() => {
    function irParaHash() {
      const h = window.location.hash.replace("#", "");
      if (!h) return;
      if (h === "conversa") {
        if (largoRef.current) document.querySelector<HTMLTextAreaElement>("#chat-ficha textarea")?.focus();
        else setAtiva("conversa");
        return;
      }
      const alvo = abasRef.current.find((a) => a.id === h || a.ancoras?.includes(h));
      if (alvo) {
        setAtiva(alvo.id);
        setTimeout(() => document.getElementById(h)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      }
    }
    irParaHash();
    window.addEventListener("hashchange", irParaHash);
    return () => window.removeEventListener("hashchange", irParaHash);
  }, []);

  const todas: AbaFicha[] = largo ? abas : [...abas, { id: "conversa", label: "Conversa", conteudo: null }];
  const emFoco = todas.some((a) => a.id === ativa) ? ativa : todas[0]?.id;

  return (
    <div className={largo ? "grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_440px]" : ""}>
      <div className="min-w-0">
        <nav aria-label="Seções da ficha" className="scroll-slim sticky top-[68px] z-20 -mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line bg-base/85 px-1 pb-0 pt-1 backdrop-blur-xl">
          {todas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAtiva(a.id)}
              aria-current={emFoco === a.id ? "page" : undefined}
              className={`relative shrink-0 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-[13px] font-semibold transition ${
                emFoco === a.id ? "text-brand" : "text-ink-muted hover:text-ink"
              }`}
            >
              {a.label}
              {a.selo ? <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10.5px] font-bold text-brand">{a.selo}</span> : null}
              {emFoco === a.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </nav>

        {abas.map((a) => (
          <div key={a.id} className={emFoco === a.id ? "block" : "hidden"}>
            {a.conteudo}
          </div>
        ))}
        {!largo && emFoco === "conversa" && (
          <div id="chat-ficha" className="h-[calc(100dvh-170px)] min-h-[420px]">
            {chat}
          </div>
        )}
      </div>

      {largo && (
        <aside id="chat-ficha" className="sticky top-[84px] h-[calc(100dvh-104px)] min-h-[420px]">
          {chat}
        </aside>
      )}
    </div>
  );
}
