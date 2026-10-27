// Avaliações agendadas (tabela agendamentos) com a origem de cada contato: base do "custo por paciente novo".
// Server-only.
import { getClient } from "./db";
import { addDias, hojeSP } from "./trafego";

export interface LinhaAvaliacao {
  id: string;
  data_hora: string;
  nome: string | null;
  telefone: string;
  local: string | null;
  origem_canal: string | null;
  origem: string | null;
  status: string;
}

/** Segunda a domingo da semana atual (datas AAAA-MM-DD, horário de Brasília). */
export function semanaAtual(): { desde: string; ate: string } {
  const hoje = hojeSP();
  const dow = new Date(`${hoje}T00:00:00Z`).getUTCDay();
  const desde = addDias(hoje, -(dow === 0 ? 6 : dow - 1));
  return { desde, ate: addDias(desde, 6) };
}

/** Avaliações que acontecem na semana (pela data da consulta), com a origem do contato. */
export async function avaliacoesDaSemana(): Promise<LinhaAvaliacao[]> {
  const { desde, ate } = semanaAtual();
  const r = await getClient()
    .from("agendamentos")
    .select("id, data_hora, nome_lead, telefone_lead, local, origem_canal, origem, status")
    .gte("data_hora", `${desde}T00:00:00-03:00`)
    .lt("data_hora", `${addDias(ate, 1)}T00:00:00-03:00`)
    .neq("status", "cancelado")
    .order("data_hora", { ascending: true })
    .limit(200);
  return ((r.data ?? []) as Record<string, unknown>[]).map((x) => ({
    id: String(x.id),
    data_hora: String(x.data_hora),
    nome: (x.nome_lead as string | null) ?? null,
    telefone: String(x.telefone_lead),
    local: (x.local as string | null) ?? null,
    origem_canal: (x.origem_canal as string | null) ?? null,
    origem: (x.origem as string | null) ?? null,
    status: String(x.status),
  }));
}

/** Quantas avaliações foram MARCADAS no período, por origem do contato (cancelas não contam). */
export async function marcadasPorOrigem(desde: string, ate: string): Promise<Record<string, number>> {
  const r = await getClient()
    .from("agendamentos")
    .select("origem_canal")
    .gte("criado_em", `${desde}T00:00:00-03:00`)
    .lt("criado_em", `${addDias(ate, 1)}T00:00:00-03:00`)
    .neq("status", "cancelado")
    .limit(5000);
  const out: Record<string, number> = {};
  for (const x of (r.data ?? []) as { origem_canal: string | null }[]) {
    const k = x.origem_canal ?? "sem_origem";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
