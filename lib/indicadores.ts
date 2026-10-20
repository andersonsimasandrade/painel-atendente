// Indicadores do funil COMPLETO, do clique ao paciente: visitou o site → clicou para agendar/WhatsApp →
// pediu o agendamento → conversou → agendou → compareceu → fechou. Cada degrau é medido pelo que
// aconteceu de verdade no site (site_eventos) e no CRM (site_pedidos, agendamentos, ff_contatos),
// e é aberto por canal, campanha e criativo (utm_campaign / utm_content). O gasto vem das plataformas.
// Server-only.
import { getClient } from "./db";
import { addDias } from "./trafego";

export const SEM_CAMPANHA = "(sem campanha)";
export const SEM_CRIATIVO = "(sem identificação)";

/** utm_campaign que usamos nos links → nome da campanha no Google Ads (para ligar ao custo). */
export const CAMPANHA_UTM_PARA_GOOGLE: Record<string, string> = {
  "busca-fisio-floripa": "Busca - Fisioterapia Florianópolis",
};

export interface Linha {
  chave: string;
  canal: string;
  campanha: string;
  criativo: string;
  visitantes: number;
  cliques: number; // visitantes únicos que clicaram em WhatsApp / telefone / agendar
  formularios: number; // começaram a preencher o formulário de agendamento
  pedidos: number;
  conversas: number; // pedidos cujo código chegou no WhatsApp (viraram conversa)
  agendados: number;
  compareceram: number;
  fechados: number;
  receita: number;
  custo: number | null;
}

export interface Indicadores {
  desde: string;
  ate: string;
  total: Linha;
  porCanal: Linha[];
  porCampanha: Linha[];
  porCriativo: Linha[];
  custo: { google: number; meta: number };
  temEventos: boolean;
}

const vazia = (chave: string, canal: string, campanha: string, criativo: string): Linha => ({
  chave,
  canal,
  campanha,
  criativo,
  visitantes: 0,
  cliques: 0,
  formularios: 0,
  pedidos: 0,
  conversas: 0,
  agendados: 0,
  compareceram: 0,
  fechados: 0,
  receita: 0,
  custo: null,
});

/** Últimos 8 dígitos: junta o mesmo telefone com ou sem 55 e com ou sem o 9. */
export const chaveTelefone = (t: string | null | undefined): string => String(t ?? "").replace(/\D/g, "").slice(-8);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type Evento = {
  visitante: string;
  tipo: string;
  canal: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  detalhe: { destino?: string } | null;
};
export type Pedido = {
  canal: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  telefone: string | null;
};
export type Desfecho = { agendou: boolean; compareceu: boolean; fechou: boolean; receita: number };

/** PURA. Agrupa eventos, pedidos e desfechos numa lista de linhas por canal / campanha / criativo. */
export function agregar(
  eventos: Evento[],
  pedidos: Pedido[],
  desfecho: Map<string, Desfecho>,
  nivel: "canal" | "campanha" | "criativo" | "total",
): Linha[] {
  const mapa = new Map<string, Linha>();
  const pega = (canal: string | null, campanha: string | null, criativo: string | null) => {
    const c = canal || "direto";
    const p = campanha || SEM_CAMPANHA;
    const k = criativo || SEM_CRIATIVO;
    let chave: string;
    let lc = c;
    let lp = "";
    let lk = "";
    if (nivel === "total") {
      chave = "total";
      lc = "todos";
    } else if (nivel === "canal") {
      chave = c;
    } else if (nivel === "campanha") {
      chave = `${c}|${p}`;
      lp = p;
    } else {
      chave = `${c}|${p}|${k}`;
      lp = p;
      lk = k;
    }
    let l = mapa.get(chave);
    if (!l) {
      l = vazia(chave, lc, lp, lk);
      mapa.set(chave, l);
    }
    return l;
  };

  // Visitantes únicos por degrau: a mesma pessoa conta uma vez por linha.
  const vistos = {
    visitantes: new Map<string, Set<string>>(),
    cliques: new Map<string, Set<string>>(),
    formularios: new Map<string, Set<string>>(),
  };
  const marca = (m: Map<string, Set<string>>, chave: string, v: string) => {
    let s = m.get(chave);
    if (!s) {
      s = new Set();
      m.set(chave, s);
    }
    s.add(v);
  };
  for (const e of eventos) {
    const l = pega(e.canal, e.utm_campaign, e.utm_content);
    if (e.tipo === "visita") marca(vistos.visitantes, l.chave, e.visitante);
    else if (e.tipo === "clique" && ["whatsapp", "telefone", "agendar"].includes(e.detalhe?.destino ?? ""))
      marca(vistos.cliques, l.chave, e.visitante);
    else if (e.tipo === "form_inicio") marca(vistos.formularios, l.chave, e.visitante);
  }
  for (const l of mapa.values()) {
    l.visitantes = vistos.visitantes.get(l.chave)?.size ?? 0;
    l.cliques = vistos.cliques.get(l.chave)?.size ?? 0;
    l.formularios = vistos.formularios.get(l.chave)?.size ?? 0;
  }

  for (const p of pedidos) {
    const l = pega(p.canal, p.utm_campaign, p.utm_content);
    l.pedidos++;
    if (p.telefone) {
      l.conversas++;
      const d = desfecho.get(chaveTelefone(p.telefone));
      if (d?.agendou) l.agendados++;
      if (d?.compareceu) l.compareceram++;
      if (d?.fechou) {
        l.fechados++;
        l.receita += d.receita;
      }
    }
  }
  return [...mapa.values()];
}

const ordena = (a: Linha, b: Linha) =>
  b.fechados - a.fechados ||
  b.compareceram - a.compareceram ||
  b.conversas - a.conversas ||
  b.pedidos - a.pedidos ||
  b.visitantes - a.visitantes;

export async function montarIndicadores(desde: string, ate: string): Promise<Indicadores> {
  const s = getClient();
  const ini = `${desde}T00:00:00-03:00`;
  const fim = `${addDias(ate, 1)}T00:00:00-03:00`;

  const [ev, pe, ag, ct, gg, mt] = await Promise.all([
    s
      .from("site_eventos")
      .select("visitante, tipo, canal, utm_campaign, utm_content, detalhe")
      .gte("criado_em", ini)
      .lt("criado_em", fim)
      .limit(50000),
    s
      .from("site_pedidos")
      .select("canal, utm_campaign, utm_content, telefone")
      .gte("criado_em", ini)
      .lt("criado_em", fim)
      .limit(20000),
    s.from("agendamentos").select("telefone_lead, status").limit(20000),
    s.from("ff_contatos").select("telefone, fechado, valor_fechado").eq("fechado", true).limit(20000),
    s.from("trafego_google_diario").select("campanha, custo").gte("dia", desde).lte("dia", ate),
    s.from("trafego_diario").select("investimento").gte("data", desde).lte("data", ate),
  ]);

  const eventos = (ev.data ?? []) as Evento[];
  const pedidos = (pe.data ?? []) as Pedido[];

  const desfecho = new Map<string, Desfecho>();
  const d = (t: string) => {
    const k = chaveTelefone(t);
    let x = desfecho.get(k);
    if (!x) {
      x = { agendou: false, compareceu: false, fechou: false, receita: 0 };
      desfecho.set(k, x);
    }
    return x;
  };
  for (const a of (ag.data ?? []) as { telefone_lead: string; status: string }[]) {
    if (!a.telefone_lead || a.status === "cancelado") continue;
    const x = d(a.telefone_lead);
    x.agendou = true;
    if (a.status === "compareceu") x.compareceu = true;
  }
  for (const c of (ct.data ?? []) as { telefone: string; valor_fechado: number | string | null }[]) {
    const x = d(c.telefone);
    x.fechou = true;
    x.receita += Number(c.valor_fechado ?? 0);
  }

  const gastoGoogle = new Map<string, number>();
  let totalGoogle = 0;
  for (const r of (gg.data ?? []) as { campanha: string; custo: number | string }[]) {
    const v = Number(r.custo);
    totalGoogle += v;
    const k = norm(r.campanha ?? "");
    gastoGoogle.set(k, (gastoGoogle.get(k) ?? 0) + v);
  }
  const totalMeta = ((mt.data ?? []) as { investimento: number | string }[]).reduce(
    (t, r) => t + Number(r.investimento),
    0,
  );

  const porCanal = agregar(eventos, pedidos, desfecho, "canal").sort(ordena);
  for (const l of porCanal) l.custo = l.canal === "google" ? totalGoogle : l.canal === "meta" ? totalMeta : null;

  const porCampanha = agregar(eventos, pedidos, desfecho, "campanha").sort(ordena);
  for (const l of porCampanha) {
    if (l.canal !== "google") continue;
    const nome = CAMPANHA_UTM_PARA_GOOGLE[l.campanha] ?? l.campanha;
    const c = gastoGoogle.get(norm(nome));
    if (c != null) l.custo = c;
  }

  const porCriativo = agregar(eventos, pedidos, desfecho, "criativo").sort(ordena);
  const total = agregar(eventos, pedidos, desfecho, "total")[0] ?? vazia("total", "todos", "", "");
  total.custo = totalGoogle + totalMeta;

  return {
    desde,
    ate,
    total,
    porCanal,
    porCampanha,
    porCriativo,
    custo: { google: totalGoogle, meta: totalMeta },
    temEventos: eventos.length > 0,
  };
}
