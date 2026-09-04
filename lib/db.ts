import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  CidadeCount,
  ConversaMessage,
  ConversaResumo,
  ConversasResult,
  DashboardData,
  DashboardResult,
  DayCount,
  DesfechoCounts,
  EsperandoResult,
  EsperaRow,
  EventRow,
  FunnelStep,
  HoraCount,
  HorariosResult,
  Kpis,
  LeadDetail,
  LeadDetailResult,
  LeadRow,
  LeadsQuery,
  LeadsResult,
  LiveMessage,
  Nota,
  PerfilCount,
  PainelConfig,
  PeriodStatsResult,
  PrioridadeLead,
  RegiaoCount,
  RespostaRapida,
  ResultadoLead,
  RetornoResult,
  StageCount,
} from "./types";
import {
  FUNNEL_STEPS,
  PERFIL_NONE,
  PERFIL_ORDER,
  perfilMeta,
  RESULTADO_ORDER,
  resultadoTerminal,
  STAGE_MAP,
  STAGE_ORDER,
} from "./theme";
import { cleanAiMessage, cleanHumanMessage, cleanHumanOutMessage } from "./format";
import { rangeBoundsIso, spHour } from "./periodo";
import { variantesTelefone } from "./telefone";

// ── Cliente Supabase (singleton, lazy, SOMENTE no servidor) ───────────────
// Usa a chave service_role, que ignora o RLS. Ela é server-only: nunca vai
// para o navegador, porque este módulo só é importado por Server Components e
// route handlers. Não existe fallback para a chave anon — no banco do kit as
// tabelas têm RLS ligado e nenhuma policy, então a anon não leria nada e o
// painel abriria vazio "funcionando", que é o pior dos mundos.
import { envObrigatoria } from "./config";

let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = envObrigatoria("SUPABASE_URL", process.env.SUPABASE_URL);
  const key = envObrigatoria(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ── Tipos das linhas cruas retornadas pela REST API ──────────────────────
interface ContatoRaw {
  telefone: string | null;
  nome: string | null;
  preferencia_canal: string | null;
  total_mensagens: number | null;
  primeira_interacao: string | null;
  ultima_interacao: string | null;
  lead_ativo: boolean | null;
  funnel_stage: string | null;
  funnel_rank: number | null;
  followup_count: number | null;
  last_followup: string | null;
  // ── Fase 3 (podem ser NULL) ──────────────────────────────────────────
  perfil: string | null;
  cidade: string | null;
  uf: string | null;
  cnpj: boolean | null;
  cnpj_numero: string | null;
  marca_atual: string | null;
  valor_investimento: number | string | null;
  observacoes: string | null;
  origem_ad: string | null;
  origem_campanha: string | null;
  fechado: boolean | null;
  valor_fechado: number | string | null;
  data_fechamento: string | null;
  estagio_conversa: string | null;
  resumo_ia: string | null;
  temperatura_ia: string | null;
  proxima_acao_ia: string | null;
  resumo_em: string | null;
  vendedor_slug: string | null; // dono do lead (multi-consultor)
  resultado: string | null; // desfecho do atendimento (chave de RESULTADO_ORDER)
  resultado_motivo: string | null;
  resultado_em: string | null;
}

interface EventoRaw {
  id: number | string | null;
  telefone: string | null;
  stage: string | null;
  materiais: string | null;
  canal: string | null;
  created_at: string | null;
}

// Colunas de ff_contatos lidas em todas as consultas (dashboard + /leads).
const CONTATO_COLS =
  "telefone, nome, preferencia_canal, total_mensagens, primeira_interacao, ultima_interacao, lead_ativo, funnel_stage, funnel_rank, followup_count, last_followup, perfil, cidade, uf, cnpj, cnpj_numero, marca_atual, valor_investimento, observacoes, origem_ad, origem_campanha, fechado, valor_fechado, data_fechamento, estagio_conversa, resumo_ia, temperatura_ia, proxima_acao_ia, resumo_em, vendedor_slug, resultado, resultado_motivo, resultado_em";

// ── Helpers ──────────────────────────────────────────────────────────────
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Numérico opcional: preserva NULL (não vira 0). Aceita string do Postgres.
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

// Texto opcional aparado: string vazia -> null.
const strOrNull = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

// UF normalizada em 2 letras maiúsculas, ou null.
const ufOrNull = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
};

// Temperatura do lead (resumo IA): só aceita quente/morno/frio, senão null.
const normalizaTemp = (v: unknown): "quente" | "morno" | "frio" | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "quente" || s === "morno" || s === "frio" ? s : null;
};

// Desfecho do atendimento: só as chaves do vocabulário (theme.RESULTADO_ORDER),
// senão null (em andamento).
export const RESULTADOS: ResultadoLead[] = RESULTADO_ORDER.map(
  (r) => r.key as ResultadoLead,
);
const normalizaResultado = (v: unknown): ResultadoLead | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return (RESULTADOS as string[]).includes(s) ? (s as ResultadoLead) : null;
};

// Dia local em São Paulo ("yyyy-mm-dd") de um instante ISO — p/ filtro por data.
const spDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const spDayKey = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : spDayFmt.format(d);
};

const toIso = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const dayKeyLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const hasRank = (r: ContatoRaw): r is ContatoRaw & { funnel_rank: number } =>
  typeof r.funnel_rank === "number";

// "Agendados" preciso: leads distintos que chegaram ao passo de agenda
// (evento stage='agendado'). NÃO inclui quem só foi transferido (rank 5),
// que a contagem por rank>=4 pegava indevidamente.
const agendadoReach = (eventos: EventoRaw[]): number =>
  new Set(
    eventos
      .filter((e) => e.stage === "agendado" && e.telefone)
      .map((e) => e.telefone as string),
  ).size;

// Telefones que alcançaram o evento de agenda (stage='agendado').
const agendadoTelefones = (eventos: EventoRaw[]): Set<string> =>
  new Set(
    eventos
      .filter((e) => e.stage === "agendado" && e.telefone)
      .map((e) => e.telefone as string),
  );

// Telefones que receberam algum material (ff_eventos.materiais não-vazio).
const materiaisTelefones = (eventos: EventoRaw[]): Set<string> =>
  new Set(
    eventos
      .filter((e) => e.telefone && e.materiais && e.materiais.trim() !== "")
      .map((e) => e.telefone as string),
  );

// Mapeia um contato cru + conjuntos derivados para a linha de lead exibível.
function toLeadRow(
  c: ContatoRaw,
  agSet: Set<string>,
  matSet: Set<string>,
): LeadRow {
  const tel = c.telefone ?? "";
  return {
    nome: strOrNull(c.nome),
    telefone: tel,
    funnel_stage: c.funnel_stage ?? "novo",
    funnel_rank: num(c.funnel_rank),
    ultima_interacao: toIso(c.ultima_interacao),
    followup_count: num(c.followup_count),
    preferencia_canal: strOrNull(c.preferencia_canal),
    total_mensagens: num(c.total_mensagens),
    lead_ativo: c.lead_ativo === true,
    perfil: strOrNull(c.perfil),
    cidade: strOrNull(c.cidade),
    uf: ufOrNull(c.uf),
    cnpj: typeof c.cnpj === "boolean" ? c.cnpj : null,
    cnpj_numero: strOrNull(c.cnpj_numero),
    marca_atual: strOrNull(c.marca_atual),
    origem_ad: strOrNull(c.origem_ad),
    origem_campanha: strOrNull(c.origem_campanha),
    fechado: typeof c.fechado === "boolean" ? c.fechado : null,
    valor_fechado: numOrNull(c.valor_fechado),
    vendedor_slug: strOrNull(c.vendedor_slug),
    primeira_interacao: toIso(c.primeira_interacao),
    resultado: normalizaResultado(c.resultado),
    resultado_em: toIso(c.resultado_em),
    hasAgendado: agSet.has(tel),
    hasMateriais: matSet.has(tel),
  };
}

// ── Agregações em JS (dados pequenos) ────────────────────────────────────
function buildKpis(contatos: ContatoRaw[], eventos: EventoRaw[], now: number): Kpis {
  const dayMs = 24 * 60 * 60 * 1000;

  let ativos = 0;
  let followups = 0;
  let parados = 0;

  for (const c of contatos) {
    if (c.lead_ativo === true) ativos++;
    followups += num(c.followup_count);

    if (c.lead_ativo === true) {
      const t = c.ultima_interacao ? new Date(c.ultima_interacao).getTime() : NaN;
      const stale = !Number.isNaN(t) && now - t > dayMs;
      const terminal = c.funnel_stage === "agendado" || c.funnel_stage === "transferido";
      if (stale && !terminal) parados++;
    }
  }

  const materiais = eventos.reduce(
    (acc, e) => acc + (e.materiais && e.materiais.trim() !== "" ? 1 : 0),
    0,
  );

  const agendados = agendadoReach(eventos);

  const conversao = ativos > 0 ? Math.min((agendados / ativos) * 100, 100) : 0;

  return { ativos, agendados, conversao, materiais, followups, parados };
}

function buildFunnel(contatos: ContatoRaw[], eventos: EventoRaw[]): FunnelStep[] {
  const countRankGte = (k: number) =>
    contatos.reduce((acc, c) => acc + (hasRank(c) && c.funnel_rank >= k ? 1 : 0), 0);

  const counts: Record<string, number> = {
    novo: countRankGte(0),
    qualificando: countRankGte(1),
    materiais_enviados: countRankGte(2),
    politica_enviada: countRankGte(3),
    agendado: agendadoReach(eventos),
  };

  const top = counts[FUNNEL_STEPS[0].key] || 0;
  let prev = top;

  return FUNNEL_STEPS.map((step, i) => {
    const count = counts[step.key] ?? 0;
    const pctOfTop = top > 0 ? (count / top) * 100 : 0;
    const retention = i === 0 ? 100 : prev > 0 ? (count / prev) * 100 : 0;
    prev = count;
    return { key: step.key, label: step.label, count, pctOfTop, retention };
  });
}

function buildStageDistribution(contatos: ContatoRaw[]): StageCount[] {
  const byStage = new Map<string, number>();
  for (const c of contatos) {
    const key = c.funnel_stage ?? "";
    byStage.set(key, (byStage.get(key) ?? 0) + 1);
  }
  const fixas = STAGE_ORDER.map((s) => ({
    stage: s.key,
    label: s.label,
    count: byStage.get(s.key) ?? 0,
    rank: s.rank,
    color: s.color,
  }));
  // Etapas PERSONALIZADAS (funil_etapas) também aparecem — sem isso os leads
  // movidos pra elas sumiam da distribuição.
  const conhecidas = new Set(STAGE_ORDER.map((s) => s.key));
  const extras = [...byStage.entries()]
    .filter(([k, n]) => k && n > 0 && !conhecidas.has(k))
    .map(([k, n]) => ({
      stage: k,
      label: k.replace(/_/g, " ").replace(/^\w/, (ch) => ch.toUpperCase()),
      count: n,
      rank: 2,
      color: "#8D9A93",
    }))
    .sort((a, b) => b.count - a.count);
  return [...fixas, ...extras];
}

function buildRecentEvents(eventos: EventoRaw[]): EventRow[] {
  // `eventos` já vem ordenado por created_at desc.
  return eventos.slice(0, 30).map((e, i) => ({
    id: e.id != null ? num(e.id) : i + 1,
    telefone: e.telefone ?? "",
    stage: e.stage ?? "",
    materiais: e.materiais ?? "",
    canal: e.canal ?? "",
    created_at: toIso(e.created_at) ?? "",
  }));
}

function buildVolume(eventos: EventoRaw[], now: number): DayCount[] {
  const map = new Map<string, number>();
  for (const e of eventos) {
    const iso = toIso(e.created_at);
    if (!iso) continue;
    const key = dayKeyLocal(new Date(iso));
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const out: DayCount[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKeyLocal(d);
    out.push({ day: key, count: map.get(key) ?? 0 });
  }
  return out;
}

function buildLeads(
  contatos: ContatoRaw[],
  agSet: Set<string>,
  matSet: Set<string>,
): LeadRow[] {
  return contatos
    .filter((c) => c.lead_ativo === true)
    .sort((a, b) => {
      const ta = a.ultima_interacao ? Date.parse(a.ultima_interacao) : -Infinity;
      const tb = b.ultima_interacao ? Date.parse(b.ultima_interacao) : -Infinity;
      return tb - ta; // desc, nulos por último
    })
    .slice(0, 100)
    .map((c) => toLeadRow(c, agSet, matSet));
}

// Donut de perfis: distribuição entre os leads ATIVOS. Nulos são agrupados
// em "Não informado" para não sumir da visão.
function buildPerfilDistribution(contatos: ContatoRaw[]): PerfilCount[] {
  const counts = new Map<string, number>();
  for (const c of contatos) {
    if (c.lead_ativo !== true) continue;
    const key = strOrNull(c.perfil) ?? PERFIL_NONE.key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const ordered: PerfilCount[] = PERFIL_ORDER.map((p) => ({
    key: p.key,
    label: p.label,
    count: counts.get(p.key) ?? 0,
    color: p.color,
  }));

  // perfis fora da lista canônica (defensivo) + o bucket "não informado"
  for (const [key, count] of counts) {
    if (PERFIL_ORDER.some((p) => p.key === key)) continue;
    const meta = perfilMeta(key);
    ordered.push({ key: meta.key, label: meta.label, count, color: meta.color });
  }

  return ordered.filter((p) => p.count > 0);
}

// Barras por UF: leads ativos agrupados por estado (desc). UF ausente -> "N/D".
function buildRegiao(contatos: ContatoRaw[]): RegiaoCount[] {
  const counts = new Map<string, number>();
  for (const c of contatos) {
    if (c.lead_ativo !== true) continue;
    const uf = ufOrNull(c.uf) ?? "N/D";
    counts.set(uf, (counts.get(uf) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([uf, count]) => ({ uf, count }))
    .sort((a, b) => {
      if (a.uf === "N/D") return 1; // "N/D" sempre por último
      if (b.uf === "N/D") return -1;
      return b.count - a.count || a.uf.localeCompare(b.uf);
    })
    .slice(0, 10);
}

// ── Orquestrador ─────────────────────────────────────────────────────────
export async function getDashboardData(): Promise<DashboardResult> {
  try {
    const supabase = getClient();

    const [contatosRes, eventosRes] = await Promise.all([
      supabase.from("ff_contatos").select(CONTATO_COLS),
      supabase
        .from("ff_eventos")
        .select("id, telefone, stage, materiais, canal, created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    if (contatosRes.error) throw new Error(contatosRes.error.message);
    if (eventosRes.error) throw new Error(eventosRes.error.message);

    const contatos = (contatosRes.data ?? []) as unknown as ContatoRaw[];
    const eventos = (eventosRes.data ?? []) as EventoRaw[];
    const now = Date.now();

    const agSet = agendadoTelefones(eventos);
    const matSet = materiaisTelefones(eventos);

    const data: DashboardData = {
      kpis: buildKpis(contatos, eventos, now),
      funnel: buildFunnel(contatos, eventos),
      stageDistribution: buildStageDistribution(contatos),
      perfilDistribution: buildPerfilDistribution(contatos),
      regiaoDistribution: buildRegiao(contatos),
      recentEvents: buildRecentEvents(eventos),
      volume: buildVolume(eventos, now),
      leads: buildLeads(contatos, agSet, matSet),
      generatedAt: new Date(now).toISOString(),
    };
    return { ok: true, data };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao consultar o Supabase";
    return { ok: false, error: message };
  }
}

// ── Lista completa de leads (/leads) — busca tudo, filtra em JS ────────────
export async function getLeads(opts: LeadsQuery = {}): Promise<LeadsResult> {
  try {
    const supabase = getClient();

    // Escopo por dono (multi-consultor): filtra no BANCO, não em JS — assim o
    // lead de outro consultor nem sai do Postgres.
    let contatosQ = supabase
      .from("ff_contatos")
      .select(CONTATO_COLS)
      .order("ultima_interacao", { ascending: false, nullsFirst: false })
      .limit(20000);
    if (opts.dono) contatosQ = contatosQ.eq("vendedor_slug", opts.dono);

    const [contatosRes, eventosRes] = await Promise.all([
      // order + limit explícitos: sem eles o PostgREST corta na "Max rows" com
      // ordem instável, truncando lista/total/campanhas silenciosamente. Traz
      // os mais recentes primeiro (mesma ordem final da lista).
      contatosQ,
      supabase.from("ff_eventos").select("telefone, stage, materiais").limit(20000),
    ]);

    if (contatosRes.error) throw new Error(contatosRes.error.message);
    if (eventosRes.error) throw new Error(eventosRes.error.message);

    const contatos = (contatosRes.data ?? []) as unknown as ContatoRaw[];
    const eventos = (eventosRes.data ?? []) as EventoRaw[];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const agSet = agendadoTelefones(eventos);
    const matSet = materiaisTelefones(eventos);

    const all = contatos.map((c) => toLeadRow(c, agSet, matSet));

    // UFs presentes, para popular o seletor de estado.
    const ufs = [...new Set(all.map((l) => l.uf).filter((x): x is string => !!x))].sort();
    // Campanhas de anúncio presentes, para popular o seletor de origem.
    const campanhas = [
      ...new Set(all.map((l) => l.origem_campanha).filter((x): x is string => !!x)),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));

    // Normaliza os filtros recebidos pela querystring.
    const filtro = (opts.filtro || "").toLowerCase();
    const busca = (opts.busca || "").trim().toLowerCase();
    const buscaDigits = busca.replace(/\D/g, "");
    const perfil = (opts.perfil || "").trim().toLowerCase();
    const uf = (opts.uf || "").trim().toUpperCase();
    const cnpj = (opts.cnpj || "").trim().toLowerCase();
    const estagio = (opts.estagio || "").trim().toLowerCase();
    const campanha = (opts.campanha || "").trim();
    const resultado = (opts.resultado || "").trim().toLowerCase();
    // Datas "yyyy-mm-dd" (dia SP) sobre a ENTRADA do lead (primeira_interacao).
    const deDia = /^\d{4}-\d{2}-\d{2}$/.test(opts.de ?? "") ? (opts.de as string) : "";
    const ateDia = /^\d{4}-\d{2}-\d{2}$/.test(opts.ate ?? "") ? (opts.ate as string) : "";

    const leads = all.filter((l) => {
      // Situação (mesma semântica dos KPIs).
      if (filtro === "ativos" && !l.lead_ativo) return false;
      if (filtro === "agendados" && !l.hasAgendado) return false;
      if (filtro === "materiais" && !l.hasMateriais) return false;
      if (filtro === "followups" && !(l.followup_count > 0)) return false;
      if (filtro === "parados") {
        const t = l.ultima_interacao ? Date.parse(l.ultima_interacao) : NaN;
        const stale = !Number.isNaN(t) && now - t > dayMs;
        const terminal =
          l.funnel_stage === "agendado" || l.funnel_stage === "transferido";
        if (!(l.lead_ativo && stale && !terminal)) return false;
      }

      // Busca: nome OU telefone.
      if (busca) {
        const nome = (l.nome ?? "").toLowerCase();
        const telDigits = l.telefone.replace(/\D/g, "");
        const matchNome = nome.includes(busca);
        const matchTel = buscaDigits.length >= 2 && telDigits.includes(buscaDigits);
        if (!matchNome && !matchTel) return false;
      }

      if (perfil && (l.perfil ?? "").toLowerCase() !== perfil) return false;
      if (uf && (l.uf ?? "") !== uf) return false;
      if (cnpj === "sim" && l.cnpj !== true) return false;
      if (cnpj === "nao" && l.cnpj === true) return false;
      if (estagio && l.funnel_stage !== estagio) return false;
      if (campanha && (l.origem_campanha ?? "") !== campanha) return false;

      // Desfecho: 'andamento' = sem classificação; 'abertos' = sem desfecho OU
      // desfecho não-terminal (espelho do que o kanban mostra por padrão).
      if (resultado === "andamento" && l.resultado !== null) return false;
      if (resultado === "abertos" && resultadoTerminal(l.resultado)) return false;
      if (
        resultado &&
        resultado !== "andamento" &&
        resultado !== "abertos" &&
        l.resultado !== resultado
      )
        return false;

      // Período de ENTRADA (dia SP, comparação lexicográfica de "yyyy-mm-dd").
      if (deDia || ateDia) {
        const dia = spDayKey(l.primeira_interacao);
        if (!dia) return false;
        if (deDia && dia < deDia) return false;
        if (ateDia && dia > ateDia) return false;
      }

      return true;
    });

    leads.sort((a, b) => {
      const ta = a.ultima_interacao ? Date.parse(a.ultima_interacao) : -Infinity;
      const tb = b.ultima_interacao ? Date.parse(b.ultima_interacao) : -Infinity;
      return tb - ta; // desc, nulos por último
    });

    // Origem geográfica e desfechos DENTRO do filtro atual (o time mede
    // "de onde está entrando mais lead" combinando isso com o filtro de data).
    const ufCounts = new Map<string, number>();
    const cidadeCounts = new Map<string, { cidade: string; uf: string | null; count: number }>();
    const desfechos: DesfechoCounts = Object.fromEntries([
      ...RESULTADO_ORDER.map((r) => [r.key, 0]),
      ["andamento", 0],
    ]);
    for (const l of leads) {
      const u = l.uf ?? "N/D";
      ufCounts.set(u, (ufCounts.get(u) ?? 0) + 1);
      if (l.cidade) {
        const k = `${l.cidade.toLowerCase()}|${l.uf ?? ""}`;
        const cur = cidadeCounts.get(k);
        if (cur) cur.count++;
        else cidadeCounts.set(k, { cidade: l.cidade, uf: l.uf, count: 1 });
      }
      if (l.resultado) desfechos[l.resultado]++;
      else desfechos.andamento++;
    }
    const porUf: RegiaoCount[] = [...ufCounts.entries()]
      .map(([u, count]) => ({ uf: u, count }))
      .sort((a, b) => b.count - a.count);
    const porCidade: CidadeCount[] = [...cidadeCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      ok: true,
      leads,
      total: all.length,
      ufs,
      campanhas,
      porUf,
      porCidade,
      desfechos,
      generatedAt: new Date(now).toISOString(),
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao consultar o Supabase";
    return { ok: false, error: message };
  }
}

// ── Lead 360 — perfil completo + linha do tempo de eventos ─────────────────
export async function getLead(telefone: string): Promise<LeadDetailResult> {
  try {
    const supabase = getClient();

    const [contatoRes, eventosRes] = await Promise.all([
      supabase.from("ff_contatos").select(CONTATO_COLS).eq("telefone", telefone).limit(1),
      supabase
        .from("ff_eventos")
        .select("id, telefone, stage, materiais, canal, created_at")
        .eq("telefone", telefone)
        .order("created_at", { ascending: true })
        .limit(500),
    ]);

    if (contatoRes.error) throw new Error(contatoRes.error.message);
    if (eventosRes.error) throw new Error(eventosRes.error.message);

    const rows = (contatoRes.data ?? []) as unknown as ContatoRaw[];
    if (!rows.length) return { ok: true, lead: null };

    const c = rows[0];
    const eventos = (eventosRes.data ?? []) as EventoRaw[];
    const agSet = agendadoTelefones(eventos);
    const matSet = materiaisTelefones(eventos);
    const base = toLeadRow(c, agSet, matSet);

    const lead: LeadDetail = {
      ...base, // já traz origem_ad / origem_campanha / resultado (via toLeadRow)
      resultado_motivo: strOrNull(c.resultado_motivo),
      last_followup: toIso(c.last_followup),
      valor_investimento: numOrNull(c.valor_investimento),
      observacoes: strOrNull(c.observacoes),
      data_fechamento: toIso(c.data_fechamento),
      estagio_conversa: strOrNull(c.estagio_conversa),
      resumo_ia: strOrNull(c.resumo_ia),
      temperatura_ia: normalizaTemp(c.temperatura_ia),
      proxima_acao_ia: strOrNull(c.proxima_acao_ia),
      resumo_em: toIso(c.resumo_em),
    };

    const eventoRows: EventRow[] = eventos.map((e, i) => ({
      id: e.id != null ? num(e.id) : i + 1,
      telefone: e.telefone ?? "",
      stage: e.stage ?? "",
      materiais: e.materiais ?? "",
      canal: e.canal ?? "",
      created_at: toIso(e.created_at) ?? "",
    }));

    return { ok: true, lead, eventos: eventoRows };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao consultar o Supabase";
    return { ok: false, error: message };
  }
}

// Grava o resumo/score IA no cache (ff_contatos).
export async function setResumoLead(
  telefone: string,
  r: { resumo: string; temperatura: string; proxima_acao: string },
): Promise<{ ok: true; resumo_em: string } | { ok: false; error: string }> {
  try {
    const supabase = getClient();
    const resumo_em = new Date().toISOString();
    const res = await supabase
      .from("ff_contatos")
      .update({
        resumo_ia: r.resumo,
        temperatura_ia: r.temperatura,
        proxima_acao_ia: r.proxima_acao,
        resumo_em,
      })
      .eq("telefone", telefone)
      .select("telefone");
    if (res.error) throw new Error(res.error.message);
    // UPDATE que casa 0 linhas NÃO é erro no PostgREST — trata como falha real
    // (senão reportaria persisted:true sem ter gravado nada).
    if (!res.data || res.data.length === 0) {
      return { ok: false, error: "Lead não encontrado para salvar o resumo." };
    }
    return { ok: true, resumo_em };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar o resumo." };
  }
}

// ── Prioridades / análises em lote ─────────────────────────────────────────

// Leads ATIVOS que mudaram desde a última análise (ou nunca analisados).
// (PostgREST não compara duas colunas direto — filtramos em código.)
export async function getLeadsParaAnalise(
  limit = 25,
): Promise<{ telefone: string; nome: string | null }[]> {
  try {
    const supabase = getClient();
    const res = await supabase
      .from("ff_contatos")
      .select("telefone, nome, ultima_interacao, resumo_em")
      .eq("lead_ativo", true)
      // nunca-analisados (resumo_em NULL) primeiro, pra não ficarem de fora do
      // teto de 300 conforme a base cresce; depois por recência.
      .order("resumo_em", { ascending: true, nullsFirst: true })
      .order("ultima_interacao", { ascending: false })
      .limit(300);
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as {
      telefone: string;
      nome: string | null;
      ultima_interacao: string | null;
      resumo_em: string | null;
    }[];
    const pend = rows.filter((r) => {
      if (!r.resumo_em) return true; // nunca analisado
      if (!r.ultima_interacao) return false;
      return new Date(r.ultima_interacao).getTime() > new Date(r.resumo_em).getTime();
    });
    return pend.slice(0, limit).map((r) => ({ telefone: r.telefone, nome: r.nome }));
  } catch (e) {
    console.error("[getLeadsParaAnalise]", e);
    return [];
  }
}

// Leads ativos priorizados p/ a central (quente > morno > frio, depois recência).
export async function getPrioridades(dono?: string): Promise<PrioridadeLead[]> {
  try {
    const supabase = getClient();
    let q = supabase
      .from("ff_contatos")
      .select(
        "telefone, nome, funnel_stage, perfil, cidade, uf, ultima_interacao, temperatura_ia, resumo_ia, proxima_acao_ia, resumo_em",
      )
      .eq("lead_ativo", true)
      .order("ultima_interacao", { ascending: false })
      .limit(300);
    if (dono) q = q.eq("vendedor_slug", dono); // escopo do consultor
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as Record<string, unknown>[];
    const rank = (t: string | null) => (t === "quente" ? 0 : t === "morno" ? 1 : t === "frio" ? 2 : 3);
    const out: PrioridadeLead[] = rows.map((r) => ({
      telefone: String(r.telefone ?? ""),
      nome: strOrNull(r.nome as string | null),
      funnel_stage: (r.funnel_stage as string | null) ?? null,
      perfil: strOrNull(r.perfil as string | null),
      cidade: strOrNull(r.cidade as string | null),
      uf: ufOrNull(r.uf as string | null),
      ultima_interacao: toIso(r.ultima_interacao as string | null),
      temperatura: normalizaTemp(r.temperatura_ia),
      resumo: strOrNull(r.resumo_ia as string | null),
      proxima_acao: strOrNull(r.proxima_acao_ia as string | null),
      resumo_em: toIso(r.resumo_em as string | null),
    }));
    out.sort((a, b) => {
      const d = rank(a.temperatura) - rank(b.temperatura);
      if (d !== 0) return d;
      return (b.ultima_interacao ?? "").localeCompare(a.ultima_interacao ?? "");
    });
    return out;
  } catch (e) {
    console.error("[getPrioridades]", e);
    return [];
  }
}

// `dono` = escopo do plano: '' é o plano GLOBAL (visão do admin); um slug de
// consultor é o plano daquela pessoa. Sem essa separação, o plano da IA citava
// nome e resumo de leads de outro consultor na tela de quem não podia ver.
export async function getPlanoAcao(dono = ""): Promise<{
  plano: string | null;
  gerado_em: string | null;
  leads_analisados: number;
}> {
  try {
    const supabase = getClient();
    const res = await supabase
      .from("prioridades_meta")
      .select("plano, gerado_em, leads_analisados")
      .eq("dono", dono)
      .limit(1);
    if (res.error) throw new Error(res.error.message);
    const row = (res.data?.[0] ?? {}) as {
      plano?: string | null;
      gerado_em?: string | null;
      leads_analisados?: number | null;
    };
    return {
      plano: strOrNull(row.plano),
      gerado_em: toIso(row.gerado_em),
      leads_analisados: num(row.leads_analisados),
    };
  } catch {
    return { plano: null, gerado_em: null, leads_analisados: 0 };
  }
}

export async function setPlanoAcao(
  plano: string,
  leadsAnalisados: number,
  dono = "",
): Promise<void> {
  try {
    const supabase = getClient();
    await supabase.from("prioridades_meta").upsert(
      { dono, plano, gerado_em: new Date().toISOString(), leads_analisados: leadsAnalisados },
      { onConflict: "dono" },
    );
  } catch (e) {
    console.error("[setPlanoAcao]", e);
  }
}

// ── Conversa (n8n_chat_histories) — leitura + limpeza p/ exibição ──────────
interface HistRaw {
  id: number | string | null;
  message: unknown;
  created_at?: string | null;
}

// O n8n grava cada turno com session_id === telefone (o número cru, ex.:
// "551188887777") — mas às vezes na variante sem o nono dígito; por isso as
// leituras sempre casam via variantesTelefone.

/**
 * Sessão REAL do histórico, tolerando o nono dígito: o bot grava a forma que o
 * WhatsApp entrega (às vezes sem o 9) e os formulários gravam a digitada (com).
 * Sem isso a conversa se parte em duas e o painel mostra só metade.
 * Escolhe a variante que já tem histórico; cai na recebida se nenhuma tiver.
 */
async function sessionIdReal(telefone: string): Promise<string> {
  const vs = variantesTelefone(telefone);
  if (vs.length <= 1) return vs[0] ?? telefone;
  try {
    const res = await getClient()
      .from("n8n_chat_histories")
      .select("session_id")
      .in("session_id", vs)
      .limit(1);
    const achado = (res.data?.[0] as { session_id?: string } | undefined)?.session_id;
    return achado || vs[0];
  } catch {
    return vs[0];
  }
}

// Busca linhas de n8n_chat_histories da sessão, em ordem crescente de id
// (a tabela não tem coluna de timestamp — id é monotônico). Quando `after` é
// informado, traz apenas id > after (delta incremental).
async function fetchHistoryRows(
  telefone: string,
  after: number | null,
): Promise<HistRaw[]> {
  const supabase = getClient();
  let q = supabase
    .from("n8n_chat_histories")
    .select("id, message, created_at")
    // Une as duas formas do número (com/sem o 9) numa conversa só.
    .in("session_id", variantesTelefone(telefone))
    .order("id", { ascending: true })
    .limit(2000);
  if (after != null && after > 0) q = q.gt("id", after);
  const res = await q;
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as unknown as HistRaw[];
}

// Limpa UMA linha crua para exibição. Devolve null quando a mensagem deve ser
// descartada (tipo desconhecido, ou texto vazio após remover tags/cabeçalhos).
function cleanHistRow(r: HistRaw, fallbackId: number): ConversaMessage | null {
  let m = r.message;
  // jsonb normalmente já vem parseado; se vier como string, parseia.
  if (typeof m === "string") {
    try {
      m = JSON.parse(m);
    } catch {
      return null;
    }
  }
  if (!m || typeof m !== "object") return null;

  const obj = m as { type?: unknown; content?: unknown; additional_kwargs?: unknown };
  const type = obj.type === "ai" || obj.type === "human" ? obj.type : null;
  if (!type) return null;

  const rawContent =
    typeof obj.content === "string"
      ? obj.content
      : obj.content == null
        ? ""
        : String(obj.content);

  // A origem é decidida ANTES do texto: quem escreveu determina como limpar.
  // 'painel' = humano digitou aqui; 'celular' = o consultor mandou pelo
  // WhatsApp do aparelho dele; 'bot' = gerada pela IA (sent_by ausente ou
  // desconhecido). Mensagem do cliente => null.
  const kwargs =
    obj.additional_kwargs && typeof obj.additional_kwargs === "object"
      ? (obj.additional_kwargs as { sent_by?: unknown })
      : null;
  const sentBy =
    typeof kwargs?.sent_by === "string" ? kwargs.sent_by.trim().toLowerCase() : "";
  const origem: "painel" | "celular" | "bot" | null =
    type !== "ai"
      ? null
      : sentBy === "painel"
        ? "painel"
        : sentBy === "celular"
          ? "celular"
          : "bot";

  // cleanAiMessage é sanitizador da saída do BOT: além do cabeçalho CANAL: e da
  // assinatura, ele apaga QUALQUER [colchete] da linha. Texto escrito por gente
  // não pode passar por ali — "te mando o preço [amanhã]" perderia o "[amanhã]",
  // e uma mensagem que ficasse vazia seria descartada logo abaixo, sumindo do
  // painel sem aviso.
  const text =
    type === "human"
      ? cleanHumanMessage(rawContent)
      : origem === "bot"
        ? cleanAiMessage(rawContent)
        : cleanHumanOutMessage(rawContent);
  if (!text) return null; // pula mensagens vazias após a limpeza (ex.: só tags)

  return {
    id: r.id != null ? num(r.id) : fallbackId,
    role: type,
    text,
    origem,
    created_at: toIso(r.created_at),
  };
}

/** Conversa completa (WhatsApp), já limpa, ordenada por id. */
export async function getConversa(telefone: string): Promise<ConversaMessage[]> {
  try {
    const rows = await fetchHistoryRows(telefone, null);
    const out: ConversaMessage[] = [];
    for (const r of rows) {
      const msg = cleanHistRow(r, out.length + 1);
      if (msg) out.push(msg);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Delta ao vivo da conversa: mensagens com id > `after`, já limpas e no formato
 * do endpoint de polling ({ id, autor, texto }). Nunca expõe session_id nem as
 * tags internas de orquestração.
 */
export async function getConversaDelta(
  telefone: string,
  after: number,
): Promise<LiveMessage[]> {
  const rows = await fetchHistoryRows(telefone, after);
  const out: LiveMessage[] = [];
  for (const r of rows) {
    const msg = cleanHistRow(r, after + out.length + 1);
    if (!msg) continue;
    out.push({
      id: msg.id,
      autor: msg.role === "ai" ? "ia" : "humano",
      texto: msg.text,
      created_at: msg.created_at,
      ...(msg.origem === "painel" || msg.origem === "celular"
        ? { via: msg.origem }
        : {}),
    });
  }
  return out;
}

// ── Inbox (Conversas) — lista de conversas recentes p/ o painel ────────────
// Bounds EXPLÍCITOS (o codebase já teve bug por depender do cap implícito do
// PostgREST):
//  • ff_contatos: os 200 contatos mais recentes por ultima_interacao (desc).
//  • n8n_chat_histories: os ~3000 ids mais altos (recorte recente global). A
//    partir dele reduzimos, em JS, à última mensagem LIMPA por session_id.
// Como ambas as consultas priorizam o mais recente, as conversas do topo do
// inbox têm sua última mensagem dentro do recorte. Uma sessão sem NENHUMA
// mensagem limpa dentro do recorte não entra na lista.
const CONVERSAS_CONTATOS_LIMIT = 200;
const CONVERSAS_HIST_LIMIT = 3000;

interface HistSessionRaw {
  id: number | string | null;
  session_id: string | null;
  message: unknown;
}

interface ContatoInboxRaw {
  telefone: string | null;
  nome: string | null;
  funnel_stage: string | null;
  lead_ativo: boolean | null;
  ultima_interacao: string | null;
  atendido_em: string | null;
  nao_lido: boolean | null;
  vendedor_slug: string | null; // dono (first-touch)
  ultima_instancia: string | null; // canal que recebeu a última mensagem
}

interface VendedorInboxRaw {
  slug: string | null;
  nome: string | null;
  instancia_whatsapp: string | null;
}

/**
 * "Aguardando resposta" combina o automático com o manual:
 *  • nao_lido = true  → sempre aguardando (o operador marcou p/ voltar depois);
 *  • senão, aguarda se a ÚLTIMA mensagem foi do lead E ninguém marcou como lida
 *    depois dela (atendido_em < ultima_interacao). Assim, marcar como lida
 *    silencia até o lead falar de novo — igual ao WhatsApp.
 */
function calcAguardando(
  ultimaAutor: "ia" | "humano",
  ultimaInteracao: string | null,
  atendidoEm: string | null,
  naoLido: boolean,
): boolean {
  if (naoLido) return true;
  if (ultimaAutor !== "humano") return false;
  if (!atendidoEm) return true;
  const at = Date.parse(atendidoEm);
  const ui = ultimaInteracao ? Date.parse(ultimaInteracao) : NaN;
  if (!Number.isFinite(at)) return true;
  if (!Number.isFinite(ui)) return false; // marcada como lida e sem hora nova
  return ui > at; // lead falou depois da leitura → volta a aguardar
}

const truncPreview = (s: string, n = 60): string =>
  s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;

export async function getConversas(dono?: string): Promise<ConversasResult> {
  try {
    const supabase = getClient();

    // Escopo por dono (multi-consultor) aplicado no banco.
    let contatosQ = supabase
      .from("ff_contatos")
      .select(
        "telefone, nome, funnel_stage, lead_ativo, ultima_interacao, atendido_em, nao_lido, vendedor_slug, ultima_instancia",
      )
      .order("ultima_interacao", { ascending: false, nullsFirst: false })
      .limit(CONVERSAS_CONTATOS_LIMIT);
    if (dono) contatosQ = contatosQ.eq("vendedor_slug", dono);

    const [contatosRes, histRes, vendRes] = await Promise.all([
      contatosQ,
      supabase
        .from("n8n_chat_histories")
        .select("id, session_id, message")
        .order("id", { ascending: false })
        .limit(CONVERSAS_HIST_LIMIT),
      supabase.from("vendedores").select("slug, nome, instancia_whatsapp"),
    ]);

    if (contatosRes.error) throw new Error(contatosRes.error.message);
    if (histRes.error) throw new Error(histRes.error.message);
    // Falha ao ler vendedores não derruba o inbox: a prévia só perde o rótulo.
    const vendedores = (vendRes.error ? [] : (vendRes.data ?? [])) as unknown as VendedorInboxRaw[];
    const nomePorInstancia = new Map<string, string>();
    const nomePorSlug = new Map<string, string>();
    for (const v of vendedores) {
      if (v.instancia_whatsapp && v.nome) nomePorInstancia.set(v.instancia_whatsapp, v.nome);
      if (v.slug && v.nome) nomePorSlug.set(v.slug, v.nome);
    }

    const contatos = (contatosRes.data ?? []) as unknown as ContatoInboxRaw[];
    const histRows = (histRes.data ?? []) as unknown as HistSessionRaw[];

    // Reduz o recorte (id desc) à última mensagem LIMPA por session_id: como as
    // linhas vêm da mais nova p/ a mais antiga, a primeira linha limpável de
    // cada sessão é a mais recente dela.
    const previewBySession = new Map<
      string,
      { autor: "ia" | "humano"; texto: string }
    >();
    for (const r of histRows) {
      const sid = String(r.session_id ?? "").trim();
      if (!sid || previewBySession.has(sid)) continue;
      const msg = cleanHistRow({ id: r.id, message: r.message }, 0);
      if (!msg) continue; // linha só com tags/vazia → tenta a próxima da sessão
      previewBySession.set(sid, {
        autor: msg.role === "ai" ? "ia" : "humano",
        texto: msg.text,
      });
    }

    // Fallback: contatos do top-N cuja última mensagem ficou FORA do recorte de
    // CONVERSAS_HIST_LIMIT não podem sumir do inbox — busca dirigida (bounded)
    // da última mensagem limpa deles.
    // Tolera o nono dígito: o contato pode ter o histórico gravado na OUTRA
    // variante do número (ver telefone.ts) — sem isso ele some do inbox.
    const temPreview = (tel: string): boolean =>
      variantesTelefone(tel).some((v) => previewBySession.has(v));
    const faltando = contatos
      .map((c) => (c.telefone ?? "").trim())
      .filter((t) => t && !temPreview(t));
    if (faltando.length) {
      const extraRes = await supabase
        .from("n8n_chat_histories")
        .select("id, session_id, message")
        .in("session_id", faltando.flatMap((t) => variantesTelefone(t)))
        .order("id", { ascending: false })
        .limit(Math.min(faltando.length * 25, 5000));
      if (!extraRes.error) {
        for (const r of (extraRes.data ?? []) as unknown as HistSessionRaw[]) {
          const sid = String(r.session_id ?? "").trim();
          if (!sid || previewBySession.has(sid)) continue;
          const msg = cleanHistRow({ id: r.id, message: r.message }, 0);
          if (!msg) continue;
          previewBySession.set(sid, {
            autor: msg.role === "ai" ? "ia" : "humano",
            texto: msg.text,
          });
        }
      }
    }

    const now = Date.now();
    const conversas: ConversaResumo[] = [];
    for (const c of contatos) {
      const tel = (c.telefone ?? "").trim();
      if (!tel) continue;
      const preview = variantesTelefone(tel)
        .map((v) => previewBySession.get(v))
        .find(Boolean);
      if (!preview) continue; // sem mensagem limpa no recorte → fora do inbox
      conversas.push({
        telefone: tel,
        nome: strOrNull(c.nome),
        funnel_stage: c.funnel_stage ?? "novo",
        lead_ativo: c.lead_ativo === true,
        ultima_interacao: toIso(c.ultima_interacao),
        lastPreview: truncPreview(preview.texto),
        lastAutor: preview.autor,
        aguardando: calcAguardando(
          preview.autor,
          toIso(c.ultima_interacao),
          toIso(c.atendido_em),
          c.nao_lido === true,
        ),
        // Quem falou é o CANAL (número que recebeu a última mensagem); o dono
        // do lead é só o fallback pra conversa que ainda não tem canal gravado.
        consultorNome:
          (c.ultima_instancia ? nomePorInstancia.get(c.ultima_instancia) : undefined) ??
          (c.vendedor_slug ? nomePorSlug.get(c.vendedor_slug) : undefined) ??
          null,
      });
    }
    // `contatos` já vem ordenado por ultima_interacao desc → `conversas` idem.

    return { ok: true, conversas, generatedAt: new Date(now).toISOString() };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao consultar o Supabase";
    return { ok: false, error: message };
  }
}

/**
 * Fila "esperando resposta agora" — censo COMPLETO da base via RPC
 * fila_esperando (SQL no Postgres), sem o teto de 200 contatos do inbox.
 * A RPC replica calcAguardando: nao_lido, OU última mensagem do lead sem
 * leitura posterior. EXECUTE é restrito ao service_role.
 */
export async function getEsperando(dono?: string): Promise<EsperandoResult> {
  try {
    const res = await getClient().rpc("fila_esperando", { p_dono: dono ?? null });
    if (res.error) throw new Error(res.error.message);
    const fila: EsperaRow[] = ((res.data ?? []) as {
      telefone: string | null;
      nome: string | null;
      vendedor_slug: string | null;
      ultima_interacao: string | null;
    }[])
      .filter((r) => r.telefone)
      .map((r) => ({
        telefone: r.telefone as string,
        nome: strOrNull(r.nome),
        vendedor_slug: strOrNull(r.vendedor_slug),
        ultima_interacao: toIso(r.ultima_interacao),
      }));
    return { ok: true, fila };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao consultar a fila de espera",
    };
  }
}

/**
 * Registra no n8n_chat_histories uma mensagem enviada pelo PAINEL (agente
 * humano). Grava como type:'ai' com additional_kwargs.sent_by:'painel' para
 * (1) aparecer como "Você" na conversa e (2) manter a continuidade da memória
 * do bot. Retorna o id atribuído quando possível (para reconciliar a bolha
 * otimista no cliente). Usa a service_role (server-only).
 */
export async function inserirMensagemPainel(
  telefone: string,
  texto: string,
): Promise<{ ok: true; id: number | null } | { ok: false; error: string }> {
  try {
    const supabase = getClient();
    const row = {
      // Grava na sessão que JÁ tem o histórico (não cria conversa paralela).
      session_id: await sessionIdReal(telefone),
      message: {
        type: "ai",
        content: texto,
        tool_calls: [],
        additional_kwargs: { sent_by: "painel" },
        response_metadata: {},
        invalid_tool_calls: [],
      },
    };
    const res = await supabase
      .from("n8n_chat_histories")
      .insert(row)
      .select("id")
      .single();
    if (res.error) throw new Error(res.error.message);
    const rawId = (res.data as { id?: unknown } | null)?.id;
    return { ok: true, id: rawId == null ? null : num(rawId) };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao registrar a mensagem do painel";
    return { ok: false, error: message };
  }
}

// ── Config do painel (nome do atendente + assinatura) ──────────────────────
export async function getPainelConfig(): Promise<PainelConfig> {
  try {
    const supabase = getClient();
    const res = await supabase
      .from("painel_config")
      .select("atendente_nome, assinar, gatilhos, horario_bot")
      .eq("id", 1)
      .limit(1);
    if (res.error) throw new Error(res.error.message);
    const row = (res.data?.[0] ?? {}) as {
      atendente_nome?: string | null;
      assinar?: boolean | null;
      gatilhos?: unknown;
      horario_bot?: unknown;
    };
    const hb = row.horario_bot as Partial<import("./types").HorarioBot> | null | undefined;
    return {
      atendente_nome: strOrNull(row.atendente_nome),
      assinar: row.assinar !== false,
      gatilhos: Array.isArray(row.gatilhos)
        ? row.gatilhos.map((g) => String(g)).filter((g) => g.trim())
        : [],
      horario_bot:
        hb && typeof hb === "object"
          ? {
              ativo: hb.ativo === true,
              dias: Array.isArray(hb.dias) ? hb.dias.map(Number).filter((d) => d >= 0 && d <= 6) : [1, 2, 3, 4, 5, 6],
              inicio: typeof hb.inicio === "string" ? hb.inicio : "08:00",
              fim: typeof hb.fim === "string" ? hb.fim : "17:30",
              mensagem: typeof hb.mensagem === "string" ? hb.mensagem : "",
            }
          : null,
    };
  } catch {
    return { atendente_nome: null, assinar: true, gatilhos: [], horario_bot: null };
  }
}

export async function setPainelConfig(
  patch: {
    atendente_nome?: string | null;
    assinar?: boolean;
    gatilhos?: string[];
    horario_bot?: import("./types").HorarioBot;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getClient();
    // upsert (não update): se a linha id=1 não existir, um UPDATE casaria 0
    // linhas e retornaria sucesso silencioso (nada persistido). O upsert
    // garante a linha única. Chave AUSENTE do patch fica intocada — a seção
    // Horário não apaga o Atendente e vice-versa.
    const res = await supabase.from("painel_config").upsert(
      {
        id: 1,
        ...(patch.atendente_nome !== undefined
          ? { atendente_nome: strOrNull(patch.atendente_nome) }
          : {}),
        ...(patch.assinar !== undefined ? { assinar: patch.assinar } : {}),
        ...(patch.gatilhos ? { gatilhos: patch.gatilhos } : {}),
        ...(patch.horario_bot ? { horario_bot: patch.horario_bot } : {}),
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar a config." };
  }
}

// ── Backfill de dados extraídos pela IA do resumo ──────────────────────────
/**
 * Preenche em ff_contatos APENAS os campos ainda vazios com o que a IA
 * extraiu da conversa. Dado coletado pelo bot (tags) SEMPRE vence — aqui só
 * entra onde está NULL/vazio. Retorna a lista de campos preenchidos.
 */
export async function backfillDadosLead(
  telefone: string,
  dados: import("./types").DadosExtraidos,
): Promise<string[]> {
  try {
    const supabase = getClient();
    const atual = await supabase
      .from("ff_contatos")
      .select(
        "perfil, cidade, uf, cnpj, cnpj_numero, marca_atual, valor_investimento, campos_manuais",
      )
      .eq("telefone", telefone)
      .limit(1);
    if (atual.error || !atual.data?.length) return [];
    const c = atual.data[0] as {
      perfil: string | null;
      cidade: string | null;
      uf: string | null;
      cnpj: boolean | null;
      cnpj_numero: string | null;
      marca_atual: string | null;
      valor_investimento: number | string | null;
      campos_manuais: string[] | null;
    };
    // Campo que o HUMANO editou (inclusive limpou) a IA nunca mais toca.
    const manual = new Set(c.campos_manuais ?? []);
    const patch: Record<string, unknown> = {};
    const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
    if (dados.perfil && vazio(c.perfil) && !manual.has("perfil")) patch.perfil = dados.perfil;
    if (dados.cidade && vazio(c.cidade) && !manual.has("cidade")) patch.cidade = dados.cidade;
    if (dados.uf && vazio(c.uf) && !manual.has("uf")) patch.uf = dados.uf;
    if (dados.cnpj !== null && c.cnpj === null) patch.cnpj = dados.cnpj;
    if (dados.cnpj_numero && vazio(c.cnpj_numero)) {
      patch.cnpj_numero = dados.cnpj_numero;
      if (c.cnpj === null) patch.cnpj = true; // mandou o número = tem CNPJ
    }
    if (dados.marca_atual && vazio(c.marca_atual) && !manual.has("marca_atual"))
      patch.marca_atual = dados.marca_atual;
    if (dados.investimento && vazio(c.valor_investimento) && !manual.has("valor_investimento"))
      patch.valor_investimento = dados.investimento;
    if (!Object.keys(patch).length) return [];
    const res = await supabase.from("ff_contatos").update(patch).eq("telefone", telefone);
    if (res.error) return [];
    return Object.keys(patch);
  } catch {
    return [];
  }
}

// ── Respostas rápidas (atalhos criados pelo atendente) ─────────────────────
export async function getRespostasRapidas(): Promise<RespostaRapida[]> {
  try {
    const supabase = getClient();
    const res = await supabase
      .from("respostas_rapidas")
      .select("id, titulo, corpo")
      .order("created_at", { ascending: true })
      .limit(200);
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as RespostaRapida[]).map((r) => ({
      id: String(r.id),
      titulo: r.titulo ?? "",
      corpo: r.corpo ?? "",
    }));
  } catch {
    return [];
  }
}

export async function addRespostaRapida(
  titulo: string,
  corpo: string,
): Promise<{ ok: true; resposta: RespostaRapida } | { ok: false; error: string }> {
  try {
    const supabase = getClient();
    const res = await supabase
      .from("respostas_rapidas")
      .insert({ titulo: titulo.trim().slice(0, 80), corpo: corpo.trim().slice(0, 2000) })
      .select("id, titulo, corpo")
      .single();
    if (res.error) throw new Error(res.error.message);
    const r = res.data as RespostaRapida;
    return { ok: true, resposta: { id: String(r.id), titulo: r.titulo, corpo: r.corpo } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar o atalho." };
  }
}

export async function removeRespostaRapida(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getClient();
    const res = await supabase.from("respostas_rapidas").delete().eq("id", id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao remover o atalho." };
  }
}

// ── Retorno — negócios fechados manualmente (ROI) ──────────────────────────
interface RetornoRaw {
  fechado: boolean | null;
  valor_fechado: number | string | null;
}

/**
 * Retorno dos negócios fechados. Quando `desde`/`ate` são informados (Feature
 * 1), escopa por data_fechamento no intervalo [desde, ate] (fuso SP). Sem
 * argumentos, considera todos os fechados (all-time).
 */
export async function getRetorno(desde?: string, ate?: string): Promise<RetornoResult> {
  try {
    const supabase = getClient();
    let q = supabase.from("ff_contatos").select("fechado, valor_fechado, data_fechamento");
    if (desde && ate) {
      const { desdeIso, ateIso } = rangeBoundsIso(desde, ate);
      q = q.gte("data_fechamento", desdeIso).lte("data_fechamento", ateIso);
    }
    const res = await q;
    if (res.error) throw new Error(res.error.message);

    const rows = (res.data ?? []) as unknown as RetornoRaw[];

    let fechados = 0;
    let receita = 0;
    for (const r of rows) {
      if (r.fechado === true) {
        fechados++;
        receita += num(r.valor_fechado);
      }
    }
    const ticketMedio = fechados > 0 ? receita / fechados : 0;

    return { ok: true, retorno: { fechados, receita, ticketMedio } };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao consultar o Supabase";
    return { ok: false, error: message };
  }
}

// ── Métricas escopadas ao período (Feature 1) ─────────────────────────────
/** Leads NOVOS no período: ff_contatos com primeira_interacao em [desde, ate]. */
export async function getPeriodStats(
  desde: string,
  ate: string,
): Promise<PeriodStatsResult> {
  try {
    const supabase = getClient();
    const { desdeIso, ateIso } = rangeBoundsIso(desde, ate);
    const res = await supabase
      .from("ff_contatos")
      .select("telefone", { count: "exact", head: true })
      .gte("primeira_interacao", desdeIso)
      .lte("primeira_interacao", ateIso);
    if (res.error) throw new Error(res.error.message);
    return { ok: true, stats: { leadsNovos: res.count ?? 0 } };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao consultar o Supabase";
    return { ok: false, error: message };
  }
}

// ── Melhores horários (Feature 4) ─────────────────────────────────────────
interface PrimeiraRaw {
  primeira_interacao: string | null;
}

/**
 * Histograma de leads por hora do dia (0–23) a partir de
 * ff_contatos.primeira_interacao, dentro do intervalo [desde, ate].
 * A hora é calculada em America/Sao_Paulo (UTC-3) em JS, via spHour(): o
 * timestamptz é deslocado -3h e lê-se a hora UTC resultante — coerente com o
 * fuso usado no resto do painel. Sempre devolve os 24 buckets (0..23).
 */
export async function getMelhoresHorarios(
  desde: string,
  ate: string,
): Promise<HorariosResult> {
  try {
    const supabase = getClient();
    const { desdeIso, ateIso } = rangeBoundsIso(desde, ate);
    const res = await supabase
      .from("ff_contatos")
      .select("primeira_interacao")
      .gte("primeira_interacao", desdeIso)
      .lte("primeira_interacao", ateIso)
      .limit(20000);
    if (res.error) throw new Error(res.error.message);

    const rows = (res.data ?? []) as unknown as PrimeiraRaw[];
    const buckets = new Array<number>(24).fill(0);
    let total = 0;
    for (const r of rows) {
      const h = spHour(r.primeira_interacao);
      if (h >= 0 && h <= 23) {
        buckets[h]++;
        total++;
      }
    }

    const horas: HoraCount[] = buckets.map((count, hora) => ({ hora, count }));
    return { ok: true, horas, total };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao consultar o Supabase";
    return { ok: false, error: message };
  }
}

// Marca (ou desfaz) o fechamento de UM contato. Usa a service_role (server).
/**
 * Renomeia o contato pelo painel. O bot também grava nome (tag [NOME:]), mas o
 * humano tem a última palavra — aqui é UPDATE direto, sem COALESCE.
 * Nome vazio volta o lead a "sem nome" (null), não string vazia.
 */
export async function setNomeLead(
  telefone: string,
  nome: string,
): Promise<{ ok: boolean; error?: string }> {
  const limpo = String(nome ?? "").trim().slice(0, 80);
  try {
    const res = await getClient()
      .from("ff_contatos")
      .update({ nome: limpo || null })
      .in("telefone", variantesTelefone(telefone))
      .select("telefone");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Lead não encontrado." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao renomear." };
  }
}

/**
 * Marca a conversa como lida (silencia o "aguardando" até o lead falar de novo)
 * ou como NÃO lida (força o destaque, mesmo se você foi o último a falar).
 */
export async function setLidaConversa(
  telefone: string,
  lida: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const patch = lida
      ? { atendido_em: new Date().toISOString(), nao_lido: false }
      : { atendido_em: null, nao_lido: true };
    const res = await getClient()
      .from("ff_contatos")
      .update(patch)
      .in("telefone", variantesTelefone(telefone))
      .select("telefone");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Lead não encontrado." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao marcar." };
  }
}

/**
 * Ajuste MANUAL da etapa do funil, feito pelo operador no painel. Grava também
 * um evento na linha do tempo (canal 'painel') para ficar registrado que a
 * mudança foi humana — e não do bot.
 */
export async function setEstagioManual(
  telefone: string,
  stage: string,
): Promise<{ ok: boolean; error?: string }> {
  const alvo = String(stage ?? "").trim();
  if (!alvo) return { ok: false, error: "Etapa inválida." };
  try {
    const supabase = getClient();
    // Etapas DINÂMICAS (funil_etapas, personalizáveis pelo admin); se a tabela
    // falhar, cai no mapa fixo das 7 de fábrica pra não travar o painel.
    let rank: number | null = null;
    const et = await supabase
      .from("funil_etapas")
      .select("key, rank")
      .eq("key", alvo)
      .limit(1);
    if (!et.error && et.data?.length) {
      rank = num((et.data[0] as { rank: unknown }).rank);
    } else if (et.error) {
      // tabela inacessível → cai nas 7 de fábrica
      rank = STAGE_MAP[alvo]?.rank ?? null;
    } else {
      // tabela ok mas a chave não existe: só é válido se a tabela estiver
      // VAZIA (instalação sem seed) e a chave for de fábrica — senão inválida
      const total = await supabase
        .from("funil_etapas")
        .select("key", { count: "exact", head: true });
      rank = (total.count ?? 0) === 0 ? STAGE_MAP[alvo]?.rank ?? null : null;
    }
    if (rank == null) return { ok: false, error: "Etapa inválida." };

    const res = await supabase
      .from("ff_contatos")
      .update({ funnel_stage: alvo, funnel_rank: rank })
      .in("telefone", variantesTelefone(telefone))
      .select("telefone");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Lead não encontrado." };

    // Evento p/ a linha do tempo (best-effort — não desfaz a mudança).
    try {
      const telReal = (res.data[0] as { telefone: string }).telefone;
      await supabase.from("ff_eventos").insert({
        telefone: telReal,
        stage: alvo,
        canal: "painel",
      });
    } catch (e) {
      console.error("[setEstagioManual] evento:", e);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao mudar a etapa." };
  }
}

export async function setLeadFechado(
  telefone: string,
  valor: number | null,
  desfazer: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getClient();
    const payload = desfazer
      ? { fechado: false, valor_fechado: null, data_fechamento: null }
      : {
          fechado: true,
          valor_fechado: valor,
          data_fechamento: new Date().toISOString(),
        };

    const res = await supabase.from("ff_contatos").update(payload).eq("telefone", telefone);
    if (res.error) throw new Error(res.error.message);

    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao atualizar o contato";
    return { ok: false, error: message };
  }
}

/**
 * Desfecho do atendimento (Concluir): qualquer chave de RESULTADO_ORDER
 * (lib/theme) + motivo curto. resultado null = desfazer (volta a "em andamento").
 */
export async function setResultadoLead(
  telefone: string,
  resultado: string | null,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = normalizaResultado(resultado);
  if (resultado && !r) return { ok: false, error: "Desfecho inválido." };
  try {
    const payload = r
      ? {
          resultado: r,
          resultado_motivo: String(motivo ?? "").trim().slice(0, 200) || null,
          resultado_em: new Date().toISOString(),
        }
      : { resultado: null, resultado_motivo: null, resultado_em: null };
    const res = await getClient()
      .from("ff_contatos")
      .update(payload)
      .in("telefone", variantesTelefone(telefone))
      .select("telefone");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Lead não encontrado." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao concluir." };
  }
}

/** Categoria (perfil) ajustada MANUALMENTE pelo operador. "" = Indefinido. */
export async function setPerfilManual(
  telefone: string,
  perfil: string,
): Promise<{ ok: boolean; error?: string }> {
  const limpo = String(perfil ?? "").trim().toLowerCase();
  if (limpo && !PERFIL_ORDER.some((p) => p.key === limpo)) {
    return { ok: false, error: "Categoria inválida." };
  }
  try {
    const supabase = getClient();
    const variantes = variantesTelefone(telefone);
    const atual = await supabase
      .from("ff_contatos")
      .select("campos_manuais")
      .in("telefone", variantes)
      .limit(1);
    const manuais = unirCamposManuais(
      (atual.data?.[0] as { campos_manuais?: string[] } | undefined)?.campos_manuais,
      ["perfil"],
    );
    const res = await supabase
      .from("ff_contatos")
      .update({ perfil: limpo || null, campos_manuais: manuais })
      .in("telefone", variantes)
      .select("telefone");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Lead não encontrado." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao categorizar." };
  }
}

// Marca colunas como "editadas à mão" (ff_contatos.campos_manuais): o
// backfill da IA passa a respeitá-las pra sempre (inclusive limpezas).
// Read-merge-write simples — o painel é o único escritor desse campo.
function unirCamposManuais(
  atuais: string[] | null | undefined,
  novos: string[],
): string[] {
  return [...new Set([...(atuais ?? []), ...novos])];
}

/**
 * Campos comerciais editados à mão no Lead 360:
 * investimento previsto, marca atual e origem (origem_campanha). Só toca o
 * que veio no patch; string vazia limpa o campo. O que o humano editar (ou
 * limpar) fica marcado em campos_manuais — a IA não re-preenche depois.
 */
export async function setDadosLead(
  telefone: string,
  patch: { investimento?: number | null; marca?: string | null; origem?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const upd: Record<string, unknown> = {};
  const tocados: string[] = [];
  if ("investimento" in patch) {
    const v = patch.investimento;
    if (v != null && (!Number.isFinite(v) || v < 0 || v > 100_000_000)) {
      return { ok: false, error: "Valor de investimento inválido." };
    }
    upd.valor_investimento = v ?? null;
    tocados.push("valor_investimento");
  }
  if ("marca" in patch) {
    upd.marca_atual = String(patch.marca ?? "").trim().slice(0, 80) || null;
    tocados.push("marca_atual");
  }
  if ("origem" in patch) {
    upd.origem_campanha = String(patch.origem ?? "").trim().slice(0, 120) || null;
    tocados.push("origem_campanha");
  }
  if (!Object.keys(upd).length) return { ok: true };
  try {
    const supabase = getClient();
    const variantes = variantesTelefone(telefone);
    const atualRes = await supabase
      .from("ff_contatos")
      .select("origem_campanha, origem_ad, campos_manuais")
      .in("telefone", variantes)
      .limit(1);
    if (atualRes.error) return { ok: false, error: atualRes.error.message };
    const atual = (atualRes.data?.[0] ?? null) as {
      origem_campanha: string | null;
      origem_ad: string | null;
      campos_manuais: string[] | null;
    } | null;
    if (!atual) return { ok: false, error: "Lead não encontrado." };

    if ("origem" in patch) {
      const novaOrigem = upd.origem_campanha as string | null;
      if (novaOrigem === null) {
        // Limpar = "orgânico/direto" de verdade: some também o selo do anúncio.
        upd.origem_ad = null;
      } else if (
        /^\d{6,}$/.test(atual.origem_campanha ?? "") &&
        !(atual.origem_ad ?? "").trim()
      ) {
        // Preserva o ad_id da Meta antes de sobrescrever com texto humano —
        // o CAC por campanha (tráfego) continua achando este lead.
        upd.origem_ad = atual.origem_campanha;
      }
    }

    upd.campos_manuais = unirCamposManuais(atual.campos_manuais, tocados);

    const res = await supabase
      .from("ff_contatos")
      .update(upd)
      .in("telefone", variantes)
      .select("telefone");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Lead não encontrado." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

/** Cidade/UF editadas no painel (o time preenche o que a IA não pegou). */
export async function setLocalLead(
  telefone: string,
  cidade: string,
  uf: string,
): Promise<{ ok: boolean; error?: string }> {
  const cidadeLimpa = String(cidade ?? "").trim().slice(0, 80);
  const ufLimpa = String(uf ?? "").trim().toUpperCase();
  if (ufLimpa && !/^[A-Z]{2}$/.test(ufLimpa)) {
    return { ok: false, error: "UF deve ter 2 letras (ex.: RS)." };
  }
  try {
    const supabase = getClient();
    const variantes = variantesTelefone(telefone);
    const atual = await supabase
      .from("ff_contatos")
      .select("campos_manuais")
      .in("telefone", variantes)
      .limit(1);
    const manuais = unirCamposManuais(
      (atual.data?.[0] as { campos_manuais?: string[] } | undefined)?.campos_manuais,
      ["cidade", "uf"],
    );
    const res = await supabase
      .from("ff_contatos")
      .update({ cidade: cidadeLimpa || null, uf: ufLimpa || null, campos_manuais: manuais })
      .in("telefone", variantes)
      .select("telefone");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Lead não encontrado." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar o local." };
  }
}

// ── Anotações manuais do consultor (ff_notas) ──────────────────────────────
export async function getNotas(telefone: string): Promise<Nota[]> {
  try {
    const res = await getClient()
      .from("ff_notas")
      .select("id, autor, texto, criado_em")
      .in("telefone", variantesTelefone(telefone))
      .order("criado_em", { ascending: false })
      .limit(100);
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as { id: unknown; autor: string | null; texto: string | null; criado_em: string | null }[])
      .map((n) => ({
        id: num(n.id),
        autor: strOrNull(n.autor),
        texto: String(n.texto ?? ""),
        criado_em: toIso(n.criado_em) ?? "",
      }))
      .filter((n) => n.texto.trim() !== "");
  } catch (e) {
    console.error("[getNotas]", e);
    return [];
  }
}

export async function addNota(
  telefone: string,
  autor: string,
  texto: string,
): Promise<{ ok: boolean; error?: string }> {
  const t = String(texto ?? "").trim().slice(0, 2000);
  if (!t) return { ok: false, error: "Escreva a anotação." };
  try {
    // Grava no telefone como está em ff_contatos (variante real do banco).
    const alvoRes = await getClient()
      .from("ff_contatos")
      .select("telefone")
      .in("telefone", variantesTelefone(telefone))
      .limit(1);
    const alvo =
      (alvoRes.data?.[0] as { telefone?: string } | undefined)?.telefone ?? telefone;
    const res = await getClient()
      .from("ff_notas")
      .insert({ telefone: alvo, autor: String(autor ?? "").trim().slice(0, 60) || null, texto: t });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao anotar." };
  }
}

export async function removeNota(
  telefone: string,
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Nota inválida." };
  try {
    // Escopo: a nota precisa pertencer a ESTE lead (rota já validou o lead).
    const res = await getClient()
      .from("ff_notas")
      .delete()
      .eq("id", id)
      .in("telefone", variantesTelefone(telefone))
      .select("id");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Nota não encontrada." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao excluir." };
  }
}
