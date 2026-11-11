"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GRUPOS, itemAtivo, itensVisiveis } from "@/lib/nav";
import { ConexaoDot } from "./ConexaoDot";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const ICONES: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  chat: "M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1A8.5 8.5 0 0 1 4 12.5 8.4 8.4 0 0 1 12.5 4 8.4 8.4 0 0 1 21 11.5Z",
  users: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 5.2a3 3 0 0 1 0 5.6",
  pulse: "M3 12h4l2.5-6 4 12 2.5-6H21",
  calendar: "M7 3v3M17 3v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Z",
  check: "M5 12.5 9.5 17 19 7.5M4 4.5h16v15H4z",
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
  funnel: "M4 5h16l-6 7v6l-4 2v-8L4 5Z",
  headset: "M5 14v-2a7 7 0 0 1 14 0v2M5 14h2.5v4H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Zm14 0h-2.5v4H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1ZM17 18.5c0 1.4-2 2-5 2",
  dumbbell: "M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11",
  instagram: "M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3ZM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM17 7.2h.01",
  youtube: "M3.5 8.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-7ZM10.5 9.5v5l4.5-2.5-4.5-2.5Z",
  gift: "M4 10h16v3H4zM5 13v7h14v-7M12 10v10M12 10c-2.5 0-4-1-4-2.5S9.5 5 12 8c2.5-3 4-.5 4 .5S14.5 10 12 10Z",
  trend: "M4 17l5-5 4 4 7-8M15 8h5v5",
  chart: "M5 20V10m5 10V4m5 16v-7m5 7V8",
  wifi: "M4 9.5a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 16.5a4 4 0 0 1 4 0M12 20h.01",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.4 1.1-1.5 2.6-1.7-.6a7 7 0 0 1-1.6.9L15.6 19h-3l-.4-1.5a7 7 0 0 1-1.6-.9l-1.7.6-1.5-2.6 1.4-1.1a7 7 0 0 1 0-1.8L7.4 10.6 8.9 8l1.7.6a7 7 0 0 1 1.6-.9L12.6 6h3l.4 1.7a7 7 0 0 1 1.6.9l1.7-.6 1.5 2.6-1.4 1.1a7 7 0 0 1 0 1.8Z",
};

function Icone({ nome }: { nome: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d={ICONES[nome] ?? ICONES.home} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Barra lateral do painel (computador): grupos, ícones e recolhível. A escolha (aberta/recolhida) fica no navegador e é
 * aplicada antes da pintura pelo script do layout (data-sb), então a tela não "pula". No celular continua a faixa de cima.
 */
export function Sidebar({ papel }: { papel?: string }) {
  const pathname = usePathname() || "/";
  const [min, setMin] = useState(false);

  useEffect(() => {
    setMin(document.documentElement.getAttribute("data-sb") === "min");
  }, []);

  function alternar() {
    const novo = !min;
    setMin(novo);
    document.documentElement.setAttribute("data-sb", novo ? "min" : "max");
    try {
      window.localStorage.setItem("painel-sidebar", novo ? "min" : "max");
    } catch {
      /* sem armazenamento */
    }
  }

  const itens = itensVisiveis(papel);
  return (
    <aside
      aria-label="Menu do painel"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sb-w)] flex-col border-r border-line bg-base/95 backdrop-blur-xl transition-[width] duration-200 lg:flex"
    >
      <div className="flex h-[68px] shrink-0 items-center gap-3 px-[14px]">
        <Link href={papel === "vendedor" ? "/prioridades" : "/"} className="shrink-0" aria-label="Início">
          <Logo size={38} />
        </Link>
        {!min && (
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[14px] font-semibold tracking-tight text-ink">Atendente 24h</p>
            <p className="truncate text-[11px] text-ink-faint">Anderson Andrade Fisio</p>
          </div>
        )}
      </div>

      <nav className="scroll-slim flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-2">
        {GRUPOS.map((g) => {
          const lista = itens.filter((i) => i.grupo === g.id);
          if (!lista.length) return null;
          return (
            <div key={g.id} className="flex flex-col gap-0.5">
              {g.titulo && (min ? <div className="mx-2 my-1 border-t border-line" /> : <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">{g.titulo}</p>)}
              {lista.map((i) => {
                const ativo = itemAtivo(i, pathname);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    title={min ? i.label : undefined}
                    aria-current={ativo ? "page" : undefined}
                    className={`flex h-10 items-center gap-3 rounded-xl px-[13px] text-[13px] font-medium transition ${
                      ativo ? "bg-brand/10 text-brand ring-1 ring-inset ring-brand/25" : "text-ink-muted hover:bg-white/[0.05] hover:text-ink"
                    }`}
                  >
                    <Icone nome={i.icone} />
                    {!min && <span className="min-w-0 flex-1 truncate">{i.label}</span>}
                    {i.dot && (min ? <span className="-ml-2 -mt-3"><ConexaoDot /></span> : <ConexaoDot />)}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={alternar}
          title={min ? "Expandir o menu" : "Recolher o menu"}
          aria-label={min ? "Expandir o menu" : "Recolher o menu"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-line-strong hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={min ? "rotate-180" : ""}>
            <path d="M14 6l-6 6 6 6M19 5v14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

/** Coloca a barra lateral na página e abre espaço para ela (no servidor, para a tela não pular ao carregar). */
export function BarraLateral({ papel }: { papel?: string }) {
  return (
    <>
      <style>{`@media (min-width:1024px){body{padding-left:var(--sb-w);transition:padding-left .2s}}`}</style>
      <Sidebar papel={papel} />
    </>
  );
}
