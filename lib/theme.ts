// Ordem canônica das etapas do funil, com rótulos PT-BR e cores.
//
// >>> PONTO DE ADAPTAÇÃO: os RÓTULOS são livres — mude à vontade, mas mude
//     TAMBÉM o seed de funil_etapas na seção 4 do BANCO-supabase.sql, senão o
//     kanban (que lê do banco) e os selos (que leem daqui) mostram nomes
//     diferentes para o mesmo lead.
//     As CHAVES são contrato com o robô: se mudar uma, mude no prompt e no
//     fluxo do n8n também. <<<
// A cor é uma rampa ordinal verde (frio -> emerald vivo no objetivo),
// com dois estados especiais: "roteado" (ciano, roteamento) e
// "transferido" (âmbar, entregue a humano). Todo badge sempre traz
// o rótulo em texto — a cor nunca é a única codificação.
export interface StageMeta {
  key: string;
  label: string;
  rank: number;
  color: string;
}

export const STAGE_ORDER: StageMeta[] = [
  // "Novo" (#3F6B5C) dava 2,78:1 e "Qualificando" (#2E8C74) 3,97:1 no tema
  // escuro — e "Novo" é o badge mais frequente do painel (todo lead recém-
  // captado) e a primeira coluna do kanban, justamente o que se varre rápido
  // pra achar quem ainda não foi atendido. Clareados para ~5:1, mesmo matiz.
  { key: "novo", label: "Novo", rank: 0, color: "#5B8F7C" },
  { key: "qualificando", label: "Qualificando", rank: 1, color: "#34997F" },
  { key: "materiais_enviados", label: "Materiais", rank: 2, color: "#18A57C" },
  { key: "roteado", label: "Encaminhado", rank: 2, color: "#39B7C4" },
  { key: "politica_enviada", label: "Proposta", rank: 3, color: "#15C68C" },
  { key: "agendado", label: "Agendado", rank: 4, color: "#2FE58F" },
  { key: "transferido", label: "Transferido", rank: 5, color: "#E0A63C" },
];

export const STAGE_MAP: Record<string, StageMeta> = Object.fromEntries(
  STAGE_ORDER.map((s) => [s.key, s]),
);

export function stageMeta(key: string): StageMeta {
  return (
    STAGE_MAP[key] ?? {
      key,
      label: key ? key.replace(/_/g, " ") : "—",
      rank: 0,
      color: "#7F8F88",
    }
  );
}

// Passos exibidos no funil de conversão (monotônico por rank).
export const FUNNEL_STEPS: { key: string; label: string; rank: number }[] = [
  { key: "novo", label: "Novo", rank: 0 },
  { key: "qualificando", label: "Qualificando", rank: 1 },
  { key: "materiais_enviados", label: "Materiais", rank: 2 },
  { key: "politica_enviada", label: "Proposta", rank: 3 },
  { key: "agendado", label: "Agendado", rank: 4 },
];

// Rampa verde sequencial para as barras do funil (topo -> objetivo).
export const FUNNEL_RAMP = [
  "#2C6656",
  "#268F6E",
  "#16A87C",
  "#18C88C",
  "#2FE58F",
];

// ── Perfis do lead ────────────────────────────────────────────────────────
// >>> PONTO DE ADAPTAÇÃO: este é o vocabulário com que a IA classifica quem
//     está do outro lado. Troque as CHAVES e os RÓTULOS pelo vocabulário do
//     SEU negócio, e ajuste a mesma lista em lib/types.ts e no prompt de
//     lib/resumo.ts — os três precisam falar a mesma língua. <<<
//
// A primeira da lista é o alvo (verde da marca); as outras vão esfriando.
// Sempre há rótulo em texto — a cor nunca é a única codificação.
export interface PerfilMeta {
  key: string;
  label: string;
  color: string;
}

// A IA preenche "revendedor", "profissional", "representante" e "consumidor";
// "cliente_ativo" é marcação MANUAL de quem já compra.
export const PERFIL_ORDER: PerfilMeta[] = [
  { key: "revendedor", label: "Revendedor em potencial", color: "#2FE58F" },
  { key: "cliente_ativo", label: "Cliente ativo", color: "#A78BFA" },
  { key: "profissional", label: "Profissional do setor", color: "#39B7C4" },
  { key: "representante", label: "Representante", color: "#E0A63C" },
  { key: "consumidor", label: "Consumidor final", color: "#8D9A93" },
];

export const PERFIL_MAP: Record<string, PerfilMeta> = Object.fromEntries(
  PERFIL_ORDER.map((p) => [p.key, p]),
);

// Bucket para leads que a IA ainda não classificou.
export const PERFIL_NONE: PerfilMeta = {
  key: "nao_informado",
  label: "Indefinido",
  color: "#7F8F88",
};

export function perfilMeta(key: string | null | undefined): PerfilMeta {
  if (!key) return PERFIL_NONE;
  return (
    PERFIL_MAP[key] ?? {
      key,
      label: key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      color: "#7F8F88",
    }
  );
}

// ── Desfecho do atendimento (Concluir) ────────────────────────────────────
// `terminal: false` = o atendimento SEGUE vivo (não some do kanban nem conta
// como concluído nos números). >>> ADAPTE os rótulos ao seu processo <<<
export interface ResultadoMeta {
  key: string;
  label: string;
  color: string;
  terminal: boolean;
}

export const RESULTADO_ORDER: ResultadoMeta[] = [
  { key: "ganho", label: "Convertido em cliente", color: "#2FE58F", terminal: true },
  { key: "em_negociacao", label: "Em negociação", color: "#39B7C4", terminal: false },
  { key: "reuniao_agendada", label: "Reunião agendada", color: "#4EA8DE", terminal: false },
  { key: "sem_retorno", label: "Sem retorno", color: "#8D9A93", terminal: true },
  { key: "sem_interesse", label: "Sem interesse", color: "#A78BFA", terminal: true },
  { key: "sem_fit", label: "Não tem perfil", color: "#D98E5F", terminal: true },
  { key: "no_show", label: "No-show", color: "#E0A63C", terminal: true },
  { key: "perdido", label: "Perdido", color: "#E05C5C", terminal: true },
];

/** true quando o desfecho encerra o atendimento (null/desconhecido = aberto). */
export function resultadoTerminal(key: string | null | undefined): boolean {
  if (!key) return false;
  return RESULTADO_MAP[key]?.terminal ?? true;
}

export const RESULTADO_MAP: Record<string, ResultadoMeta> = Object.fromEntries(
  RESULTADO_ORDER.map((r) => [r.key, r]),
);

// Não existe aqui um objeto de cores da marca de propósito: seria uma segunda
// fonte de verdade, congelada no tema escuro, esperando alguém consumir e
// quebrar o tema claro. As cores vivem em tailwind.config.ts + globals.css.
