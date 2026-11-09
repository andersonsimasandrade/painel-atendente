// Tipos e rótulos do PRONTUÁRIO do paciente. Arquivo puro: pode ser importado por componentes de cliente.

export type TipoExame = "ressonancia" | "raio_x" | "ultrassom" | "tomografia" | "laudo" | "outro";

export const ROTULO_EXAME: Record<TipoExame, string> = {
  ressonancia: "Ressonância magnética",
  raio_x: "Raio-X",
  ultrassom: "Ultrassom",
  tomografia: "Tomografia",
  laudo: "Laudo / relatório",
  outro: "Outro exame",
};

export interface Exame {
  id: string;
  titulo: string;
  tipo: TipoExame;
  data_exame: string | null; // AAAA-MM-DD
  link_url: string | null;
  tem_arquivo: boolean;
  arquivo_nome: string | null;
  arquivo_mime: string | null;
  laudo_texto: string | null;
  resumo: string | null;
  resumo_por_ia: boolean;
  criado_em: string;
}

export interface Evolucao {
  id: string;
  agendamento_id: string | null;
  data_sessao: string; // AAAA-MM-DD
  queixa: string | null;
  achados: string | null;
  conduta: string | null;
  plano: string | null;
  dor_inicio: number | null;
  dor_fim: number | null;
  criado_em: string;
}

/** Arquivos aceitos no prontuário (PDF e imagens), até 15 MB cada. */
export const MIMES_EXAME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const LIMITE_ARQUIVO_MB = 15;
