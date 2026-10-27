// CONVERSÕES DE VOLTA PARA OS ANÚNCIOS: toda avaliação marcada de alguém que chegou por clique de anúncio
// vira uma linha em `conversoes` (gatilho do banco). Daqui saem:
//   • Meta (API de Conversões): enviado pelo painel, assim que existir o token META_CAPI_TOKEN (só você cria e cola no EasyPanel);
//   • Google Ads: ação "Agendamento confirmado (CRM)", lida pelo envio agendado do Google Ads
//     (arquivo /api/ingest/conversoes-google) ou enviada direto pelo assistente.
// PRIVACIDADE: não vai nome, telefone, e-mail nem dado de saúde. O Google recebe o código do clique (gclid) e a hora;
// a Meta recebe o código do clique (fbc). O evento da Meta é o genérico "Schedule". Nada de preço.
import { getClient } from "./db";

const PIXEL_PADRAO = "26282203298057488";
const GRAPH = "https://graph.facebook.com/v21.0";

export interface ResultadoMeta {
  ok: boolean;
  enviados: number;
  erros: number;
  motivo?: string;
}

/** Envia à Meta as conversões pendentes (máximo 25 por rodada). Sem token configurado, não faz nada. */
export async function enviarMetaPendentes(): Promise<ResultadoMeta> {
  const token = (process.env.META_CAPI_TOKEN ?? "").trim();
  if (!token) return { ok: true, enviados: 0, erros: 0, motivo: "META_CAPI_TOKEN não configurado" };
  const pixel = (process.env.META_PIXEL_ID ?? "").trim() || PIXEL_PADRAO;
  const teste = (process.env.META_TEST_EVENT_CODE ?? "").trim();

  const sb = getClient();
  const r = await sb
    .from("conversoes")
    .select("id, agendamento_id, telefone, fbclid, evento_em, tentativas")
    .eq("canal", "meta")
    .eq("status", "pendente")
    .lt("tentativas", 5)
    .order("id", { ascending: true })
    .limit(25);
  if (r.error) return { ok: false, enviados: 0, erros: 0, motivo: r.error.message };
  const linhas = (r.data ?? []) as {
    id: number;
    agendamento_id: string;
    telefone: string;
    fbclid: string | null;
    evento_em: string;
    tentativas: number;
  }[];
  let enviados = 0;
  let erros = 0;

  for (const c of linhas) {
    if (!c.fbclid) {
      await sb.from("conversoes").update({ status: "ignorado", resposta: "sem fbclid" }).eq("id", c.id);
      continue;
    }
    // momento do clique (aproximado pela origem gravada) para montar o fbc
    const o = await sb.from("ff_contatos").select("origem_em").eq("telefone", c.telefone).limit(1);
    const quando = (o.data?.[0] as { origem_em?: string } | undefined)?.origem_em ?? c.evento_em;
    const evento = {
      event_name: "Schedule",
      event_time: Math.floor(new Date(c.evento_em).getTime() / 1000),
      event_id: `ag-${c.agendamento_id}`,
      action_source: "chat",
      user_data: { fbc: `fb.1.${new Date(quando).getTime()}.${c.fbclid}` },
    };
    try {
      const resp = await fetch(`${GRAPH}/${pixel}/events`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: [evento], ...(teste ? { test_event_code: teste } : {}) }),
        signal: AbortSignal.timeout(15000),
      });
      const texto = (await resp.text()).slice(0, 300);
      if (resp.ok) {
        enviados++;
        await sb
          .from("conversoes")
          .update({ status: "enviado", enviado_em: new Date().toISOString(), tentativas: c.tentativas + 1, resposta: texto })
          .eq("id", c.id);
      } else {
        erros++;
        await sb.from("conversoes").update({ tentativas: c.tentativas + 1, resposta: `HTTP ${resp.status}: ${texto}` }).eq("id", c.id);
      }
    } catch (e) {
      erros++;
      await sb
        .from("conversoes")
        .update({ tentativas: c.tentativas + 1, resposta: (e instanceof Error ? e.message : "erro").slice(0, 200) })
        .eq("id", c.id);
    }
  }
  return { ok: erros === 0, enviados, erros };
}

const csvCampo = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const dataHoraSP = (iso: string) => {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

/**
 * Arquivo CSV no formato do envio de conversões por cliques do Google Ads (últimos 60 dias).
 * É idempotente: o Google ignora o que já recebeu (mesmo código de clique, ação e hora).
 */
export async function csvConversoesGoogle(): Promise<string> {
  const desde = new Date(Date.now() - 60 * 86400000).toISOString();
  const r = await getClient()
    .from("conversoes")
    .select("gclid, acao, evento_em, agendamento_id")
    .eq("canal", "google")
    .in("status", ["pendente", "enviado"])
    .gte("evento_em", desde)
    .order("evento_em", { ascending: true })
    .limit(5000);
  const linhas = ((r.data ?? []) as { gclid: string | null; acao: string; evento_em: string; agendamento_id: string }[]).filter(
    (x) => x.gclid,
  );
  return (
    [
      "Parameters:TimeZone=America/Sao_Paulo",
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID",
      ...linhas.map((x) => [csvCampo(x.gclid as string), csvCampo(x.acao), dataHoraSP(x.evento_em), "", "", x.agendamento_id].join(",")),
    ].join("\n") + "\n"
  );
}
