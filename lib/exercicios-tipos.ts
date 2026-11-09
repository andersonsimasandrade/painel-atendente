// Tipos da PRESCRIÇÃO DE EXERCÍCIOS. Arquivo puro: pode ser importado por componentes de cliente.

export interface Exercicio {
  id: string;
  nome: string;
  regiao: string | null;
  instrucoes: string | null;
  video_url: string | null;
  series: number | null;
  repeticoes: string | null;
  frequencia: string | null;
  observacao: string | null;
  modelo: boolean;
  ativo: boolean;
}

export interface ItemPrescricao {
  exercicio_id: string | null;
  nome: string;
  instrucoes: string | null;
  video_url: string | null;
  series: number | null;
  repeticoes: string | null;
  frequencia: string | null;
  observacao: string | null;
}

export interface CheckinPrescricao {
  id: string;
  dias_feitos: number | null;
  dor: number | null;
  comentario: string | null;
  criado_em: string;
}

export interface Prescricao {
  id: string;
  codigo: string;
  titulo: string;
  orientacoes: string | null;
  ativa: boolean;
  criado_em: string;
  enviado_em: string | null;
  itens: ItemPrescricao[];
  checkins: CheckinPrescricao[];
}

/** Vídeo do YouTube → endereço de "embed" (para tocar dentro da página). Outros links viram botão. */
export function videoEmbed(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export const MENSAGEM_PRESCRICAO = (primeiroNome: string | null, link: string) =>
  `Olá${primeiroNome ? `, ${primeiroNome}` : ""}! Segue o seu plano de exercícios para fazer em casa:\n${link}\n\n` +
  "Assista aos vídeos e faça no seu ritmo, sem forçar a dor. Se sentir algo diferente do esperado, me avise por aqui. " +
  "Depois, conte como foi a semana pelo próprio link. 🙂";
