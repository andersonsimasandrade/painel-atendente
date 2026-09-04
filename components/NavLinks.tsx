"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConexaoDot } from "./ConexaoDot";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Navegação entre as seções do painel (Dashboard · Leads · Conversas · Conexão).
 * Fica no topo tanto do Header (dashboard) quanto do SubNav (sub-páginas),
 * destacando a seção ativa a partir do pathname atual. O item "Conexão" traz um
 * pontinho de status ao vivo do WhatsApp (vermelho = caiu).
 */
const LINKS: {
  href: string;
  label: string;
  match: (p: string) => boolean;
  dot?: boolean;
  admin?: boolean;
}[] = [
  // Ordem por FREQUÊNCIA DE USO, não por ordem de criação. Antes o inbox
  // (Conversas) era o 9º item — depois de uma tabela de consulta e de duas telas
  // de diretoria —, e é onde o consultor trabalha o dia inteiro. Agora as telas
  // de trabalho vêm primeiro, depois as de análise, e por último conexão e
  // ajustes. Pro consultor (sem os itens `admin`), Conversas é o 1º.
  { href: "/", label: "Dashboard", match: (p) => p === "/", admin: true },
  { href: "/conversas", label: "Conversas", match: (p) => p.startsWith("/conversas") },
  { href: "/prioridades", label: "Prioridades", match: (p) => p.startsWith("/prioridades") },
  {
    href: "/leads",
    label: "Leads",
    match: (p) => p === "/leads" || p.startsWith("/leads/"),
  },
  { href: "/funil", label: "Funil", match: (p) => p.startsWith("/funil") },
  { href: "/agenda", label: "Agenda", match: (p) => p === "/agenda" || p.startsWith("/agenda/") },
  { href: "/atendimento", label: "Atendimento", match: (p) => p.startsWith("/atendimento") },
  { href: "/trafego", label: "Tráfego", match: (p) => p.startsWith("/trafego"), admin: true },
  { href: "/conexao", label: "Conexão", match: (p) => p.startsWith("/conexao"), dot: true },
  { href: "/config", label: "Ajustes", match: (p) => p.startsWith("/config"), admin: true },
];

export function NavLinks({ papel }: { papel?: string }) {
  const pathname = usePathname() || "/";
  const links = papel === "vendedor" ? LINKS.filter((l) => !l.admin) : LINKS;
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
          const active = l.match(pathname);
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
