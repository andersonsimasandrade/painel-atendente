// PACIENTES EM TRATAMENTO: visão de acompanhamento. Junta, por paciente, o pacote comprado, as sessões (feitas, marcadas, a confirmar),
// a tendência da dor, o plano de exercícios e o retorno do paciente, e aponta o que precisa de atenção (alertas).
// Em tratamento = já teve ao menos uma sessão realizada ou comprou pacote, e ainda não recebeu alta. Server-only.
import { getClient } from "./db";
import { ehNumeroInterno } from "./numeros-internos";

export type NivelAlerta = "alto" | "medio" | "info";
export interface AlertaPaciente {
  tipo: string;
  texto: string;
  nivel: NivelAlerta;
}

export interface PacienteTratamento {
  telefone: string;
  nome: string | null;
  encerrado: boolean;
  pacote: { comprado: number; realizadas: number; marcadas: number; restantes: number };
  ultimaSessao: { iso: string; local: string | null } | null;
  diasDesdeUltima: number | null;
  proxima: { iso: string; local: string | null } | null;
  aConfirmar: number;
  dor: { primeira: number | null; ultima: number | null; pontos: number[] };
  exercicios: { ativo: boolean; enviadoEm: string | null; ultimoRetorno: { dias: number | null; dor: number | null; em: string } | null };
  alertas: AlertaPaciente[];
  prioridade: number;
}

const DIA = 86400000;
const chave = (tel: string | null | undefined) => String(tel ?? "").replace(/\D/g, "").slice(-8);

interface Ag {
  telefone_lead: string;
  nome_lead: string | null;
  data_hora: string;
  status: string;
  local: string | null;
}

export async function listarPacientesTratamento(): Promise<PacienteTratamento[]> {
  const sb = getClient();
  const agora = Date.now();
  const [ag, neg, ct, ev, pr] = await Promise.all([
    sb.from("agendamentos").select("telefone_lead, nome_lead, data_hora, status, local").in("status", ["agendado", "confirmado", "compareceu", "faltou"]).order("data_hora", { ascending: true }).limit(5000),
    sb.from("negocios").select("telefone, sessoes").eq("status", "ganho").limit(5000),
    sb.from("ff_contatos").select("telefone, nome, tratamento_encerrado_em").limit(10000),
    sb.from("paciente_evolucao").select("telefone, data_sessao, dor_inicio, dor_fim").order("data_sessao", { ascending: true }).limit(5000),
    sb.from("prescricoes").select("id, telefone, ativa, enviado_em, criado_em").limit(2000),
  ]);
  const prescricoes = (pr.data ?? []) as { id: string; telefone: string; ativa: boolean; enviado_em: string | null; criado_em: string }[];
  const ck = prescricoes.length
    ? await sb.from("prescricao_checkins").select("prescricao_id, dias_feitos, dor, criado_em").in("prescricao_id", prescricoes.map((p) => p.id)).order("criado_em", { ascending: false }).limit(2000)
    : { data: [] as unknown[] };
  const checkins = (ck.data ?? []) as { prescricao_id: string; dias_feitos: number | null; dor: number | null; criado_em: string }[];

  // agrupa tudo pelo paciente (com ou sem o 9: últimos 8 dígitos)
  const agPor = new Map<string, Ag[]>();
  for (const a of (ag.data ?? []) as Ag[]) {
    const k = chave(a.telefone_lead);
    if (k.length >= 8) agPor.set(k, [...(agPor.get(k) ?? []), a]);
  }
  const comprado = new Map<string, number>();
  for (const n of (neg.data ?? []) as { telefone: string; sessoes: number | null }[]) {
    const k = chave(n.telefone);
    comprado.set(k, (comprado.get(k) ?? 0) + Math.max(1, Number(n.sessoes) || 1));
  }
  const contato = new Map<string, { telefone: string; nome: string | null; encerrado: string | null }>();
  for (const c of (ct.data ?? []) as { telefone: string; nome: string | null; tratamento_encerrado_em: string | null }[]) {
    contato.set(chave(c.telefone), { telefone: c.telefone, nome: c.nome, encerrado: c.tratamento_encerrado_em });
  }
  const dorPor = new Map<string, number[]>();
  for (const e of (ev.data ?? []) as { telefone: string; dor_inicio: number | null; dor_fim: number | null }[]) {
    const v = e.dor_inicio ?? e.dor_fim;
    if (v != null) dorPor.set(chave(e.telefone), [...(dorPor.get(chave(e.telefone)) ?? []), Number(v)]);
  }
  const planosPor = new Map<string, typeof prescricoes>();
  for (const p of prescricoes) planosPor.set(chave(p.telefone), [...(planosPor.get(chave(p.telefone)) ?? []), p]);

  const chaves = new Set<string>([...agPor.keys(), ...comprado.keys()]);
  const saida: PacienteTratamento[] = [];

  for (const k of chaves) {
    const lista = agPor.get(k) ?? [];
    const c = contato.get(k);
    const tel = c?.telefone ?? lista[0]?.telefone_lead ?? "";
    if (!tel || ehNumeroInterno(tel)) continue;

    const realizadasL = lista.filter((a) => a.status === "compareceu");
    const futuras = lista.filter((a) => (a.status === "agendado" || a.status === "confirmado") && new Date(a.data_hora).getTime() > agora);
    const aConfirmar = lista.filter((a) => (a.status === "agendado" || a.status === "confirmado") && new Date(a.data_hora).getTime() <= agora).length;
    const marcadas = lista.filter((a) => a.status === "agendado" || a.status === "confirmado").length;
    const pacoteComprado = comprado.get(k) ?? 0;
    if (!realizadasL.length && !pacoteComprado) continue; // só quem já começou (ou comprou) o tratamento

    const ultima = realizadasL[realizadasL.length - 1] ?? null;
    const diasDesdeUltima = ultima ? Math.floor((agora - new Date(ultima.data_hora).getTime()) / DIA) : null;
    const proxima = futuras[0] ?? null;
    const pontos = dorPor.get(k) ?? [];

    const planos = (planosPor.get(k) ?? []).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    const planoAtivo = planos.find((p) => p.ativa) ?? null;
    const idsPlanos = new Set(planos.map((p) => p.id));
    const ult = checkins.find((x) => idsPlanos.has(x.prescricao_id)) ?? null;

    const restantes = Math.max(0, pacoteComprado - realizadasL.length - marcadas);
    const encerrado = !!c?.encerrado;

    const alertas: AlertaPaciente[] = [];
    if (!encerrado) {
      if (aConfirmar > 0) alertas.push({ tipo: "confirmar", nivel: "medio", texto: `${aConfirmar} sessão(ões) já passou(aram): confirme se compareceu` });
      if (!proxima) {
        if (diasDesdeUltima != null && diasDesdeUltima > 15) alertas.push({ tipo: "sumiu", nivel: "alto", texto: `Sem sessão marcada e sem vir há ${diasDesdeUltima} dias` });
        else if (restantes > 0 || (diasDesdeUltima != null && diasDesdeUltima <= 15)) alertas.push({ tipo: "sem_proxima", nivel: "medio", texto: restantes > 0 ? `Sem próxima sessão marcada (${restantes} do pacote sem data)` : "Sem próxima sessão marcada" });
      }
      if (pontos.length >= 2 && pontos[pontos.length - 1] - pontos[pontos.length - 2] >= 2) alertas.push({ tipo: "dor_subiu", nivel: "alto", texto: `A dor subiu: ${pontos[pontos.length - 2]} → ${pontos[pontos.length - 1]}` });
      if (ult?.dor != null && ult.dor >= 7) alertas.push({ tipo: "dor_alta", nivel: "alto", texto: `Retorno dos exercícios com dor ${ult.dor}/10` });
      if (realizadasL.length > 0 && !planoAtivo) alertas.push({ tipo: "sem_exercicios", nivel: "info", texto: "Sem plano de exercícios para casa" });
      if (planoAtivo?.enviado_em && (!ult || new Date(ult.criado_em).getTime() < new Date(planoAtivo.enviado_em).getTime())) {
        const dias = Math.floor((agora - new Date(planoAtivo.enviado_em).getTime()) / DIA);
        if (dias >= 8) alertas.push({ tipo: "sem_retorno", nivel: "medio", texto: `Plano enviado há ${dias} dias, sem retorno do paciente` });
      }
      if (pacoteComprado > 0 && restantes === 0 && marcadas === 0 && realizadasL.length >= pacoteComprado) alertas.push({ tipo: "pacote_completo", nivel: "info", texto: "Pacote concluído: conversar sobre continuidade ou alta" });
    }
    const peso = { alto: 100, medio: 40, info: 10 } as const;
    saida.push({
      telefone: tel,
      nome: c?.nome ?? lista.find((a) => a.nome_lead)?.nome_lead ?? null,
      encerrado,
      pacote: { comprado: pacoteComprado, realizadas: realizadasL.length, marcadas, restantes },
      ultimaSessao: ultima ? { iso: ultima.data_hora, local: ultima.local } : null,
      diasDesdeUltima,
      proxima: proxima ? { iso: proxima.data_hora, local: proxima.local } : null,
      aConfirmar,
      dor: { primeira: pontos[0] ?? null, ultima: pontos.length ? pontos[pontos.length - 1] : null, pontos },
      exercicios: {
        ativo: !!planoAtivo,
        enviadoEm: planoAtivo?.enviado_em ?? null,
        ultimoRetorno: ult ? { dias: ult.dias_feitos, dor: ult.dor, em: ult.criado_em } : null,
      },
      alertas,
      prioridade: alertas.reduce((t, a) => t + peso[a.nivel], 0),
    });
  }
  return saida.sort((a, b) => Number(a.encerrado) - Number(b.encerrado) || b.prioridade - a.prioridade || (a.nome ?? "").localeCompare(b.nome ?? ""));
}

export async function definirAlta(telefone: string, alta: boolean): Promise<{ ok: boolean; error?: string }> {
  const r = await getClient()
    .from("ff_contatos")
    .update({ tratamento_encerrado_em: alta ? new Date().toISOString() : null })
    .eq("telefone", telefone)
    .select("telefone");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Paciente não encontrado." };
}
