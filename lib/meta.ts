// Integração com a Graph API da Meta (Marketing API) — SOMENTE no servidor.
// Busca insights de campanhas de anúncios e calcula Investimento, Leads e CAC.
// O META_ADS_ACCESS_TOKEN NUNCA é exposto ao cliente: este módulo só é
// importado por Server Components / route handlers.
//
// Métrica de Leads: usamos EXCLUSIVAMENTE a action
// `onsite_conversion.messaging_conversation_started_7d` (conversas de WhatsApp
// iniciadas). É a métrica confirmada como correta — NÃO somamos outras actions
// com "lead" no nome, que contam em duplicidade.

const GRAPH_VERSION = "v21.0";

// Data em que você começou a anunciar (AAAA-MM-DD). Serve de piso para a
// janela "Tudo" dos relatórios. Sem ela, o painel usa os últimos 90 dias.
import { inicioProjeto } from "./periodo";

// Se você anuncia em MAIS DE UMA conta, liste todas em META_ADS_ACCOUNT_IDS
// (ids separados por vírgula, com ou sem o prefixo "act_"). Ler só a primeira
// faz o investimento aparecer menor do que é — e o custo por lead, menor ainda.
// Sem nenhuma conta configurada, a tela de Tráfego mostra o aviso de "não
// configurado" em vez de números errados.
function contasDeAnuncio(): string[] {
  const bruto = process.env.META_ADS_ACCOUNT_IDS || process.env.META_ADS_ACCOUNT_ID || "";
  return bruto
    .split(",")
    .map((s) => s.trim().replace(/^act_/, ""))
    .filter(Boolean);
}
const LEADS_ACTION = "onsite_conversion.messaging_conversation_started_7d";

// Códigos de erro de limite de requisições da Meta (rate limit).
const RATE_LIMIT_CODES = new Set([17, 4, 80004, 613]);

// Cache em memória de 30 min: reduz chamadas à Graph API (protege contra
// rate limit). Só cacheia resultados OK — falhas transitórias re-tentam já
// na próxima requisição. Chaveado por `${desde}|${ate}` para que cada janela
// de período tenha seu próprio cache.
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 100; // teto de chaves distintas (datas custom são via URL)
const _cache = new Map<string, { at: number; value: MetaInsights }>();

// Guarda no cache purgando expirados e evitando crescimento ilimitado da Map
// (as chaves incluem datas custom controláveis pela URL). LRU simples pela
// ordem de inserção da Map.
function cacheStore(key: string, value: MetaInsights): void {
  const now = Date.now();
  for (const [k, v] of _cache) {
    if (now - v.at >= CACHE_TTL_MS) _cache.delete(k);
  }
  _cache.set(key, { at: now, value });
  while (_cache.size > CACHE_MAX) {
    const oldest = _cache.keys().next().value;
    if (oldest === undefined) break;
    _cache.delete(oldest);
  }
}

export interface CampanhaInsight {
  nome: string;
  spend: number;
  leads: number;
  cac: number; // spend / leads (0 se leads==0)
}

export type MetaInsights =
  | {
      ok: true;
      investimento: number; // Σ spend (campanhas "leads")
      leads: number; // Σ conversas de WhatsApp iniciadas
      cac: number; // investimento / leads (0 se leads==0)
      porCampanha: CampanhaInsight[];
      desde: string; // YYYY-MM-DD
      ate: string; // YYYY-MM-DD (hoje)
    }
  | { ok: false; error: string };

// ── Tipos crus da resposta da Graph API ───────────────────────────────────
interface MetaAction {
  action_type: string;
  value: string;
}
interface MetaInsightRow {
  campaign_name?: string;
  spend?: string;
  actions?: MetaAction[];
  date_start?: string;
}
interface MetaResponse {
  data?: MetaInsightRow[];
  paging?: { next?: string };
  error?: { message?: string; code?: number; error_subcode?: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────
const toFloat = (v: unknown): number => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

function leadsFromActions(actions: MetaAction[] | undefined): number {
  if (!Array.isArray(actions)) return 0;
  const hit = actions.find((a) => a.action_type === LEADS_ACTION);
  return hit ? toFloat(hit.value) : 0;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

type Paginas<T> = { ok: true; rows: T[] } | { ok: false; error: string };

/**
 * Puxa todas as páginas de /insights de UMA conta.
 *
 * Erro de uma conta NÃO é engolido: um número de investimento que exclui uma
 * conta em silêncio é pior que um erro visível — o painel mostraria um CAC
 * bom que não existe. Quem chama decide, e todos falham alto.
 */
async function paginarInsights<T>(
  accountId: string,
  params: URLSearchParams,
  maxPaginas: number,
): Promise<Paginas<T>> {
  let url: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${accountId}/insights?${params.toString()}`;
  const rows: T[] = [];
  let guard = 0;

  while (url && guard < maxPaginas) {
    guard++;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    const json = (await res.json()) as {
      data?: T[];
      paging?: { next?: string };
      error?: { message?: string; code?: number };
    };

    if (json.error) {
      if (typeof json.error.code === "number" && RATE_LIMIT_CODES.has(json.error.code)) {
        return {
          ok: false,
          error: `Meta (conta ${accountId}): limite de requisições atingido. Tente novamente em alguns minutos.`,
        };
      }
      return {
        ok: false,
        error: `Meta (conta ${accountId}): ${json.error.message ?? "erro ao consultar a Graph API"}`,
      };
    }
    if (!res.ok) {
      return { ok: false, error: `Meta (conta ${accountId}): resposta HTTP ${res.status}` };
    }

    if (Array.isArray(json.data)) rows.push(...json.data);
    url = json.paging?.next ?? null;
  }

  return { ok: true, rows };
}

// ── Fuso: remontar os dias no calendário de São Paulo ─────────────────────
//
// A Meta reporta `date_start` no fuso DE CADA CONTA, e contas diferentes
// não estão no mesmo fuso (loja em America/Sao_Paulo, a outra em
// America/Los_Angeles). O painel e o bot contam o dia em São Paulo. Sem
// tratamento, o gasto da conta atrasada entre 00h e 04h cairia no dia anterior.
//
// Solução: para a conta desalinhada, pedimos o gasto QUEBRADO POR HORA (no fuso
// dela) e remontamos hora a hora no calendário de SP. É exato, não estimativa.
const FUSO_SP = "America/Sao_Paulo";

/** Offset em horas do fuso em relação ao UTC NAQUELE dia (respeita horário de
 *  verão — por isso recebe a data, e não um valor fixo). */
function offsetHorasUTC(tz: string, ymd: string): number {
  const refUTC = new Date(`${ymd}T12:00:00Z`);
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(refUTC);
  const n = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? "0");
  const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"));
  return Math.round((local - refUTC.getTime()) / 3600000);
}

function somarDias(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Fuso de cada conta (cache longo: isso praticamente nunca muda).
const _fusoCache = new Map<string, { at: number; tz: string }>();
const FUSO_TTL_MS = 12 * 60 * 60 * 1000;

async function fusoDaConta(accountId: string, token: string): Promise<string> {
  const hit = _fusoCache.get(accountId);
  if (hit && Date.now() - hit.at < FUSO_TTL_MS) return hit.tz;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/act_${accountId}?fields=timezone_name&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    const j = (await res.json()) as { timezone_name?: string };
    // Sem resposta, assumir SP mantém o comportamento antigo em vez de inventar
    // um deslocamento que ninguém pediu.
    const tz = j.timezone_name || FUSO_SP;
    _fusoCache.set(accountId, { at: Date.now(), tz });
    return tz;
  } catch {
    return FUSO_SP;
  }
}

/** Uma linha de gasto já colocada no dia CERTO do calendário de São Paulo. */
interface LinhaDiaSP {
  dia: string; // YYYY-MM-DD (São Paulo)
  campanha: string;
  spend: number;
  leads: number;
}

// Filtro OPCIONAL por nome de campanha. Vazio (o padrão) = conta TODAS as
// campanhas da conta. Se você nomeia suas campanhas com uma marca comum
// (ex.: "leads"), coloque-a em META_ADS_FILTRO_CAMPANHA para somar só elas.
//
// Cuidado: com o filtro preenchido, toda campanha cujo nome não contenha o
// termo é descartada em silêncio do investimento, do custo por lead e do
// retorno. Um filtro esquecido faz a tela mostrar R$ 0,00 sem erro nenhum.
const ehCampanhaDeLeads = (nome: string | undefined) => {
  const filtro = (process.env.META_ADS_FILTRO_CAMPANHA ?? "").trim().toLowerCase();
  if (!filtro) return true;
  return (nome ?? "").toLowerCase().includes(filtro);
};

/**
 * Gasto de UMA conta no intervalo [desde, ate] de dias de São Paulo.
 *
 * Conta já alinhada com SP: uma chamada diária, barata — é o caminho de sempre.
 * Conta desalinhada: chamada por hora, com um dia de folga na borda que precisa,
 * e cada hora é reposicionada no dia de SP a que ela pertence.
 */
async function linhasPorDiaSP(
  accountId: string,
  token: string,
  desde: string,
  ate: string,
): Promise<{ ok: true; linhas: LinhaDiaSP[] } | { ok: false; error: string }> {
  const tz = await fusoDaConta(accountId, token);
  const desloc = offsetHorasUTC(FUSO_SP, desde) - offsetHorasUTC(tz, desde);

  // ── caminho barato: a conta já conta o dia como a gente ──
  if (desloc === 0) {
    const params = new URLSearchParams({
      level: "campaign",
      fields: "campaign_name,spend,actions,date_start",
      time_range: JSON.stringify({ since: desde, until: ate }),
      time_increment: "1",
      limit: "500",
      access_token: token,
    });
    const p = await paginarInsights<MetaInsightRow>(accountId, params, 50);
    if (!p.ok) return { ok: false, error: p.error };
    const linhas: LinhaDiaSP[] = [];
    for (const r of p.rows) {
      if (!ehCampanhaDeLeads(r.campaign_name) || !r.date_start) continue;
      linhas.push({
        dia: r.date_start,
        campanha: r.campaign_name ?? "—",
        spend: toFloat(r.spend),
        leads: leadsFromActions(r.actions),
      });
    }
    return { ok: true, linhas };
  }

  // ── caminho exato: hora a hora ──
  // Conta ATRASADA (desloc > 0): o começo do dia de SP vem da noite do dia
  // anterior dela. Conta ADIANTADA: o fim do dia de SP vem da madrugada
  // seguinte dela. Só pedimos a folga do lado que realmente precisa.
  const desdeConta = desloc > 0 ? somarDias(desde, -1) : desde;
  const ateConta = desloc < 0 ? somarDias(ate, 1) : ate;

  const params = new URLSearchParams({
    level: "campaign",
    fields: "campaign_name,spend,actions,date_start",
    time_range: JSON.stringify({ since: desdeConta, until: ateConta }),
    time_increment: "1",
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    limit: "500",
    access_token: token,
  });

  // 24x mais linhas que o caminho diário — daí o teto de páginas maior.
  const p = await paginarInsights<MetaInsightRow & { hourly_stats_aggregated_by_advertiser_time_zone?: string }>(
    accountId,
    params,
    200,
  );
  if (!p.ok) return { ok: false, error: p.error };

  const linhas: LinhaDiaSP[] = [];
  for (const r of p.rows) {
    if (!ehCampanhaDeLeads(r.campaign_name) || !r.date_start) continue;
    const faixa = r.hourly_stats_aggregated_by_advertiser_time_zone ?? "";
    const hora = Number(faixa.slice(0, 2));
    if (!Number.isFinite(hora)) continue;

    // Recalcula o deslocamento no dia da linha: numa virada de horário de verão
    // o mesmo intervalo tem deslocamentos diferentes.
    const d = offsetHorasUTC(FUSO_SP, r.date_start) - offsetHorasUTC(tz, r.date_start);
    let h = hora + d;
    let dia = r.date_start;
    while (h >= 24) {
      h -= 24;
      dia = somarDias(dia, 1);
    }
    while (h < 0) {
      h += 24;
      dia = somarDias(dia, -1);
    }

    // Descarta a folga que pedimos só pra fechar a borda.
    if (dia < desde || dia > ate) continue;

    linhas.push({
      dia,
      campanha: r.campaign_name ?? "—",
      spend: toFloat(r.spend),
      leads: leadsFromActions(r.actions),
    });
  }
  return { ok: true, linhas };
}

/** Junta todas as contas, já no calendário de São Paulo. */
async function linhasDeTodasAsContas(
  token: string,
  desde: string,
  ate: string,
): Promise<{ ok: true; linhas: LinhaDiaSP[] } | { ok: false; error: string }> {
  const linhas: LinhaDiaSP[] = [];
  for (const conta of contasDeAnuncio()) {
    const r = await linhasPorDiaSP(conta, token, desde, ate);
    if (!r.ok) return { ok: false, error: r.error };
    linhas.push(...r.linhas);
  }
  return { ok: true, linhas };
}

// ── Fetch bruto (sem cache) ────────────────────────────────────────────────
async function fetchMetaInsights(desde: string, ate: string): Promise<MetaInsights> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, error: "META_ADS_ACCESS_TOKEN não configurado" };
  }

  try {
    // O total sai da MESMA base do gráfico por dia: assim o topo da tela e o
    // gráfico nunca discordam, e a janela do período respeita o dia de SP em
    // todas as contas (antes, `time_range` era lido no fuso de cada conta).
    const base = await linhasDeTodasAsContas(token, desde, ate);
    if (!base.ok) return { ok: false, error: base.error };

    let investimento = 0;
    let leads = 0;
    // Agrega por NOME: com mais de uma conta, duas linhas de mesmo nome viriam
    // separadas e a tela mostraria a campanha duplicada.
    const agregado = new Map<string, { spend: number; leads: number }>();

    for (const r of base.linhas) {
      investimento += r.spend;
      leads += r.leads;
      const atual = agregado.get(r.campanha) ?? { spend: 0, leads: 0 };
      atual.spend += r.spend;
      atual.leads += r.leads;
      agregado.set(r.campanha, atual);
    }

    const porCampanha: CampanhaInsight[] = [...agregado.entries()].map(([nome, v]) => ({
      nome,
      spend: v.spend,
      leads: v.leads,
      cac: v.leads > 0 ? v.spend / v.leads : 0,
    }));

    porCampanha.sort((a, b) => b.spend - a.spend);
    const cac = leads > 0 ? investimento / leads : 0;

    return { ok: true, investimento, leads, cac, porCampanha, desde, ate };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao consultar a Meta";
    return { ok: false, error: `Meta: ${message}` };
  }
}

// ── API pública (com cache de 30 min em resultados OK) ─────────────────────
// `desde`/`ate` são datas YYYY-MM-DD (fuso SP). Default = janela desde o início
// do projeto até hoje, preservando o comportamento anterior quando chamada sem
// argumentos.
export async function getMetaInsights(
  desde: string = inicioProjeto(),
  ate: string = todayYmd(),
): Promise<MetaInsights> {
  const key = `${desde}|${ate}`;
  const hit = _cache.get(key);
  if (hit && hit.value.ok && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }
  const result = await fetchMetaInsights(desde, ate);
  if (result.ok) cacheStore(key, result);
  return result;
}

// ── Insights POR DIA (time_increment=1) — usado pelo snapshot de tráfego ────
export interface MetaDiaCampanha {
  nome: string;
  spend: number;
  leads: number;
}
export interface MetaDia {
  data: string; // YYYY-MM-DD (date_start)
  investimento: number;
  leads: number;
  porCampanha: MetaDiaCampanha[];
}
export type MetaDiario = { ok: true; dias: MetaDia[] } | { ok: false; error: string };

// Sem cache (o snapshot roda 1x/dia): puxa as campanhas "leads" quebradas por dia.
export async function getMetaDiario(desde: string, ate: string): Promise<MetaDiario> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "META_ADS_ACCESS_TOKEN não configurado" };
  try {
    // Já vem no calendário de São Paulo, com a conta desalinhada remontada hora
    // a hora (ver linhasPorDiaSP).
    const base = await linhasDeTodasAsContas(token, desde, ate);
    if (!base.ok) return { ok: false, error: base.error };

    const porDia = new Map<string, MetaDia>();
    for (const r of base.linhas) {
      let md = porDia.get(r.dia);
      if (!md) {
        md = { data: r.dia, investimento: 0, leads: 0, porCampanha: [] };
        porDia.set(r.dia, md);
      }
      md.investimento += r.spend;
      md.leads += r.leads;
      const jaTem = md.porCampanha.find((c) => c.nome === r.campanha);
      if (jaTem) {
        jaTem.spend += r.spend;
        jaTem.leads += r.leads;
      } else {
        md.porCampanha.push({ nome: r.campanha, spend: r.spend, leads: r.leads });
      }
    }

    return {
      ok: true,
      dias: [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao consultar a Meta";
    return { ok: false, error: `Meta: ${message}` };
  }
}

// ── Mapa ad_id → nome da campanha ──────────────────────────────────────────
// O bot grava origem_campanha = ad_id (externalAdReply.sourceId). Pra juntar
// nossos leads à CAMPANHA (Meta), mapeamos ad_id → campaign_name. Cache 30 min.
const _adCache = new Map<string, { at: number; value: Map<string, string> }>();
export async function getAdCampanhaMap(
  desde: string = inicioProjeto(),
  ate: string = todayYmd(),
): Promise<Map<string, string>> {
  const cacheKey = `ad|${desde}|${ate}`;
  const hit = _adCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const map = new Map<string, string>();
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return map;
  try {
    const params = new URLSearchParams({
      level: "ad",
      fields: "ad_id,campaign_name",
      time_range: JSON.stringify({ since: desde, until: ate }),
      limit: "500",
      access_token: token,
    });
    // Aqui a falha de uma conta é tolerada: este mapa só ENRIQUECE o lead com o
    // nome da campanha. Perder um nome degrada a tela; derrubar tudo esconderia
    // os leads. Diferente do investimento, onde faltar conta vira número errado.
    for (const conta of contasDeAnuncio()) {
      const p = await paginarInsights<{ ad_id?: string; campaign_name?: string }>(
        conta,
        params,
        50,
      );
      if (!p.ok) {
        console.error("[meta] getAdCampanhaMap:", p.error);
        continue;
      }
      // ad_id é único entre contas, então não há colisão ao juntar os mapas.
      for (const r of p.rows) {
        if (r.ad_id && r.campaign_name) map.set(r.ad_id, r.campaign_name);
      }
    }
    _adCache.set(cacheKey, { at: Date.now(), value: map });
  } catch (e) {
    console.error("[meta] getAdCampanhaMap:", e);
  }
  return map;
}
