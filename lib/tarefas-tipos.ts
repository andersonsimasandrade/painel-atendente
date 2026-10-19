// Tipos e textos das tarefas (arquivo PURO: pode ser importado pela tela do navegador).

export type TipoTarefa =
  | "retorno_prometido"
  | "negociacao"
  | "pos_sessao"
  | "reavaliacao"
  | "avaliacao_google"
  | "indicacao"
  | "reativacao"
  | "manual";
export type StatusTarefa = "sugerida" | "aprovada" | "executada" | "descartada";
export type CanalTarefa = "whatsapp" | "instagram" | "ligacao" | "presencial";

export interface Checagem {
  faz_sentido: boolean;
  resumo: string;
  novas_mensagens: number;
  em: string;
}

export interface Tarefa {
  id: number;
  criado_em: string;
  chave: string | null;
  telefone: string | null;
  ig_id: string | null;
  nome: string | null;
  tipo: TipoTarefa;
  origem: "manual" | "conversa" | "playbook";
  titulo: string;
  motivo: string | null;
  canal: CanalTarefa;
  mensagem: string | null;
  devida_em: string;
  status: StatusTarefa;
  aprovada_em: string | null;
  executada_em: string | null;
  resultado: string | null;
  checagem: Checagem | null;
  checada_em: string | null;
  auto_envio: boolean;
}

export const TIPOS: Record<TipoTarefa, { label: string; emoji: string; dica: string }> = {
  retorno_prometido: {
    label: "Retorno combinado",
    emoji: "📞",
    dica: "A pessoa disse que ia dar uma resposta. Retome no dia combinado, com leveza: lembre o que ficou combinado e pergunte como ficou para ela. Não pressione; se ela pedir mais tempo, combine uma nova data e anote.",
  },
  negociacao: {
    label: "Continuar negociação",
    emoji: "🤝",
    dica: "Quem conversou e não agendou. Primeiro contato (2 dias): tirar dúvida e oferecer horário. Segundo (5 dias): lembrar o que a sessão inclui (avaliação + técnicas, 60 min) e perguntar o que está pesando. Terceiro (10 dias): despedida gentil deixando a porta aberta. Se o assunto for valor, pergunte a expectativa e valorize o atendimento, sem prometer resultado nem oferecer desconto sem decidir.",
  },
  pos_sessao: {
    label: "Cuidado após a sessão",
    emoji: "💬",
    dica: "No dia seguinte à sessão: perguntar como a pessoa está e se ficou alguma dúvida. É cuidado, não venda. Se ela relatar algo diferente do esperado, o Anderson responde pessoalmente. Não dê orientação clínica por mensagem.",
  },
  reavaliacao: {
    label: "Reavaliação / continuidade",
    emoji: "🩺",
    dica: "Uma semana depois: convidar para uma nova sessão em que o Anderson reavalia o quadro e define a continuidade. Fale em 'acompanhar a evolução', sem prometer resultado nem número de sessões.",
  },
  avaliacao_google: {
    label: "Pedir avaliação no Google",
    emoji: "⭐",
    dica: "Peça a TODOS que passaram por atendimento (não só aos que elogiaram: o Google proíbe filtrar quem recebe o pedido). Agradeça, mande o link e diga que é sem compromisso. Nunca ofereça desconto ou brinde em troca da avaliação.",
  },
  indicacao: {
    label: "Pedir indicação",
    emoji: "🫶",
    dica: "Um mês depois: agradecer a confiança e dizer que, se a pessoa conhece alguém que precise de cuidado com fisioterapia, pode passar o contato do Anderson. Sem recompensa em troca (confirme as regras do CREFITO antes de criar qualquer benefício).",
  },
  reativacao: {
    label: "Retomar contato",
    emoji: "🔁",
    dica: "Paciente que sumiu depois de se tratar. Pergunte como está e se quer agendar uma reavaliação. Uma tentativa, sem insistir.",
  },
  manual: {
    label: "Tarefa",
    emoji: "📝",
    dica: "Tarefa criada por você. Defina o objetivo, o canal e o horário.",
  },
};

