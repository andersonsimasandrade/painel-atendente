import { getClient } from "@/lib/db";
import { criarAgendamento, getOcupados, getVendedorBySlug, listarVendedores, resolverLead } from "@/lib/agenda";
import { destinatariosAlerta } from "@/lib/config";
import { enviarTextoInstancia } from "@/lib/evolution";
import { textoConfirmacao } from "@/lib/confirmacao";
import { CONSULTORIOS } from "@/lib/site";
import { formatarBR, gerarSlotsDias } from "@/lib/slots";
import { variantesTelefone } from "@/lib/telefone";
import type { SlotDia } from "@/lib/types";

// Núcleo usado pelo ROBÔ (n8n) para consultar horários e marcar consultas de verdade.
// Rotas: /api/cron/robo/horarios e /api/cron/robo/marcar (Bearer CRON_SECRET).

async function consultorPadrao() {
  const slug = (await listarVendedores())[0]?.slug ?? "";
  return slug ? getVendedorBySlug(slug) : null;
}

export async function horariosLivres(dias = 8): Promise<{ ok: boolean; dias: SlotDia[]; texto: string; erro?: string }> {
  const vend = await consultorPadrao();
  if (!vend) return { ok: false, dias: [], texto: "", erro: "Nenhum consultor ativo." };
  const ocupados = await getOcupados(vend.id);
  const lista = gerarSlotsDias(vend.disponibilidade, ocupados, { horizonteDias: Math.min(21, Math.max(1, dias)) });
  // Horário "colado" = logo antes ou logo depois de uma consulta já marcada (otimiza a logística do Anderson): marcado com ★.
  const HORA = 3600 * 1000;
  const colado = (iso: string) => {
    const t = new Date(iso).getTime();
    return ocupados.has(new Date(t - HORA).toISOString()) || ocupados.has(new Date(t + HORA).toISOString());
  };
  const SEMANA: Record<string, string> = { DOM: "domingo", SEG: "segunda", TER: "terça", QUA: "quarta", QUI: "quinta", SEX: "sexta", "SÁB": "sábado" };
  const texto = lista
    .map((d) => `${SEMANA[d.diaSemana] ?? d.diaSemana} ${d.diaMes} (${d.dataIso}): ${d.slots.map((s) => (colado(s.iso) ? `${s.hora}★` : s.hora)).join(", ")}`)
    .join("\n");
  return { ok: true, dias: lista, texto };
}

export interface PedidoMarcacao {
  telefone: string;
  nome: string | null;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  local: "capoeiras" | "centro";
}

export type ResultadoMarcacao =
  | { ok: true; id: string; quando: string; local: string; confirmacaoEnviada: boolean }
  | { ok: false; erro: string; conflito?: boolean; alternativas?: string[] };

export async function marcarPeloRobo(p: PedidoMarcacao): Promise<ResultadoMarcacao> {
  const vend = await consultorPadrao();
  if (!vend) return { ok: false, erro: "Nenhum consultor ativo." };
  const tel = p.telefone.replace(/\D/g, "");
  if (tel.length < 10 || tel.length > 15) return { ok: false, erro: "Telefone inválido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data) || !/^\d{2}:\d{2}$/.test(p.hora)) return { ok: false, erro: "Data ou hora inválida." };
  if (p.local !== "capoeiras" && p.local !== "centro") return { ok: false, erro: "Consultório inválido." };

  const iso = new Date(`${p.data}T${p.hora}:00-03:00`).toISOString();
  const livres = gerarSlotsDias(vend.disponibilidade, await getOcupados(vend.id), { horizonteDias: 30 });
  const sugestoes = livres.flatMap((d) => d.slots.map((s) => `${d.diaSemana} ${d.diaMes} ${s.hora}`)).slice(0, 4);
  if (!livres.some((d) => d.slots.some((s) => s.iso === iso))) {
    return { ok: false, conflito: true, erro: "Esse horário não está livre (ou fora do atendimento).", alternativas: sugestoes };
  }

  const telefone = (await resolverLead(tel)) ?? tel;
  const criado = await criarAgendamento({ vendedorId: vend.id, telefone, nome: p.nome, dataHora: iso, origem: "robo", local: p.local });
  if (!criado.ok) return { ok: false, conflito: !!criado.conflito, erro: criado.conflito ? "Esse horário acabou de ser ocupado." : "Não consegui gravar.", alternativas: sugestoes };

  const sb = getClient();
  try {
    if (!(await resolverLead(telefone))) {
      await sb.from("ff_contatos").insert({ telefone, nome: p.nome, ultima_instancia: vend.instancia_whatsapp });
    }
    await sb.from("ff_contatos").update({ funnel_stage: "agendado", funnel_rank: 4 }).eq("telefone", telefone).lt("funnel_rank", 4);
    if (p.nome) await sb.from("ff_contatos").update({ nome: p.nome }).eq("telefone", telefone).is("nome", null);
  } catch (e) {
    console.error("[marcar] cadastro/funil:", e);
  }

  // Confirmação completa pelo WhatsApp (primeira vez = com apresentação).
  const variantes = variantesTelefone(telefone);
  const [anteriores, cad] = await Promise.all([
    sb.from("agendamentos").select("id", { count: "exact", head: true }).in("telefone_lead", variantes).neq("status", "cancelado").neq("id", criado.id),
    sb.from("ff_contatos").select("total_mensagens").in("telefone", variantes).limit(1),
  ]);
  const msgs = Number((cad.data?.[0] as { total_mensagens: number | null } | undefined)?.total_mensagens ?? 0);
  // O paciente acabou de conversar com o robô, então "primeira vez" aqui = nenhuma consulta anterior.
  const texto = textoConfirmacao({ nome: p.nome, iso, local: p.local, primeiraVez: (anteriores.count ?? 0) === 0 && msgs <= 1 });
  const env = await enviarTextoInstancia(vend.instancia_whatsapp, telefone, texto);
  if (!env.ok) console.error("[marcar] confirmação falhou:", env.error);

  const quando = formatarBR(iso);
  const cons = CONSULTORIOS[p.local];
  await sb
    .from("n8n_chat_histories")
    .insert({
      session_id: telefone,
      message: { type: "ai", content: env.ok ? texto : `📅 Consulta agendada: ${quando} (${cons.bairro}).`, tool_calls: [], additional_kwargs: { via: "robo-agenda" }, response_metadata: {}, invalid_tool_calls: [] },
    })
    .then(undefined, () => undefined);

  // Aviso ao Anderson (ele continua responsável por tudo).
  const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  if (instancia) {
    for (const d of destinatariosAlerta()) {
      if (d.whatsapp) await enviarTextoInstancia(instancia, d.whatsapp, `📅 O robô marcou uma consulta: ${p.nome ?? telefone} · ${quando} · ${cons.bairro}. Já enviei a confirmação ao paciente.`).catch(() => undefined);
    }
  }
  return { ok: true, id: criado.id, quando, local: cons.bairro, confirmacaoEnviada: env.ok };
}
