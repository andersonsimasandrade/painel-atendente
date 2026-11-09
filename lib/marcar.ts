import { getClient } from "@/lib/db";
import { criarAgendamento, getCompromissos, getOcupados, getVendedorBySlug, listarVendedores, resolverLead } from "@/lib/agenda";
import { GAP_TROCA_MIN, NOME_LOCAL, conflitoDeslocamento, locaisDoDia, outroLocal, type LocalId } from "@/lib/deslocamento";
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
  const [ocupados, compromissos] = await Promise.all([getOcupados(vend.id), getCompromissos(vend.id)]);
  const lista = gerarSlotsDias(vend.disponibilidade, ocupados, { horizonteDias: Math.min(21, Math.max(1, dias)) });
  // Horário "colado" = logo antes ou logo depois de uma consulta já marcada (otimiza a logística do Anderson): marcado com ★.
  const HORA = 3600 * 1000;
  const colado = (iso: string) => {
    const t = new Date(iso).getTime();
    return ocupados.has(new Date(t - HORA).toISOString()) || ocupados.has(new Date(t + HORA).toISOString());
  };
  const SEMANA: Record<string, string> = { DOM: "domingo", SEG: "segunda", TER: "terça", QUA: "quarta", QUI: "quinta", SEX: "sexta", "SÁB": "sábado" };
  const nl = (l: LocalId) => NOME_LOCAL[l];

  const linhas: string[] = [];
  for (const d of lista) {
    const locaisDia = locaisDoDia(d.dataIso, compromissos);
    const so = locaisDia.size === 1 ? [...locaisDia][0] : null; // dia já "de" um consultório
    const horas: string[] = [];
    for (const s of d.slots) {
      const t = new Date(s.iso).getTime();
      const cap = !conflitoDeslocamento(t, "capoeiras", compromissos);
      const cen = !conflitoDeslocamento(t, "centro", compromissos);
      if (!cap && !cen) continue; // não sobra tempo de deslocamento em nenhum consultório
      const estrela = colado(s.iso) ? "★" : "";
      let rotulo = "";
      if (cap && cen) rotulo = so ? ` (${nl(so)}; ${nl(outroLocal(so))} só com deslocamento)` : "";
      else rotulo = ` (só ${nl(cap ? "capoeiras" : "centro")})`;
      horas.push(`${s.hora}${estrela}${rotulo}`);
    }
    if (!horas.length) continue;
    const dia = so ? ` [dia de ${nl(so)}]` : locaisDia.size > 1 ? " [dia nos dois consultórios]" : "";
    linhas.push(`${SEMANA[d.diaSemana] ?? d.diaSemana} ${d.diaMes} (${d.dataIso})${dia}: ${horas.join(", ")}`);
  }
  const regra =
    `REGRA DE DESLOCAMENTO: entre Capoeiras e Centro são necessários ${GAP_TROCA_MIN} minutos livres. ` +
    "Quando o horário tiver '(só X)', ele vale apenas naquele consultório. " +
    "Prefira oferecer o consultório que o paciente pediu em dias que já são desse consultório ([dia de ...]); só ofereça o outro consultório quando o paciente não puder nos demais dias. " +
    "Ao marcar, use sempre o consultório indicado para aquele horário.";
  return { ok: true, dias: lista, texto: linhas.length ? [regra, ...linhas].join("\n") : "" };
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

  // Deslocamento: entre consultórios diferentes são necessários ~90 min (o horário continua livre, mas não no consultório pedido).
  const compromissos = await getCompromissos(vend.id);
  if (conflitoDeslocamento(new Date(iso).getTime(), p.local, compromissos)) {
    const outro = outroLocal(p.local);
    const noOutro = !conflitoDeslocamento(new Date(iso).getTime(), outro, compromissos);
    const nomeLocal = NOME_LOCAL[p.local];
    return {
      ok: false,
      conflito: true,
      erro: `Nesse horário não dá tempo de deslocamento para ${nomeLocal} (há sessão em outro consultório perto desse horário).${noOutro ? ` Ele vale apenas em ${NOME_LOCAL[outro]}.` : ""} Ofereça outro horário.`,
      alternativas: sugestoes,
    };
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
  const [anteriores] = await Promise.all([
    sb.from("agendamentos").select("id", { count: "exact", head: true }).in("telefone_lead", variantes).neq("status", "cancelado").neq("id", criado.id),
  ]);
  // O paciente acabou de conversar com o robô, então "primeira vez" aqui = nenhuma consulta anterior (as mensagens da conversa não contam).
  const texto = textoConfirmacao({ nome: p.nome, iso, local: p.local, primeiraVez: (anteriores.count ?? 0) === 0 });
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
      if (d.whatsapp) await enviarTextoInstancia(instancia, d.whatsapp, `📅 O robô marcou uma consulta: ${p.nome ?? telefone} · ${quando} · ${cons.bairro}. Já enviei a confirmação ao paciente.${p.local === "centro" ? " ⚠ Lembre de reservar a sala no Centro." : ""}`).catch(() => undefined);
    }
  }
  return { ok: true, id: criado.id, quando, local: cons.bairro, confirmacaoEnviada: env.ok };
}
