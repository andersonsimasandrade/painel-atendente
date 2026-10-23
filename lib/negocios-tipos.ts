// Tipos e textos de NEGÓCIOS (cada tentativa de venda/atendimento de uma pessoa). Arquivo puro: pode ser importado
// por componentes de cliente. A lógica com banco fica em lib/negocios.ts.

export type StatusNegocio = "aberto" | "ganho" | "perdido";
export type TipoNegocio = "inicial" | "recompra" | "reativacao";

export interface Negocio {
  id: number;
  telefone: string;
  criado_em: string;
  tipo: TipoNegocio;
  status: StatusNegocio;
  fechado_em: string | null;
  valor: number | null;
  motivo_perda: string | null;
  observacao: string | null;
}

export const ROTULO_TIPO: Record<TipoNegocio, string> = {
  inicial: "Primeira negociação",
  recompra: "Recompra / novo atendimento",
  reativacao: "Reativação",
};

export const ROTULO_STATUS: Record<StatusNegocio, string> = {
  aberto: "Em andamento",
  ganho: "Concretizado",
  perdido: "Perdido",
};

export const COR_STATUS: Record<StatusNegocio, string> = {
  aberto: "#39B7C4",
  ganho: "#2FE58F",
  perdido: "#E05C5C",
};

/** Motivos para marcar uma negociação como perdida (o texto livre complementa). */
export const MOTIVOS_PERDA = [
  "Valor acima do esperado",
  "Parou de responder",
  "Sem interesse no momento",
  "Escolheu outro profissional",
  "Distância ou local",
  "Horário incompatível",
  "Não tem perfil",
  "Outro motivo",
];

export interface MetricasNegocios {
  abertos: number;
  criadosNoPeriodo: number;
  concretizados: number;
  receita: number;
  perdidos: number;
  reativados: number; // negócios de recompra/reativação abertos no período
  conversao: number | null; // concretizados ÷ (concretizados + perdidos)
  motivosPerda: { motivo: string; qtd: number }[];
}

export interface ContatoPendente {
  telefone: string;
  nome: string | null;
  tipo: "recompra" | "reativacao" | "voltou";
  dias: number;
  motivo: string;
}
