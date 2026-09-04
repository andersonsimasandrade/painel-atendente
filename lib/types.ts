export type FunnelStage =
  | "novo"
  | "qualificando"
  | "materiais_enviados"
  | "politica_enviada"
  | "agendado"
  | "roteado"
  | "transferido";

export interface Kpis {
  ativos: number;
  agendados: number;
  conversao: number; // percentual 0..100
  materiais: number;
  followups: number;
  parados: number;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  pctOfTop: number; // % em relação ao topo do funil
  retention: number; // % em relação ao passo anterior
}

export interface StageCount {
  stage: string;
  label: string;
  count: number;
  rank: number;
  color: string;
}

export interface EventRow {
  id: number;
  telefone: string;
  stage: string;
  materiais: string;
  canal: string;
  created_at: string; // ISO
}

export interface DayCount {
  day: string; // ISO date (yyyy-mm-dd)
  count: number;
}

export interface LeadRow {
  nome: string | null;
  telefone: string;
  funnel_stage: string;
  funnel_rank: number;
  ultima_interacao: string | null; // ISO
  followup_count: number;
  preferencia_canal: string | null;
  total_mensagens: number;
  // ── Fase 3 (podem ser NULL) ──────────────────────────────────────────
  lead_ativo: boolean;
  perfil: string | null;
  cidade: string | null;
  uf: string | null;
  cnpj: boolean | null;
  cnpj_numero: string | null; // os 14 dígitos, quando o lead enviou
  marca_atual: string | null;
  // ── Atribuição de anúncio (Fase 4) — origem paga do lead ────────────────
  origem_ad: string | null;
  origem_campanha: string | null;
  fechado: boolean | null;
  valor_fechado: number | null;
  vendedor_slug: string | null; // consultor dono do lead
  primeira_interacao: string | null; // ISO — quando o lead entrou na base
  // Desfecho do atendimento, marcado pelo consultor no painel.
  resultado: ResultadoLead | null; // null = em andamento
  resultado_em: string | null; // ISO
  // Derivados (a partir de ff_eventos) — usados p/ filtrar, não exibidos.
  hasAgendado: boolean;
  hasMateriais: boolean;
}

/** Classificação de desfecho de um lead (Concluir atendimento). */
export type ResultadoLead =
  | "ganho"
  | "em_negociacao"
  | "reuniao_agendada"
  | "sem_retorno"
  | "sem_interesse"
  | "sem_fit"
  | "no_show"
  | "perdido";

/** Perfil completo de UM lead (todos os campos de ff_contatos). */
export interface LeadDetail extends LeadRow {
  last_followup: string | null; // ISO
  resultado_motivo: string | null; // motivo curto do desfecho (ex.: "sem verba")
  valor_investimento: number | null;
  observacoes: string | null;
  data_fechamento: string | null; // ISO
  estagio_conversa: string | null; // etapa auto-declarada pelo bot ([ESTAGIO])
  // Resumo/score gerado por IA (Groq c/ fallback OpenAI), em cache.
  resumo_ia: string | null;
  temperatura_ia: "quente" | "morno" | "frio" | null;
  proxima_acao_ia: string | null;
  resumo_em: string | null; // ISO — quando o resumo foi gerado
}

/** Dados estruturados que a IA extrai da conversa (null = não dito). */
export interface DadosExtraidos {
  perfil: "revendedor" | "profissional" | "consumidor" | "representante" | null;
  cidade: string | null;
  uf: string | null;
  cnpj: boolean | null;
  cnpj_numero: string | null; // os 14 dígitos, só se o lead enviou o número
  marca_atual: string | null;
  investimento: number | null;
}

/** Resultado do resumo IA de uma conversa. */
export interface ResumoIA {
  resumo: string;
  temperatura: "quente" | "morno" | "frio";
  proxima_acao: string;
  dados?: DadosExtraidos | null;
}

/** Um lead na central de Prioridades (já com a análise IA em cache). */
export interface PrioridadeLead {
  telefone: string;
  nome: string | null;
  funnel_stage: string | null;
  perfil: string | null;
  cidade: string | null;
  uf: string | null;
  ultima_interacao: string | null; // ISO
  temperatura: "quente" | "morno" | "frio" | null;
  resumo: string | null;
  proxima_acao: string | null;
  resumo_em: string | null; // ISO
}

// ── Agenda (Fase 1) ────────────────────────────────────────────────────────
export interface Vendedor {
  id: string;
  slug: string;
  nome: string;
  instancia_whatsapp: string;
  fuso: string;
  disponibilidade: { dias: number[]; horarios: string[] };
  ativo: boolean;
}

export interface Slot {
  iso: string; // instante UTC do horário (data_hora)
  hora: string; // "14:00" (BR)
}

export interface SlotDia {
  dataIso: string; // "2026-08-04" (dia SP)
  diaSemana: string; // "TER"
  diaMes: string; // "04/08"
  slots: Slot[];
}

/** Uma mensagem da conversa (n8n_chat_histories), já limpa p/ exibição. */
export interface ConversaMessage {
  id: number;
  role: "human" | "ai";
  text: string;
  /**
   * Origem de uma mensagem de SAÍDA (role 'ai'), lida de
   * message.additional_kwargs.sent_by: 'painel' quando um humano digitou no
   * dashboard; 'celular' quando o consultor mandou pelo WhatsApp do próprio
   * aparelho; 'bot' quando gerada pela IA (sent_by ausente/desconhecido).
   * Mensagens do cliente (role 'human') => null.
   */
  origem: "painel" | "celular" | "bot" | null;
  /** ISO da criação (n8n_chat_histories.created_at). null/ausente nas msgs
   * antigas (anteriores à coluna) — o chat só mostra hora quando presente. */
  created_at?: string | null;
}

/**
 * Mensagem no formato do endpoint de polling ao vivo
 * (GET /api/conversa/[telefone]/messages). `autor` mapeia o LangChain type:
 * 'ai' → 'ia', 'human' → 'humano'. `id` é o n8n_chat_histories.id (monotônico).
 * `via` só é presente quando a saída foi HUMANA: 'painel' (digitada no
 * dashboard) ou 'celular' (o consultor mandou pelo aparelho). Bot => ausente.
 */
export interface LiveMessage {
  id: number;
  autor: "ia" | "humano";
  texto: string;
  via?: "painel" | "celular";
  created_at?: string | null; // ISO; ausente/null nas mensagens antigas
}

/** Uma conversa resumida para o inbox (lista da esquerda em /conversas). */
export interface ConversaResumo {
  telefone: string;
  nome: string | null;
  funnel_stage: string;
  lead_ativo: boolean;
  ultima_interacao: string | null; // ISO
  lastPreview: string | null; // última mensagem limpa, truncada (~60 chars)
  lastAutor: "ia" | "humano" | null;
  aguardando: boolean; // true quando a última mensagem foi do cliente (humano)
  /** Nome do consultor do NÚMERO que atende esta conversa (não do dono do
   *  lead). É o rótulo da prévia: quem de fato falou com a pessoa. */
  consultorNome: string | null;
}

export type ConversasResult =
  | { ok: true; conversas: ConversaResumo[]; generatedAt: string }
  | { ok: false; error: string };

/** Contagem de leads por hora do dia (0–23), fuso America/Sao_Paulo. */
export interface HoraCount {
  hora: number; // 0..23
  count: number;
}

export type HorariosResult =
  | { ok: true; horas: HoraCount[]; total: number }
  | { ok: false; error: string };

/** Métricas escopadas ao período selecionado (Feature 1). */
export interface PeriodStats {
  leadsNovos: number; // ff_contatos com primeira_interacao no intervalo
}

export type PeriodStatsResult =
  | { ok: true; stats: PeriodStats }
  | { ok: false; error: string };

/** Distribuição de perfis (donut do dashboard). */
export interface PerfilCount {
  key: string; // uma das chaves de PERFIL_ORDER (lib/theme.ts), ou 'nao_informado'
  label: string;
  count: number;
  color: string;
}

/** Contagem de leads por UF (barras horizontais do dashboard). */
export interface RegiaoCount {
  uf: string; // sigla ou 'N/D'
  count: number;
}

export interface DashboardData {
  kpis: Kpis;
  funnel: FunnelStep[];
  stageDistribution: StageCount[];
  perfilDistribution: PerfilCount[];
  regiaoDistribution: RegiaoCount[];
  recentEvents: EventRow[];
  volume: DayCount[];
  leads: LeadRow[];
  generatedAt: string; // ISO
}

export type DashboardResult =
  | { ok: true; data: DashboardData }
  | { ok: false; error: string };

/** Filtros aceitos pela lista completa de leads (/leads). */
export interface LeadsQuery {
  filtro?: string; // ativos | agendados | materiais | followups | parados
  busca?: string;
  perfil?: string;
  uf?: string;
  cnpj?: string; // 'sim' | 'nao'
  estagio?: string;
  campanha?: string; // origem_campanha exata
  resultado?: string; // chave de RESULTADO_ORDER | andamento | abertos
  de?: string; // "yyyy-mm-dd" — entrada do lead (primeira_interacao), dia SP
  ate?: string; // "yyyy-mm-dd"
  dono?: string; // vendedor_slug — escopo do consultor (multi-consultor)
}

/** Contagem de leads por cidade (origem geográfica). */
export interface CidadeCount {
  cidade: string;
  uf: string | null;
  count: number;
}

/** Contagem de desfechos dentro do filtro atual (chaves de RESULTADO_ORDER +
 *  'andamento' para quem ainda não tem desfecho). */
export type DesfechoCounts = Record<string, number>;

export type LeadsResult =
  | {
      ok: true;
      leads: LeadRow[];
      total: number; // total de contatos (antes do filtro)
      ufs: string[]; // UFs presentes (para o seletor)
      campanhas: string[]; // campanhas de anúncio presentes (para o seletor)
      porUf: RegiaoCount[]; // origem por estado, DENTRO do filtro atual
      porCidade: CidadeCount[]; // origem por cidade, DENTRO do filtro atual
      desfechos: DesfechoCounts; // desfechos DENTRO do filtro atual
      generatedAt: string;
    }
  | { ok: false; error: string };

/** Anotação manual de um consultor no Lead 360 (ff_notas). */
export interface Nota {
  id: number;
  autor: string | null;
  texto: string;
  criado_em: string; // ISO
}

// ── Indicadores de atendimento humano (/atendimento) ───────────────────────

/** Linha da tabela "por consultor" na janela selecionada. */
export interface ConsultorAtendimento {
  slug: string;
  nome: string;
  respostas: number; // mensagens humanas enviadas (painel + celular)
  leadsAtendidos: number; // leads distintos que receberam resposta humana
  medianaMin: number | null; // mediana do tempo cliente→resposta humana (min)
}

/** Métricas da janela (7/30 dias) calculadas de n8n_chat_histories. */
export interface AtendimentoStats {
  dias: number;
  respostasHumanas: number; // total de msgs humanas na janela
  paresResposta: number; // pares cliente→humano medidos
  medianaMin: number | null; // mediana geral do tempo de resposta humana
  p90Min: number | null; // 90% respondidos em até X min
  transferidos: number; // eventos 'transferido' na janela
  medianaPosTransferMin: number | null; // transferência → 1ª resposta humana
  transferSemResposta: number; // transferidos ainda sem resposta humana
  porConsultor: ConsultorAtendimento[];
}

export type AtendimentoResult =
  | { ok: true; stats: AtendimentoStats; generatedAt: string }
  | { ok: false; error: string };

/** Conversa na fila "esperando resposta agora" (RPC fila_esperando — censo
 *  COMPLETO da base, sem o teto de 200 contatos do inbox). */
export interface EsperaRow {
  telefone: string;
  nome: string | null;
  vendedor_slug: string | null;
  ultima_interacao: string | null; // ISO — última fala do lead
}

export type EsperandoResult =
  | { ok: true; fila: EsperaRow[] }
  | { ok: false; error: string };

export type LeadDetailResult =
  | { ok: true; lead: LeadDetail; eventos: EventRow[] }
  | { ok: true; lead: null } // não encontrado
  | { ok: false; error: string };

/** Horário de funcionamento do bot (fora dele: mensagem de expediente + retoma na abertura). */
export interface HorarioBot {
  ativo: boolean;
  dias: number[]; // 0=dom … 6=sáb
  inicio: string; // "08:00"
  fim: string; // "17:30"
  mensagem: string; // aviso enviado fora do horário (1x por período)
}

/** Config do painel (linha única painel_config). */
export interface PainelConfig {
  atendente_nome: string | null;
  assinar: boolean;
  horario_bot: HorarioBot | null;
  /** Frases que ACORDAM o bot num contato novo (o texto que o botão do anúncio
   *  já manda escrito). Casam por trecho, sem acento e sem caixa. Um lead que
   *  já está ativo é respondido sempre, independente desta lista. */
  gatilhos: string[];
}

/** Atalho de resposta rápida criado pelo atendente. */
export interface RespostaRapida {
  id: string;
  titulo: string;
  corpo: string;
}

/** Retorno dos negócios fechados manualmente (ff_contatos.fechado). */
export interface Retorno {
  fechados: number; // contatos com fechado=true
  receita: number; // Σ valor_fechado
  ticketMedio: number; // receita / fechados (0 se fechados==0)
}

export type RetornoResult =
  | { ok: true; retorno: Retorno }
  | { ok: false; error: string };
