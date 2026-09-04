// Tráfego & retorno: snapshot diário (Meta + bot) em trafego_diario, agregação
// por período e composição dos relatórios. Server-only (usa getClient + meta.ts).
import { getClient } from "./db";
import { getMetaDiario, getAdCampanhaMap, MetaDia } from "./meta";
import { formatBRL } from "./format";
import { empresaNome } from "./config";

// Quem recebe os relatórios está em lib/config.ts (destinatariosAlerta),
// configurado por ALERTAS_WHATSAPP / ALERTAS_EMAIL. Sem ninguém configurado,
// o relatório é gerado e simplesmente não é enviado.

// ── Datas (fuso SP, offset fixo -03:00) ────────────────────────────────────
const SP_OFFSET_MS = 3 * 3600 * 1000;
const p2 = (n: number) => String(n).padStart(2, "0");

export function diaSP(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const sp = new Date(d.getTime() - SP_OFFSET_MS);
  return `${sp.getUTCFullYear()}-${p2(sp.getUTCMonth() + 1)}-${p2(sp.getUTCDate())}`;
}
export function hojeSP(agora: Date = new Date()): string {
  return diaSP(agora);
}
export function addDias(dataISO: string, n: number): string {
  const [y, m, d] = dataISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${p2(dt.getUTCMonth() + 1)}-${p2(dt.getUTCDate())}`;
}
const brData = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

// Dias inteiros entre duas datas ISO (b - a). Positivo se b > a.
export function diffDias(aISO: string, bISO: string): number {
  const u = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((u(bISO) - u(aISO)) / 86400000);
}

export type Periodo = "diario" | "semanal" | "mensal";

// Intervalo (inclusivo) do período FECHADO anterior + rótulo humano.
export function intervaloPeriodo(
  periodo: Periodo,
  hoje: string,
): { desde: string; ate: string; label: string } {
  if (periodo === "diario") {
    const o = addDias(hoje, -1);
    return { desde: o, ate: o, label: `dia ${brData(o)}` };
  }
  if (periodo === "semanal") {
    const [y, m, d] = hoje.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dom..6=sáb
    const desdeSegunda = dow === 0 ? 6 : dow - 1; // dias desde a segunda desta semana
    const segundaEsta = addDias(hoje, -desdeSegunda);
    const desde = addDias(segundaEsta, -7);
    const ate = addDias(segundaEsta, -1);
    return { desde, ate, label: `semana ${brData(desde)}–${brData(ate)}` };
  }
  // mensal: mês calendário anterior
  const [y, m] = hoje.split("-").map(Number);
  const ate = addDias(`${y}-${p2(m)}-01`, -1); // último dia do mês passado
  const desde = `${ate.slice(0, 7)}-01`;
  return { desde, ate, label: `mês ${ate.slice(0, 7)}` };
}

// Lista de datas (inclusiva) entre desde e ate.
export function datasEntre(desde: string, ate: string): string[] {
  const out: string[] = [];
  let cur = desde;
  let guard = 0;
  while (cur <= ate && guard < 400) {
    out.push(cur);
    cur = addDias(cur, 1);
    guard++;
  }
  return out;
}

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface CampanhaTrafego {
  nome: string;
  spend: number;
  leads: number;
  cac: number;
}
export interface TrafegoDia {
  data: string;
  investimento: number;
  leads_meta: number;
  cpl_meta: number;
  por_campanha: CampanhaTrafego[];
  novos_leads: number;
  engajados: number;
  nao_respondidos: number;
  agendados: number;
  materiais: number;
  fechados: number;
  receita: number;
  cac_real: number;
}
export interface MetricasPeriodo {
  investimento: number;
  leads_meta: number;
  cpl_meta: number;
  novos_leads: number;
  engajados: number;
  nao_respondidos: number;
  agendados: number;
  materiais: number;
  fechados: number;
  receita: number;
  cac_real: number;
  roi: number | null; // (receita - investimento) / investimento; null se invest.==0
  por_campanha: CampanhaTrafego[];
  dias: TrafegoDia[];
}

// ── Montagem de 1 dia (PURA) ───────────────────────────────────────────────
export interface BotDia {
  novos: number;
  engajados: number;
  agendados: number;
  materiais: number;
  fechados: number;
  receita: number;
}
// Se a Meta não trouxe o dia (vazio/renomeada/página parcial), preserva os
// valores de Meta já gravados (fallback) em vez de zerar — spend de dia passado
// é imutável. bot é sempre fresco.
export interface MetaFallback {
  investimento: number;
  leads_meta: number;
  por_campanha: CampanhaTrafego[];
}
export function montarDia(
  data: string,
  meta: MetaDia | undefined,
  bot: BotDia,
  fallback?: MetaFallback,
): TrafegoDia {
  const usa = !!meta;
  const investimento = usa ? meta!.investimento : fallback?.investimento ?? 0;
  const leads_meta = usa ? meta!.leads : fallback?.leads_meta ?? 0;
  return {
    data,
    investimento,
    leads_meta,
    cpl_meta: leads_meta > 0 ? investimento / leads_meta : 0,
    por_campanha: usa
      ? meta!.porCampanha.map((c) => ({
          nome: c.nome,
          spend: c.spend,
          leads: c.leads,
          cac: c.leads > 0 ? c.spend / c.leads : 0,
        }))
      : fallback?.por_campanha ?? [],
    novos_leads: bot.novos,
    engajados: bot.engajados,
    nao_respondidos: Math.max(0, bot.novos - bot.engajados),
    agendados: bot.agendados,
    materiais: bot.materiais,
    fechados: bot.fechados,
    receita: bot.receita,
    cac_real: bot.engajados > 0 ? investimento / bot.engajados : 0,
  };
}

// ── Agregação de período (PURA) ────────────────────────────────────────────
export function agregarPeriodo(dias: TrafegoDia[]): MetricasPeriodo {
  const acc: MetricasPeriodo = {
    investimento: 0, leads_meta: 0, cpl_meta: 0, novos_leads: 0, engajados: 0,
    nao_respondidos: 0, agendados: 0, materiais: 0, fechados: 0, receita: 0,
    cac_real: 0, roi: null, por_campanha: [], dias,
  };
  const camp = new Map<string, CampanhaTrafego>();
  for (const d of dias) {
    acc.investimento += d.investimento;
    acc.leads_meta += d.leads_meta;
    acc.novos_leads += d.novos_leads;
    acc.engajados += d.engajados;
    acc.nao_respondidos += d.nao_respondidos;
    acc.agendados += d.agendados;
    acc.materiais += d.materiais;
    acc.fechados += d.fechados;
    acc.receita += d.receita;
    for (const c of d.por_campanha) {
      const e = camp.get(c.nome) ?? { nome: c.nome, spend: 0, leads: 0, cac: 0 };
      e.spend += c.spend;
      e.leads += c.leads;
      camp.set(c.nome, e);
    }
  }
  acc.cpl_meta = acc.leads_meta > 0 ? acc.investimento / acc.leads_meta : 0;
  acc.cac_real = acc.engajados > 0 ? acc.investimento / acc.engajados : 0;
  // ROI só é significativo com fechamentos marcados. Sem fechados, "—" (não
  // medido) em vez de -100% (que pareceria que o tráfego perdeu tudo).
  acc.roi =
    acc.investimento > 0 && acc.fechados > 0
      ? (acc.receita - acc.investimento) / acc.investimento
      : null;
  acc.por_campanha = [...camp.values()]
    .map((c) => ({ ...c, cac: c.leads > 0 ? c.spend / c.leads : 0 }))
    .sort((a, b) => b.spend - a.spend);
  return acc;
}

// ── Composição dos relatórios (PURA) ───────────────────────────────────────
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

export function textoWhatsApp(label: string, m: MetricasPeriodo, nota?: string): string {
  const roi = m.roi == null ? "—" : `${Math.round(m.roi * 100)}%`;
  const top = m.por_campanha[0];
  const linhas = [
    `*${empresaNome()} · Tráfego — ${label}*`,
    ``,
    `💰 Investimento: *${formatBRL(m.investimento)}*`,
    `🟢 Leads (Meta): *${m.leads_meta}* · CPL ${formatBRL(m.cpl_meta)}`,
    `💬 Responderam no bot: *${m.engajados}* de ${m.novos_leads} capturados (${pct(m.engajados, m.novos_leads)}%)`,
    `🎯 CAC real: *${formatBRL(m.cac_real)}* (gasto ÷ quem respondeu)`,
    `📅 Agendados: ${m.agendados} · 📎 Materiais: ${m.materiais}`,
    `✅ Fechados: ${m.fechados} · Receita ${formatBRL(m.receita)} · ROI ${roi}`,
  ];
  if (top) {
    linhas.push(``, `🏆 Campanha: ${top.nome} — ${formatBRL(top.spend)}, ${top.leads} leads, CAC ${formatBRL(top.cac)}`);
  }
  if (nota) linhas.push(``, `_${nota}_`);
  return linhas.join("\n");
}

export function htmlEmail(
  label: string,
  m: MetricasPeriodo,
  nota?: string,
  campanhas: CampanhaCompleta[] = [],
): string {
  const roi = m.roi == null ? "—" : `${Math.round(m.roi * 100)}%`;
  const linhaKpi = (rot: string, val: string) =>
    `<tr><td style="padding:6px 12px;color:#4b5563;font-size:13px">${rot}</td><td style="padding:6px 12px;font-weight:600;font-size:13px;text-align:right">${val}</td></tr>`;
  const td = (v: string, align = "right") =>
    `<td style="padding:6px 10px;font-size:12px;text-align:${align}">${v}</td>`;
  const campRows = campanhas.length
    ? campanhas
        .map(
          (c) =>
            `<tr>${td(esc(c.nome), "left")}${td(formatBRL(c.spend))}${td(String(c.leads_meta))}${td(formatBRL(c.cpl_meta))}${td(`${c.engajados}/${c.capturados}`)}${td(c.engajados > 0 ? formatBRL(c.cac_real) : "—")}${td(String(c.fechados))}${td(c.roi == null ? "—" : `${Math.round(c.roi * 100)}%`)}</tr>`,
        )
        .join("")
    : `<tr><td colspan="8" style="padding:8px 10px;font-size:12px;color:#9ca3af">Sem campanhas no período.</td></tr>`;
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#0f1b14">
    <h2 style="margin:0 0 4px;font-size:18px">${empresaNome()} · Relatório de Tráfego</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#6b7280">${esc(label)}</p>
    <table style="width:100%;border-collapse:collapse;background:#f6faf7;border-radius:10px;overflow:hidden">
      ${linhaKpi("Investimento", formatBRL(m.investimento))}
      ${linhaKpi("Leads (Meta / conversas)", `${m.leads_meta} · CPL ${formatBRL(m.cpl_meta)}`)}
      ${linhaKpi("Capturados no bot", String(m.novos_leads))}
      ${linhaKpi("Responderam (engajaram)", `${m.engajados} (${pct(m.engajados, m.novos_leads)}%)`)}
      ${linhaKpi("Não responderam", String(m.nao_respondidos))}
      ${linhaKpi("CAC real (gasto ÷ engajados)", formatBRL(m.cac_real))}
      ${linhaKpi("Agendados", String(m.agendados))}
      ${linhaKpi("Materiais enviados", String(m.materiais))}
      ${linhaKpi("Fechados", String(m.fechados))}
      ${linhaKpi("Receita", formatBRL(m.receita))}
      ${linhaKpi("ROI", roi)}
    </table>
    <h3 style="margin:20px 0 6px;font-size:14px">Por campanha</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr style="color:#6b7280"><td style="padding:4px 10px;font-size:11px">Campanha</td><td style="padding:4px 10px;font-size:11px;text-align:right">Gasto</td><td style="padding:4px 10px;font-size:11px;text-align:right">Leads</td><td style="padding:4px 10px;font-size:11px;text-align:right">CPL</td><td style="padding:4px 10px;font-size:11px;text-align:right">Respond.</td><td style="padding:4px 10px;font-size:11px;text-align:right">CAC real</td><td style="padding:4px 10px;font-size:11px;text-align:right">Fech.</td><td style="padding:4px 10px;font-size:11px;text-align:right">ROI</td></tr>
      ${campRows}
    </table>
    ${nota ? `<p style="margin:14px 0 0;font-size:11px;color:#b45309">${esc(nota)}</p>` : ""}
    <p style="margin:18px 0 0;font-size:11px;color:#9ca3af">Gerado automaticamente pelo painel. O custo real e o "responderam" vêm do robô; leads e CPL vêm da Meta.</p>
  </div>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// ── I/O: snapshot + leitura ────────────────────────────────────────────────
type ContatoRow = { primeira_interacao: string | null; total_mensagens: number | null };
type FechRow = { data_fechamento: string | null; valor_fechado: number | null };
type EvtRow = { telefone: string; stage: string | null; materiais: string | null; created_at: string | null };

// Puxa Meta + bot para as datas e faz UPSERT em trafego_diario. NÃO grava se a
// Meta OU alguma leitura do bot falhar (evita zerar dados bons). Se a Meta não
// trouxer um dia, preserva os valores de Meta já gravados (fallback). Idempotente.
export async function snapshotDias(datas: string[]): Promise<{ ok: boolean; gravados: number; error?: string }> {
  if (!datas.length) return { ok: true, gravados: 0 };
  const desde = datas.reduce((a, b) => (a < b ? a : b));
  const ate = datas.reduce((a, b) => (a > b ? a : b));

  try {
    const meta = await getMetaDiario(desde, ate);
    if (!meta.ok) return { ok: false, gravados: 0, error: meta.error };
    const metaByDay = new Map(meta.dias.map((d) => [d.data, d]));

    const s = getClient();
    const desdeUtc = `${desde}T00:00:00-03:00`;
    const [cont, fech, evt, existentes] = await Promise.all([
      s.from("ff_contatos").select("primeira_interacao, total_mensagens").gte("primeira_interacao", desdeUtc),
      s.from("ff_contatos").select("data_fechamento, valor_fechado").eq("fechado", true).gte("data_fechamento", desdeUtc),
      s.from("ff_eventos").select("telefone, stage, materiais, created_at").gte("created_at", desdeUtc),
      lerTrafego(desde, ate),
    ]);

    // Se qualquer leitura do bot falhar, aborta SEM gravar (não zera dados bons).
    if (cont.error || fech.error || evt.error) {
      const e = cont.error || fech.error || evt.error;
      return { ok: false, gravados: 0, error: `bot: ${e?.message ?? "erro de leitura"}` };
    }

    // Fallback: Meta já gravada por dia (usada quando a Meta não trouxer o dia).
    const fbByDay = new Map<string, MetaFallback>(
      existentes.map((r) => [
        r.data,
        { investimento: r.investimento, leads_meta: r.leads_meta, por_campanha: r.por_campanha },
      ]),
    );

    const novos = new Map<string, number>();
    const engaj = new Map<string, number>();
    for (const r of (cont.data ?? []) as ContatoRow[]) {
      if (!r.primeira_interacao) continue;
      const d = diaSP(r.primeira_interacao);
      novos.set(d, (novos.get(d) ?? 0) + 1);
      if ((r.total_mensagens ?? 0) >= 2) engaj.set(d, (engaj.get(d) ?? 0) + 1);
    }
    const fechados = new Map<string, number>();
    const receita = new Map<string, number>();
    for (const r of (fech.data ?? []) as FechRow[]) {
      if (!r.data_fechamento) continue;
      const d = diaSP(r.data_fechamento);
      fechados.set(d, (fechados.get(d) ?? 0) + 1);
      receita.set(d, (receita.get(d) ?? 0) + Number(r.valor_fechado ?? 0));
    }
    const agSet = new Map<string, Set<string>>();
    const matSet = new Map<string, Set<string>>();
    const addTo = (m: Map<string, Set<string>>, d: string, tel: string) => {
      let sset = m.get(d);
      if (!sset) { sset = new Set(); m.set(d, sset); }
      sset.add(tel);
    };
    for (const r of (evt.data ?? []) as EvtRow[]) {
      if (!r.created_at || !r.telefone) continue;
      const d = diaSP(r.created_at);
      if (r.stage === "agendado") addTo(agSet, d, r.telefone);
      if (r.materiais && String(r.materiais).trim()) addTo(matSet, d, r.telefone);
    }

    const linhas = datas.map((data) =>
      montarDia(
        data,
        metaByDay.get(data),
        {
          novos: novos.get(data) ?? 0,
          engajados: engaj.get(data) ?? 0,
          agendados: agSet.get(data)?.size ?? 0,
          materiais: matSet.get(data)?.size ?? 0,
          fechados: fechados.get(data) ?? 0,
          receita: receita.get(data) ?? 0,
        },
        fbByDay.get(data),
      ),
    );

    const agora = new Date().toISOString();
    const up = await s.from("trafego_diario").upsert(
      linhas.map((l) => ({ ...l, atualizado_em: agora })),
      { onConflict: "data" },
    );
    if (up.error) return { ok: false, gravados: 0, error: up.error.message };
    return { ok: true, gravados: linhas.length };
  } catch (e) {
    return { ok: false, gravados: 0, error: e instanceof Error ? e.message : "erro no snapshot" };
  }
}

// ── Por campanha: junção Meta × nossos leads (atribuição) ──────────────────
export interface NossoCampanha {
  capturados: number;
  engajados: number;
  fechados: number;
  receita: number;
}
export interface CampanhaCompleta {
  nome: string;
  spend: number;
  leads_meta: number;
  cpl_meta: number;
  capturados: number; // nossos leads atribuídos a essa campanha
  engajados: number;
  fechados: number;
  receita: number;
  cac_real: number; // spend / engajados
  roi: number | null; // (receita - spend)/spend; null se sem fechados
}

type ContatoOrigemRow = {
  origem_campanha: string | null;
  origem_ad: string | null;
  total_mensagens: number | null;
  fechado: boolean | null;
  valor_fechado: number | null;
};

// Nossos leads atribuídos no período, por AD_ID. A chave é o primeiro entre
// origem_campanha e origem_ad que parecer um ad_id da Meta (só dígitos) —
// assim a atribuição sobrevive quando o painel edita a origem pra um texto
// humano (o ad_id preservado em origem_ad continua contando no CAC).
export async function nossoPorAd(desde: string, ate: string): Promise<Map<string, NossoCampanha>> {
  const out = new Map<string, NossoCampanha>();
  try {
    const s = getClient();
    const ini = `${desde}T00:00:00-03:00`;
    const fim = `${addDias(ate, 1)}T00:00:00-03:00`;
    const res = await s
      .from("ff_contatos")
      .select(
        "origem_campanha, origem_ad, total_mensagens, fechado, valor_fechado, primeira_interacao",
      )
      .or("origem_campanha.not.is.null,origem_ad.not.is.null")
      .gte("primeira_interacao", ini)
      .lt("primeira_interacao", fim);
    if (res.error || !res.data) return out;
    const pareceAdId = (v: string | null): string => {
      const t = String(v ?? "").trim();
      return /^\d{6,}$/.test(t) ? t : "";
    };
    for (const r of res.data as unknown as ContatoOrigemRow[]) {
      const ad =
        pareceAdId(r.origem_campanha) ||
        pareceAdId(r.origem_ad) ||
        String(r.origem_campanha ?? "").trim();
      if (!ad) continue;
      const e = out.get(ad) ?? { capturados: 0, engajados: 0, fechados: 0, receita: 0 };
      e.capturados++;
      if ((r.total_mensagens ?? 0) >= 2) e.engajados++;
      if (r.fechado) {
        e.fechados++;
        e.receita += Number(r.valor_fechado ?? 0);
      }
      out.set(ad, e);
    }
  } catch (e) {
    console.error("[trafego] nossoPorAd:", e);
  }
  return out;
}

// Junta Meta (por campanha) + nosso lado (por ad → campanha). PURA.
export function montarPorCampanha(
  metaPorCampanha: CampanhaTrafego[],
  nossoByAd: Map<string, NossoCampanha>,
  adCampanha: Map<string, string>,
): CampanhaCompleta[] {
  const nossoByCamp = new Map<string, NossoCampanha>();
  for (const [ad, n] of nossoByAd) {
    const camp = adCampanha.get(ad) || "(campanha desconhecida)";
    const e = nossoByCamp.get(camp) ?? { capturados: 0, engajados: 0, fechados: 0, receita: 0 };
    e.capturados += n.capturados;
    e.engajados += n.engajados;
    e.fechados += n.fechados;
    e.receita += n.receita;
    nossoByCamp.set(camp, e);
  }
  return metaPorCampanha.map((c) => {
    const n = nossoByCamp.get(c.nome) ?? { capturados: 0, engajados: 0, fechados: 0, receita: 0 };
    return {
      nome: c.nome,
      spend: c.spend,
      leads_meta: c.leads,
      cpl_meta: c.leads > 0 ? c.spend / c.leads : 0,
      capturados: n.capturados,
      engajados: n.engajados,
      fechados: n.fechados,
      receita: n.receita,
      cac_real: n.engajados > 0 ? c.spend / n.engajados : 0,
      roi: c.spend > 0 && n.fechados > 0 ? (n.receita - c.spend) / c.spend : null,
    };
  });
}

// Conveniência: para um período, junta o Meta agregado com o nosso lado.
export async function porCampanhaCompleto(
  metaPorCampanha: CampanhaTrafego[],
  desde: string,
  ate: string,
): Promise<CampanhaCompleta[]> {
  const [nosso, adMap] = await Promise.all([nossoPorAd(desde, ate), getAdCampanhaMap()]);
  return montarPorCampanha(metaPorCampanha, nosso, adMap);
}

// Lê trafego_diario no intervalo (inclusivo) → TrafegoDia[] ordenado.
export async function lerTrafego(desde: string, ate: string): Promise<TrafegoDia[]> {
  try {
    const res = await getClient()
      .from("trafego_diario")
      .select(
        "data, investimento, leads_meta, cpl_meta, por_campanha, novos_leads, engajados, nao_respondidos, agendados, materiais, fechados, receita, cac_real",
      )
      .gte("data", desde)
      .lte("data", ate)
      .order("data", { ascending: true });
    if (res.error || !res.data) return [];
    return res.data as unknown as TrafegoDia[];
  } catch (e) {
    console.error("[trafego] lerTrafego:", e);
    return [];
  }
}
