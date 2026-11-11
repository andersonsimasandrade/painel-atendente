"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConexaoDot } from "./ConexaoDot";
import { ThemeToggle } from "./ThemeToggle";
import { itemAtivo, itensVisiveis } from "@/lib/nav";

/**
 * Navegação entre as seções do painel (Dashboard · Leads · Conversas · Conexão).
 * Fica no topo tanto do Header (dashboard) quanto do SubNav (sub-páginas),
 * destacando a seção ativa a partir do pathname atual. O item "Conexão" traz um
 * pontinho de status ao vivo do WhatsApp (vermelho = caiu).
 */
export function NavLinks({ papel }: { papel?: string }) {
  const pathname = usePathname() || "/";
  const links = itensVisiveis(papel);
  return (
    /* No celular vira UMA faixa que rola na horizontal, em vez de 12 pílulas
       quebrando em quatro linhas: o cabeçalho sticky passava de 270px num
       aparelho de 667px — 40% da tela grudada no topo em toda página, e no inbox
       sobravam três ou quatro bolhas de conversa visíveis. */
    <div className="flex w-full min-w-0 items-center gap-1 lg:w-auto">
      <nav
        aria-label="Seções"
        className="scroll-slim flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto lg:flex-auto lg:flex-wrap lg:overflow-visible"
      >
        {links.map((l) => {
          const active = itemAtivo(l, pathname);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${
                active
                  ? "bg-brand/10 text-brand ring-1 ring-inset ring-brand/25"
                  : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
              }`}
            >
              {l.label}
              {l.dot && <ConexaoDot />}
            </Link>
          );
        })}
      </nav>
      {/* Fora do <nav>: alternar tema não é uma seção do painel. */}
      <ThemeToggle />
    </div>
  );
}
