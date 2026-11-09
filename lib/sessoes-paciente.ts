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
  const sessoes = ((ag.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    data_hora: String(r.data_hora),
    status: String(r.status),
    local: r.local === "capoeiras" || r.local === "centro" ? (r.local as "capoeiras" | "centro") : null,
    duracao_min: Number(r.duracao_min) || 60,
  }));
  const comprado = ((neg.data ?? []) as { sessoes: number | null }[]).reduce((t, n) => t + Math.max(1, Number(n.sessoes) || 1), 0);
  const realizadas = sessoes.filter((s) => s.status === "compareceu").length;
  const marcadas = sessoes.filter((s) => s.status === "agendado" || s.status === "confirmado").length;
  return { sessoes, pacote: { comprado, realizadas, marcadas, restantes: Math.max(0, comprado - realizadas - marcadas) } };
}
