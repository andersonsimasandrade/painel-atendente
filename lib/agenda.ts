import { getClient } from "./db";
import { Vendedor } from "./types";
import { variantesTelefone } from "./telefone";

export async function getVendedorBySlug(slug: string): Promise<Vendedor | null> {
  try {
    const s = getClient();
    const res = await s
      .from("vendedores")
      .select("id, slug, nome, instancia_whatsapp, fuso, disponibilidade, ativo")
      .eq("slug", slug)
      .eq("ativo", true)
      .limit(1);
    if (res.error || !res.data?.length) return null;
    return res.data[0] as unknown as Vendedor;
  } catch (e) {
    console.error("[getVendedorBySlug]", e);
    return null;
  }
}

// ISOs (data_hora) já reservados do vendedor, de ~1h atrás pra frente.
export async function getOcupados(vendedorId: string): Promise<Set<string>> {
  try {
    const s = getClient();
    const desde = new Date(Date.now() - 3600000).toISOString();
    const res = await s
      .from("agendamentos")
      .select("data_hora")
      .eq("vendedor_id", vendedorId)
      .neq("status", "cancelado")
      .gte("data_hora", desde);
    if (res.error || !res.data) return new Set();
    return new Set(
      res.data.map((r) => new Date((r as { data_hora: string }).data_hora).toISOString()),
    );
  } catch {
    return new Set();
  }
}

/**
 * Resolve um telefone digitado para a forma EXATA gravada em ff_contatos,
 * tolerando o nono dígito (a pessoa digita com o 9; o WhatsApp muitas vezes
 * entrega sem). Devolve null se não for lead.
 *
 * É o gate da rota pública de agendamento — e a correção do falso
 * "não encontramos seu cadastro" que rejeitava lead de verdade.
 */
export async function resolverLead(telefone: string): Promise<string | null> {
  const variantes = variantesTelefone(telefone);
  if (!variantes.length) return null;
  try {
    const s = getClient();
    const res = await s.from("ff_contatos").select("telefone").in("telefone", variantes).limit(2);
    if (res.error || !res.data?.length) return null;
    // Se houver mais de uma forma gravada, prefere a que a pessoa digitou.
    const achados = (res.data as { telefone: string }[]).map((r) => r.telefone);
    return achados.find((t) => t === variantes[0]) ?? achados[0];
  } catch {
    return null;
  }
}

// Compat: mantido para quem só precisa do booleano.
export async function existeLead(telefone: string): Promise<boolean> {
  return (await resolverLead(telefone)) !== null;
}

export async function getNomeLead(telefone: string): Promise<string | null> {
  const variantes = variantesTelefone(telefone);
  if (!variantes.length) return null;
  try {
    const s = getClient();
    const res = await s.from("ff_contatos").select("nome").in("telefone", variantes).limit(1);
    if (res.error || !res.data?.length) return null;
    const n = (res.data[0] as { nome: string | null }).nome;
    return n && n.trim() ? n.trim() : null;
  } catch {
    return null;
  }
}

// ── Fase 2: listagem interna, presença e lembretes ─────────────────────────

export type AgendamentoView = {
  id: string;
  telefone_lead: string;
  nome_lead: string | null;
  data_hora: string;
  status: string;
  origem: string | null;
  lembrete_enviado_em: string | null;
  vendedor_nome: string;
  vendedor_slug: string;
};

export type AgendamentoLembrete = {
  id: string;
  telefone_lead: string;
  nome_lead: string | null;
  data_hora: string;
  instancia: string;
  vendedor_nome: string;
};

type VendRow = { id: string; nome: string; slug: string; instancia_whatsapp: string };
type AgRow = {
  id: string;
  telefone_lead: string;
  nome_lead: string | null;
  data_hora: string;
  status: string;
  origem: string | null;
  lembrete_enviado_em: string | null;
  vendedor_id: string;
};

/** Consultores ativos (p/ o filtro do admin). Vazio em erro — fail-safe. */
export async function listarVendedores(): Promise<{ slug: string; nome: string }[]> {
  try {
    const res = await getClient()
      .from("vendedores")
      .select("slug, nome")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (res.error || !res.data) return [];
    return res.data as unknown as { slug: string; nome: string }[];
  } catch (e) {
    console.error("[listarVendedores]", e);
    return [];
  }
}

// Poucos vendedores → carrega num Map (evita ambiguidade de shape do join).
async function getVendedoresMap(): Promise<Map<string, VendRow>> {
  const m = new Map<string, VendRow>();
  try {
    const res = await getClient().from("vendedores").select("id, nome, slug, instancia_whatsapp");
    if (!res.error && res.data) {
      for (const v of res.data as unknown as VendRow[]) m.set(v.id, v);
    }
  } catch (e) {
    console.error("[getVendedoresMap]", e);
  }
  return m;
}

// Agendamentos de ~7 dias atrás pra frente (próximas + a marcar + recentes marcadas).
// `slug` (opcional) restringe a um vendedor — usado pelo papel 'vendedor'.
export async function listarAgendamentos(slug?: string): Promise<AgendamentoView[]> {
  try {
    const s = getClient();
    const desde = new Date(Date.now() - 7 * 86400000).toISOString();
    const [res, vmap] = await Promise.all([
      s
        .from("agendamentos")
        .select(
          "id, telefone_lead, nome_lead, data_hora, status, origem, lembrete_enviado_em, vendedor_id",
        )
        .neq("status", "cancelado")
        .gte("data_hora", desde)
        .order("data_hora", { ascending: true }),
      getVendedoresMap(),
    ]);
    if (res.error || !res.data) return [];
    const out = (res.data as unknown as AgRow[]).map((r) => {
      const v = vmap.get(r.vendedor_id);
      return {
        id: r.id,
        telefone_lead: r.telefone_lead,
        nome_lead: r.nome_lead,
        data_hora: r.data_hora,
        status: r.status,
        origem: r.origem,
        lembrete_enviado_em: r.lembrete_enviado_em,
        vendedor_nome: v?.nome ?? "—",
        vendedor_slug: v?.slug ?? "",
      };
    });
    return slug ? out.filter((a) => a.vendedor_slug === slug) : out;
  } catch (e) {
    console.error("[listarAgendamentos]", e);
    return [];
  }
}

const PRESENCAS = new Set(["compareceu", "faltou", "agendado"]); // 'agendado' = desfazer
// vendedorId (opcional) restringe o UPDATE ao dono — evita IDOR (vendedor marcar
// presença de reunião de outro). Admin não passa e mexe em qualquer uma.
export async function marcarPresenca(
  id: string,
  status: string,
  vendedorId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!id || !PRESENCAS.has(status)) return { ok: false, error: "Dados inválidos." };
  try {
    let q = getClient().from("agendamentos").update({ status }).eq("id", id);
    if (vendedorId) q = q.eq("vendedor_id", vendedorId);
    const res = await q.select("id");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Agendamento não encontrado." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao marcar." };
  }
}

// Ativos, sem lembrete, do agora pra frente. A janela (≤ 3h30) é aplicada pela
// função pura selecionarLembretes na rota (testável).
export async function getAgendamentosParaLembrete(): Promise<AgendamentoLembrete[]> {
  try {
    const s = getClient();
    const agoraISO = new Date().toISOString();
    const [res, vmap] = await Promise.all([
      s
        .from("agendamentos")
        .select("id, telefone_lead, nome_lead, data_hora, vendedor_id")
        .in("status", ["agendado", "confirmado"])
        .is("lembrete_enviado_em", null)
        .gte("data_hora", agoraISO)
        .order("data_hora", { ascending: true }),
      getVendedoresMap(),
    ]);
    if (res.error || !res.data) return [];
    return (res.data as unknown as AgRow[])
      .map((r) => {
        const v = vmap.get(r.vendedor_id);
        return {
          id: r.id,
          telefone_lead: r.telefone_lead,
          nome_lead: r.nome_lead,
          data_hora: r.data_hora,
          instancia: v?.instancia_whatsapp ?? "",
          vendedor_nome: v?.nome ?? "",
        };
      })
      .filter((r) => r.instancia); // sem instância não dá p/ enviar
  } catch (e) {
    console.error("[getAgendamentosParaLembrete]", e);
    return [];
  }
}

export async function marcarLembreteEnviado(id: string): Promise<void> {
  try {
    await getClient()
      .from("agendamentos")
      .update({ lembrete_enviado_em: new Date().toISOString() })
      .eq("id", id);
  } catch (e) {
    console.error("[marcarLembreteEnviado]", e);
  }
}

// Grava a reserva. Retorna conflito=true se o slot já estava ocupado (UNIQUE).
export async function criarAgendamento(a: {
  vendedorId: string;
  telefone: string;
  nome: string | null;
  dataHora: string;
  origem: string;
}): Promise<{ ok: true; id: string } | { ok: false; conflito?: boolean; error: string }> {
  try {
    const s = getClient();
    const res = await s
      .from("agendamentos")
      .insert({
        vendedor_id: a.vendedorId,
        telefone_lead: a.telefone,
        nome_lead: a.nome,
        data_hora: a.dataHora,
        status: "agendado",
        origem: a.origem,
      })
      .select("id");
    if (res.error) {
      const conflito = /duplicate key|unique/i.test(res.error.message);
      return { ok: false, conflito, error: res.error.message };
    }
    return { ok: true, id: (res.data?.[0] as { id: string })?.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao gravar." };
  }
}
