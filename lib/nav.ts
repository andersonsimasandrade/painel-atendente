// Itens do menu do painel (barra lateral no computador, faixa horizontal no celular). Arquivo puro.

export type GrupoNav = "inicio" | "atendimento" | "clinico" | "canais" | "sistema";

export interface ItemNav {
  href: string;
  label: string;
  icone: string;
  grupo: GrupoNav;
  /** Só o administrador vê (o consultor, não). */
  admin?: boolean;
  /** Mostra o pontinho de status do WhatsApp. */
  dot?: boolean;
  /** Rotas que deixam o item "ativo". Sem isto, vale o próprio href como prefixo. */
  exato?: boolean;
}

export const GRUPOS: { id: GrupoNav; titulo: string }[] = [
  { id: "inicio", titulo: "" },
  { id: "atendimento", titulo: "Atendimento" },
  { id: "clinico", titulo: "Clínico" },
  { id: "canais", titulo: "Canais e resultados" },
  { id: "sistema", titulo: "Sistema" },
];

// Ordem por FREQUÊNCIA DE USO dentro de cada grupo: o que se usa o dia inteiro vem primeiro.
export const ITENS_NAV: ItemNav[] = [
  { href: "/", label: "Dashboard", icone: "home", grupo: "inicio", admin: true, exato: true },
  { href: "/conversas", label: "Conversas", icone: "chat", grupo: "atendimento" },
  { href: "/leads", label: "Leads", icone: "users", grupo: "atendimento" },
  { href: "/tratamento", label: "Em tratamento", icone: "pulse", grupo: "atendimento", admin: true },
  { href: "/agenda", label: "Agenda", icone: "calendar", grupo: "atendimento" },
  { href: "/tarefas", label: "Tarefas", icone: "check", grupo: "atendimento", admin: true },
  { href: "/prioridades", label: "Prioridades", icone: "flag", grupo: "atendimento" },
  { href: "/funil", label: "Funil", icone: "funnel", grupo: "atendimento" },
  { href: "/atendimento", label: "Atendimento", icone: "headset", grupo: "atendimento" },
  { href: "/exercicios", label: "Exercícios", icone: "dumbbell", grupo: "clinico", admin: true },
  { href: "/instagram", label: "Instagram", icone: "instagram", grupo: "canais", admin: true },
  { href: "/youtube", label: "YouTube", icone: "youtube", grupo: "canais", admin: true },
  { href: "/indicacoes", label: "Indicações", icone: "gift", grupo: "canais", admin: true },
  { href: "/trafego", label: "Tráfego", icone: "trend", grupo: "canais", admin: true },
  { href: "/indicadores", label: "Indicadores", icone: "chart", grupo: "canais", admin: true },
  { href: "/conexao", label: "Conexão", icone: "wifi", grupo: "sistema", dot: true },
  { href: "/config", label: "Ajustes", icone: "settings", grupo: "sistema", admin: true },
];

export function itemAtivo(i: ItemNav, pathname: string): boolean {
  if (i.exato) return pathname === i.href;
  return pathname === i.href || pathname.startsWith(`${i.href}/`);
}

export function itensVisiveis(papel?: string): ItemNav[] {
  return papel === "vendedor" ? ITENS_NAV.filter((i) => !i.admin) : ITENS_NAV;
}
