// Mensagens AGENDADAS pelo consultor no chat ("manda sexta às 9h") —
// tabela msgs_agendadas, processada pelo MESMO tique de /api/cron/funil.
// Diferente das sequências do funil: aqui a pessoa escreveu a mensagem e
// ESCOLHEU o horário, então NÃO adiamos pro expediente nem cancelamos se o
// lead responder — quem agendou cancela pelo painel se mudar de ideia.
// Server-only.

import { getClient } from "./db";
import { variantesTelefone } from "./telefone";

export interface MsgAgendada {
  id: number;
  telefone: string;
  texto: string;
  enviar_em: string; // ISO
  criado_por: string | null;
  status: string;
}

const MAX_TEXTO = 4096;
const MAX_DIAS_FUTURO = 90;
const MAX_PENDENTES_POR_LEAD = 10;

export async function listarAgendadas(telefone: string): Promise<MsgAgendada[]> {
  try {
    const res = await getClient()
      .from("msgs_agendadas")
      .select("id, telefone, texto, enviar_em, criado_por, status")
      .in("telefone", variantesTelefone(telefone))
      .eq("status", "pendente")
      .order("enviar_em", { ascending: true })
      .limit(50);
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []) as MsgAgendada[];
  } catch (e) {
    console.error("[agendadas] listar:", e);
    return [];
  }
}

export async function criarAgendada(
  telefone: string,
  texto: string,
  quandoIso: string,
  autor: string,
): Promise<{ ok: boolean; error?: string }> {
  const t = String(texto ?? "").trim();
  if (!t) return { ok: false, error: "Escreva a mensagem antes de agendar." };
  if (t.length > MAX_TEXTO) {
    return { ok: false, error: `Mensagem muito longa (máx. ${MAX_TEXTO} caracteres).` };
  }
  const quando = new Date(quandoIso ?? "");
  if (Number.isNaN(quando.getTime())) return { ok: false, error: "Data/hora inválida." };
  const agora = Date.now();
  if (quando.getTime() < agora - 60_000) {
    return { ok: false, error: "Esse horário já passou — escolha um no futuro." };
  }
  if (quando.getTime() > agora + MAX_DIAS_FUTURO * 86400000) {
    return { ok: false, error: `No máximo ${MAX_DIAS_FUTURO} dias pra frente.` };
  }
  try {
    const supabase = getClient();
    const variantes = variantesTelefone(telefone);

    const pend = await supabase
      .from("msgs_agendadas")
      .select("id", { count: "exact", head: true })
      .in("telefone", variantes)
      .eq("status", "pendente");
    if (pend.error) {
      console.error("[agendadas] count pendentes:", pend.error.message);
      return { ok: false, error: "Não deu pra conferir as pendentes agora — tente de novo." };
    }
    if ((pend.count ?? 0) >= MAX_PENDENTES_POR_LEAD) {
      return { ok: false, error: "Muitas mensagens pendentes pra este lead — cancele alguma." };
    }

    // Grava no telefone como está em ff_contatos (o cron resolve o canal).
    const contatoRes = await supabase
      .from("ff_contatos")
      .select("telefone")
      .in("telefone", variantes)
      .limit(1);
    const alvo =
      (contatoRes.data?.[0] as { telefone?: string } | undefined)?.telefone ?? telefone;

    const ins = await supabase.from("msgs_agendadas").insert({
      telefone: alvo,
      texto: t,
      enviar_em: quando.toISOString(),
      criado_por: String(autor ?? "").trim().slice(0, 60) || null,
    });
    if (ins.error) return { ok: false, error: ins.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao agendar." };
  }
}

export async function cancelarAgendada(
  telefone: string,
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Agendamento inválido." };
  try {
    // Escopo: o agendamento precisa ser DESTE lead (a rota já validou o lead).
    const res = await getClient()
      .from("msgs_agendadas")
      .update({ status: "cancelada", motivo: "cancelada no painel" })
      .eq("id", id)
      .in("telefone", variantesTelefone(telefone))
      .eq("status", "pendente")
      .select("id");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Agendamento não encontrado (já saiu?)." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao cancelar." };
  }
}
