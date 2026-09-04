"use client";

import { useEffect, useState } from "react";
import { Panel } from "./Panel";

/**
 * Modo demonstração: borra o que identifica o lead, pra gravar aula sem expor
 * dado de cliente real.
 *
 * Duas decisões que valem estar escritas:
 *
 *  • É LOCAL, não do servidor. Fica no localStorage de quem está gravando, igual
 *    ao tema. Se fosse config do painel, ligar aqui borraria a tela do time
 *    inteiro no meio do expediente.
 *  • É SÓ apresentação. Nada muda no banco, nada é apagado, e desligar devolve
 *    tudo na hora — não existe risco de "esqueci ligado e perdi dado".
 */

type Nivel = "off" | "ident" | "tudo";

const OPCOES: { v: Nivel; label: string; desc: string }[] = [
  {
    v: "off",
    label: "Desligado",
    desc: "O painel mostra tudo, como sempre.",
  },
  {
    v: "ident",
    label: "Borrar identificação",
    desc: "Telefone, nome, iniciais do avatar e CNPJ. A conversa continua legível — normalmente é ela que você quer mostrar.",
  },
  {
    v: "tudo",
    label: "Borrar identificação e conversas",
    desc: "Inclui o texto das mensagens. Use quando a própria conversa tiver nome, endereço ou CNPJ escritos dentro.",
  },
];

export function ModoDemo() {
  const [nivel, setNivel] = useState<Nivel | null>(null); // null até hidratar

  useEffect(() => {
    const d = document.documentElement.getAttribute("data-demo");
    setNivel(d === "ident" || d === "tudo" ? (d as Nivel) : "off");
  }, []);

  function escolher(v: Nivel) {
    if (v === "off") document.documentElement.removeAttribute("data-demo");
    else document.documentElement.setAttribute("data-demo", v);
    try {
      localStorage.setItem("painel-demo", v);
    } catch {
      /* modo anônimo — vale só até fechar a aba */
    }
    setNivel(v);
  }

  const ligado = nivel === "ident" || nivel === "tudo";

  return (
    <Panel
      title="Gravar demonstração"
      subtitle="Borra os dados dos leads para você gravar aula ou apresentar o painel"
      delay={160}
    >
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Vale <strong className="font-semibold text-ink">só neste navegador</strong> e{" "}
        <strong className="font-semibold text-ink">só na aparência</strong>: nada muda no banco, o
        time não é afetado e desligar devolve tudo na hora.
      </p>

      <div className="mt-3.5 flex flex-col gap-2">
        {OPCOES.map((o) => {
          const ativo = nivel === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => escolher(o.v)}
              aria-pressed={ativo}
              disabled={nivel === null}
              className={`rounded-xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-50 ${
                ativo
                  ? "border-brand/40 bg-brand/[0.08]"
                  : "border-line bg-surface-2/40 hover:border-line-strong"
              }`}
            >
              <span
                className={`block text-[13.5px] font-semibold ${ativo ? "text-brand" : "text-ink"}`}
              >
                {o.label}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">
                {o.desc}
              </span>
            </button>
          );
        })}
      </div>

      {ligado && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-[12.5px] leading-relaxed text-amber"
        >
          Está ligado agora — os dados aparecem borrados em todo o painel até você desligar aqui.
          Fica salvo neste navegador, inclusive depois de fechar.
        </p>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
        O que ele <strong className="text-ink-muted">não</strong> esconde: o nome da sua empresa, o
        nome dos consultores e o que estiver fora da página — a barra de endereço do navegador, o
        título da aba e notificações do sistema. Para gravar, prefira capturar só a área da página.
      </p>
    </Panel>
  );
}
