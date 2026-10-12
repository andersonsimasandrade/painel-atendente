// Comparativo de CANAIS: Google Ads × Meta Ads × Orgânico/direto.
//
// Princípio: o resultado é medido pelo que acontece no NOSSO CRM (quem
// respondeu, quem agendou, quem fechou), não pelo que cada plataforma diz de si
// mesma. O gasto vem de cada plataforma; o retorno vem do robô.
//
// Como cada contato é atribuído a um canal (primeira origem que ficou gravada):
//   • origem_campanha só com dígitos (ou origem_ad vindo de anúncio Click-to-
//     WhatsApp)                          → Meta
//   • origem_campanha "site:google"      → Google (veio do site por clique pago)
//   • origem_campanha "site:meta"        → Meta   (veio do site por link do Instagram/Facebook)
//   • "site:organico|direto|outro"       → Orgânico
//   • sem origem nenhuma                 → Orgânico/direto
import { getClient } from "./db";
import { addDias, datasEntre, lerTrafego } from "./trafego";

export type Canal = "google" | "meta" | "organico";
export const CANAIS: Canal[] = ["google", "meta", "organico"];
export const ROTULO_CANAL: Record<Canal, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  organico: "Orgânico / direto",
};

/** PURA. Decide o canal de um contato pelo que o robô gravou. */
export function classificarCanal(origemAd: string | null, origemCampanha: string | null): Canal {
  const camp = String(origemCampanha ?? "").trim().toLowerCase();
  const ad = String(origemAd ?? "").trim();
  if (camp.startsWith("site:")) {
    const c = camp.slice(5);
    if (c === "google") return "google";
    if (c === "meta") return "meta";
    return "organico";
  }
  if (/^\d{6,}$/.test(camp)) return "meta"; // sourceId de anúncio Click-to-WhatsApp
  if (ad) {
    if (ad.toLowerCase().startsWith("site ·")) {
      const c = ad.toLowerCase().replace("site ·", "").trim();
      return c === "google" ? "google" : c === "meta" ? "meta" : "organico";
    }
    return "meta"; // título/ID de anúncio ou "Anúncio (sem rastreio)"
  }
  return "organico";
}

export interface MetricasCanal {
  canal: Canal;
  investimento: number;
  cliques: number | null; // só o Google informa cliques de forma confiável aqui
  conversas_plataforma: number | null; // Meta: conversas iniciadas; Google: conversões que o Google contou
  pedidos_site: number; // pedidos de agendamento feitos NO SITE (valem mesmo sem robô no WhatsApp)
  capturados: number; // contatos novos no CRM
  engajados: number; // responderam (>= 2 mensagens)
  agendados: number;
  fechados: number;
  receita: number;
  custo_por_captado: number | null;
  cac_real: number | null; // gasto ÷ quem respondeu
  custo_por_agendamento: number | null;
  roi: number | null;
}

export interface ComparativoCanais {
  canais: MetricasCanal[];
  dias: { data: string; google: number; meta: number }[];
  googleSincronizado: boolean; // alguma linha do Google existe no período
  atualizadoGoogle: string | null;
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** PURA. Monta as métricas finais de um canal. */
export function montarCanal(
  canal: Canal,
  base: {
    investimento: number;
    cliques: number | null;
    conversas_plataforma: number | null;
    pedidos_site: number;
    capturados: number;
    engajados: number;
    agendados: number;
    fechados: number;
    receita: number;
  },
): MetricasCanal {
  const pago = base.investimento > 0;
  return {
    canal,
    ...base,
    custo_por_captado: pago ? div(base.investimento, base.capturados) : null,
    cac_real: pago ? div(base.investimento, base.engajados) : null,
    custo_por_agendamento: pago ? div(base.investimento, base.agendados) : null,
    // Sem fechamentos marcados, ROI não é medido (não é -100%).
    roi: pago && base.fechados > 0 ? (base.receita - base.investimento) / base.investimento : null,
  };
}

type ContatoRow = {
  telefone: string;
  origem_ad: string | null;
  origem_campanha: string | null;
  total_mensagens: number | null;
  fechado: boolean | null;
  valor_fechado: number | null;
};

export async function compararCanais(desde: string, ate: string): Promise<ComparativoCanais> {
  const s = getClient();
  const ini = `${desde}T00:00:00-03:00`;
  const fim = `${addDias(ate, 1)}T00:00:00-03:00`;

  const [metaDias, goog, cont, evt, ped] = await Promise.all([
    lerTrafego(desde, ate),
    s
      .from("trafego_google_diario")
      .select("dia, custo, cliques, impressoes, conversoes, atualizado_em")
      .gte("dia", desde)
      .lte("dia", ate),
    s
      .from("ff_contatos")
      .select("telefone, origem_ad, origem_campanha, total_mensagens, fechado, valor_fechado")
      .gte("primeira_interacao", ini)
      .lt("primeira_interacao", fim),
    s.from("ff_eventos").select("telefone").eq("stage", "agendado").gte("created_at", ini),
    s.from("site_pedidos").select("canal").gte("criado_em", ini).lt("criado_em", fim),
  ]);
  const pedidos: Record<Canal, number> = { google: 0, meta: 0, organico: 0 };
  for (const r of (ped.data ?? []) as { canal: string }[]) {
    pedidos[r.canal === "google" ? "google" : r.canal === "meta" ? "meta" : "organico"]++;
  }

  const agendou = new Set<string>(((evt.data ?? []) as { telefone: string }[]).map((r) => r.telefone));

  const acc: Record<Canal, { capturados: number; engajados: number; agendados: number; fechados: number; receita: number }> = {
    google: { capturados: 0, engajados: 0, agendados: 0, fechados: 0, receita: 0 },
    meta: { capturados: 0, engajados: 0, agendados: 0, fechados: 0, receita: 0 },
    organico: { capturados: 0, engajados: 0, agendados: 0, fechados: 0, receita: 0 },
  };
  for (const r of (cont.data ?? []) as ContatoRow[]) {
    const c = acc[classificarCanal(r.origem_ad, r.origem_campanha)];
    c.capturados++;
    if ((r.total_mensagens ?? 0) >= 2) c.engajados++;
    if (agendou.has(r.telefone)) c.agendados++;
    if (r.fechado) {
      c.fechados++;
      c.receita += Number(r.valor_fechado ?? 0);
    }
  }

  const gRows = (goog.data ?? []) as {
    dia: string;
    custo: number | string;
    cliques: number;
    impressoes: number;
    conversoes: number | string;
    atualizado_em: string | null;
  }[];
  const googleGasto = gRows.reduce((t, r) => t + Number(r.custo), 0);
  const googleCliques = gRows.reduce((t, r) => t + Number(r.cliques), 0);
  const googleConv = gRows.reduce((t, r) => t + Number(r.conversoes), 0);
  const metaGasto = metaDias.reduce((t, d) => t + d.investimento, 0);
  const metaLeads = metaDias.reduce((t, d) => t + d.leads_meta, 0);

  const gPorDia = new Map<string, number>();
  for (const r of gRows) gPorDia.set(r.dia, (gPorDia.get(r.dia) ?? 0) + Number(r.custo));
  const mPorDia = new Map(metaDias.map((d) => [d.data, d.investimento]));
  const dias = datasEntre(desde, ate).map((data) => ({
    data,
    google: gPorDia.get(data) ?? 0,
    meta: mPorDia.get(data) ?? 0,
  }));

  const atualizadoGoogle = gRows.reduce<string | null>(
    (m, r) => (r.atualizado_em && (!m || r.atualizado_em > m) ? r.atualizado_em : m),
    null,
  );

  return {
    canais: [
      montarCanal("google", { investimento: googleGasto, cliques: googleCliques, conversas_plataforma: Math.round(googleConv), pedidos_site: pedidos.google, ...acc.google }),
      montarCanal("meta", { investimento: metaGasto, cliques: null, conversas_plataforma: metaLeads, pedidos_site: pedidos.meta, ...acc.meta }),
      montarCanal("organico", { investimento: 0, cliques: null, conversas_plataforma: null, pedidos_site: pedidos.organico, ...acc.organico }),
    ],
    dias,
    googleSincronizado: gRows.length > 0,
    atualizadoGoogle,
  };
}
