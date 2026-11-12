// SESSÕES DO PACIENTE: as consultas dele (passadas e futuras) e o saldo do pacote comprado.
//   pacote comprado = soma de negocios.sessoes das vendas concretizadas
//   realizadas      = sessões com presença confirmada ("compareceu")
//   marcadas        = sessões agendadas ainda não confirmadas (futuras ou a confirmar)
//   restantes       = comprado − realizadas − marcadas (nunca negativo)
// Server-only.
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";

export interface SessaoPaciente {
  id: string;
  data_hora: string;
  status: "agendado" | "confirmado" | "compareceu" | "faltou" | "cancelado" | string;
  local: "capoeiras" | "centro" | null;
  duracao_min: number;
  remarcacoes: number; // quantas vezes esta consulta foi remarcada
  cobranca: { status: string; valor: number; vencimento: string } | null; // cobrança da sessão no Asaas
}

export interface ResumoPacote {
  comprado: number;
  realizadas: number;
  marcadas: number;
  restantes: number;
}

export async function listarSessoesPaciente(telefone: string): Promise<{ sessoes: SessaoPaciente[]; pacote: ResumoPacote }> {
  const sb = getClient();
  const variantes = variantesTelefone(telefone);
  const [ag, neg] = await Promise.all([
    sb
      .from("agendamentos")
      .select("id, data_hora, status, local, duracao_min")
      .in("telefone_lead", variantes)
      .order("data_hora", { ascending: false })
      .limit(100),
    sb.from("negocios").select("sessoes").in("telefone", variantes).eq("status", "ganho"),
  ]);
  const ids = ((ag.data ?? []) as { id: string }[]).map((r) => String(r.id));
  const remarc = new Map<string, number>();
  const cobr = new Map<string, { status: string; valor: number; vencimento: string }>();
  if (ids.length) {
    const cb = await sb.from("cobrancas").select("agendamento_id, status, valor, vencimento").in("agendamento_id", ids).neq("status", "CANCELADA").limit(500);
    for (const x of (cb.data ?? []) as { agendamento_id: string; status: string; valor: number; vencimento: string }[]) cobr.set(x.agendamento_id, { status: x.status, valor: Number(x.valor), vencimento: x.vencimento });
    const h = await sb.from("agendamento_historico").select("agendamento_id").eq("tipo", "remarcado").in("agendamento_id", ids).limit(2000);
    for (const x of (h.data ?? []) as { agendamento_id: string }[]) remarc.set(x.agendamento_id, (remarc.get(x.agendamento_id) ?? 0) + 1);
  }
  const sessoes = ((ag.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    data_hora: String(r.data_hora),
    status: String(r.status),
    local: r.local === "capoeiras" || r.local === "centro" ? (r.local as "capoeiras" | "centro") : null,
    duracao_min: Number(r.duracao_min) || 60,
    remarcacoes: remarc.get(String(r.id)) ?? 0,
    cobranca: cobr.get(String(r.id)) ?? null,
  }));
  const comprado = ((neg.data ?? []) as { sessoes: number | null }[]).reduce((t, n) => t + Math.max(1, Number(n.sessoes) || 1), 0);
  const realizadas = sessoes.filter((s) => s.status === "compareceu").length;
  const marcadas = sessoes.filter((s) => s.status === "agendado" || s.status === "confirmado").length;
  return { sessoes, pacote: { comprado, realizadas, marcadas, restantes: Math.max(0, comprado - realizadas - marcadas) } };
}
