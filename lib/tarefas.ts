import { getClient } from "@/lib/db";
import { destinatariosAlerta } from "@/lib/config";
import { enviarTextoInstancia } from "@/lib/evolution";
import { enviarDM } from "@/lib/instagram";
import { perguntarJSON } from "@/lib/llm";
import { variantesTelefone } from "@/lib/telefone";
import { GOOGLE_AVALIACOES_URL, SITE_URL } from "@/lib/site";

// TAREFAS DE RELACIONAMENTO: acompanhamento de quem está negociando e de quem já se tratou.
// Fluxo: o sistema SUGERE (a partir da conversa e do playbook) → Anderson APROVA no painel →
// no horário marcado o envio sai sozinho, depois de conferir de novo se ainda faz sentido.
// Nada é enviado sem aprovação.

import { TIPOS, type CanalTarefa, type Checagem, type StatusTarefa, type Tarefa, type TipoTarefa } from "@/lib/tarefas-tipos";
export { TIPOS };
export type { CanalTarefa, Checagem, StatusTarefa, Tarefa, TipoTarefa };

const primeiroNome = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] ?? "";

export function linkAvaliacao(): string {
  return (process.env.GOOGLE_REVIEW_LINK ?? "").trim() || GOOGLE_AVALIACOES_URL;
}

/** Texto padrão de cada tipo (o Anderson pode editar antes de aprovar). Sem promessa de resultado, sem recompensa, sem dado de saúde. */
export function mensagemPadrao(tipo: TipoTarefa, nome: string | null | undefined, motivo?: string | null): string {
  const n = primeiroNome(nome);
  const oi = n ? `Oi, ${n}!` : "Oi!";
  switch (tipo) {
    case "retorno_prometido":
      return `${oi} Tudo bem? Combinamos de conversar hoje${motivo ? ` sobre ${motivo}` : ""}. Como ficou para você? Se quiser, já vejo um horário com o Anderson 🙂`;
    case "negociacao":
      return `${oi} Tudo bem? Passando para saber se ficou alguma dúvida sobre a sessão. Cada sessão tem 60 minutos com o próprio Anderson e reúne a avaliação e as técnicas na mesma hora. Se quiser, vejo um horário para você 🙂`;
    case "pos_sessao":
      return `${oi} Passando para saber como você está depois da sessão de ontem. Se ficou alguma dúvida, é só falar por aqui 🙂`;
    case "reavaliacao":
      return `${oi} Tudo bem? O Anderson gostaria de acompanhar a sua evolução. Se quiser, posso ver um horário para uma nova sessão, em que ele reavalia o seu quadro e conversa sobre a continuidade.`;
    case "avaliacao_google":
      return `${oi} Foi um prazer cuidar de você. Se quiser contar como foi a sua experiência, uma avaliação no Google ajuda outras pessoas a nos encontrarem: ${linkAvaliacao()}\nSem compromisso, e obrigado pela confiança! 🙏`;
    case "indicacao":
      return `${oi} Muito obrigado pela confiança no trabalho do Anderson. Se você conhece alguém que esteja precisando de cuidado com fisioterapia, pode passar o contato dele. Ficamos muito agradecidos 🙂`;
    case "reativacao":
      return `${oi} Tudo bem? Faz um tempo que não nos falamos e o Anderson gostaria de saber como você está. Se quiser, posso ver um horário para uma reavaliação.`;
    default:
      return "";
  }
}

// ── horário de São Paulo (UTC-3 fixo) ───────────────────────────────────────
const spDe = (d: Date) => new Date(d.getTime() - 3 * 3600 * 1000);
export const diaSP = (d: Date) => spDe(d).toISOString().slice(0, 10);
/** Instante UTC de "AAAA-MM-DD HH:MM" no horário de SP. */
export function spParaUTC(dia: string, hora = "09:00"): Date {
  return new Date(`${dia}T${hora}:00-03:00`);
}
export const fimDoDiaSP = (d: Date) => spParaUTC(diaSP(d), "23:59");

// ── criar / listar / atualizar ──────────────────────────────────────────────
export interface NovaTarefa {
  chave?: string | null;
  telefone?: string | null;
  ig_id?: string | null;
  nome?: string | null;
  tipo: TipoTarefa;
  origem: "manual" | "conversa" | "playbook";
  titulo?: string;
  motivo?: string | null;
  canal?: CanalTarefa;
  mensagem?: string | null;
  devida_em: Date;
  status?: StatusTarefa;
  /** Escreve a mensagem a partir da conversa (só quando `mensagem` não vier pronta). */
  personalizar?: boolean;
}

/** Escreve a mensagem da tarefa a partir da conversa real (continuação da negociação, sem promessa e sem pressão). Null se não der. */
export async function mensagemPersonalizada(
  telefone: string,
  nome: string | null | undefined,
  tipo: TipoTarefa,
  motivo?: string | null,
): Promise<string | null> {
  const h = await getClient()
    .from("n8n_chat_histories")
    .select("type:message->>type, content:message->>content")
    .in("session_id", variantesTelefone(telefone))
    .order("id", { ascending: false })
    .limit(14);
  const msgs = ((h.data ?? []) as { type: string | null; content: string | null }[]).reverse();
  if (!msgs.some((m) => m.type === "human")) return null;
  const conversa = msgs
    .map((m) => `${m.type === "human" ? "PACIENTE" : "CLÍNICA"}: ${(m.content ?? "").replace(/^CANAL:\s*\w+\s*/i, "").slice(0, 300)}`)
    .join("\n");
  const r = await perguntarJSON<{ mensagem?: string }>(
    "Você escreve UMA mensagem de WhatsApp, em português do Brasil, para uma clínica de fisioterapia (Anderson Andrade) retomar o contato com uma pessoa que conversou e não fechou. " +
      "Regras: tom acolhedor, humano e respeitoso; no máximo 3 frases curtas (até 350 caracteres); use o primeiro nome só se for conhecido; retome o ponto em que a conversa parou; termine com UMA pergunta fácil de responder. " +
      "Se a pessoa disse que o valor está alto: reconheça sem repetir o valor, pergunte com gentileza qual valor ela tinha em mente ou o que pesa, e lembre em uma frase o que a sessão inclui (60 min individuais com o próprio Anderson, avaliação e técnicas manuais na mesma sessão). " +
      "PROIBIDO: prometer resultado ou melhora, falar em número de sessões, redução de remédio ou economia, oferecer desconto ou condição especial, dar orientação clínica, pressionar, dizer que é robô, citar avaliações de pacientes. " +
      'Responda só JSON: {"mensagem": "texto"}.',
    `Tipo de tarefa: ${TIPOS[tipo].label}. Motivo: ${motivo ?? "—"}. Nome conhecido: ${primeiroNome(nome) || "não"}.\n\nCONVERSA RECENTE:\n${conversa}`,
    350,
  );
  const m = (r?.mensagem ?? "").trim();
  return m.length >= 20 && m.length <= 700 ? m : null;
}

export async function criarTarefa(t: NovaTarefa): Promise<number | null> {
  const sb = getClient();
  const canal: CanalTarefa = t.canal ?? (t.telefone ? "whatsapp" : t.ig_id ? "instagram" : "ligacao");
  const nomeTxt = primeiroNome(t.nome);
  if (t.chave) {
    // Já existe? Não gasta uma chamada ao modelo à toa.
    const ja = await sb.from("tarefas").select("id").eq("chave", t.chave).limit(1);
    if (ja.data?.length) return null;
  }
  let texto = t.mensagem ?? null;
  if (!texto && t.personalizar && t.telefone) {
    texto = await mensagemPersonalizada(t.telefone, t.nome, t.tipo, t.motivo).catch(() => null);
  }
  const linha = {
    chave: t.chave ?? null,
    telefone: t.telefone ?? null,
    ig_id: t.ig_id ?? null,
    nome: t.nome ?? null,
    tipo: t.tipo,
    origem: t.origem,
    titulo: t.titulo?.trim() || `${TIPOS[t.tipo].label}${nomeTxt ? `: ${nomeTxt}` : ""}`,
    motivo: t.motivo ?? null,
    canal,
    mensagem: texto ?? mensagemPadrao(t.tipo, t.nome, t.motivo),
    devida_em: t.devida_em.toISOString(),
    status: t.status ?? "sugerida",
  };
  const q = t.chave
    ? sb.from("tarefas").upsert(linha, { onConflict: "chave", ignoreDuplicates: true }).select("id")
    : sb.from("tarefas").insert(linha).select("id");
  const r = await q;
  if (r.error) {
    console.error("[tarefas] criar:", r.error.message);
    return null;
  }
  return (r.data?.[0] as { id: number } | undefined)?.id ?? null;
}

export async function listarTarefas(): Promise<Tarefa[]> {
  const sb = getClient();
  const sete = new Date(Date.now() - 7 * 86400000).toISOString();
  const [abertas, fechadas] = await Promise.all([
    sb.from("tarefas").select("*").in("status", ["sugerida", "aprovada"]).order("devida_em", { ascending: true }).limit(300),
    sb.from("tarefas").select("*").in("status", ["executada", "descartada"]).gte("criado_em", sete).order("devida_em", { ascending: false }).limit(60),
  ]);
  return [...((abertas.data ?? []) as Tarefa[]), ...((fechadas.data ?? []) as Tarefa[])];
}

export async function tarefaPorId(id: number): Promise<Tarefa | null> {
  const r = await getClient().from("tarefas").select("*").eq("id", id).limit(1);
  return ((r.data ?? [])[0] ?? null) as Tarefa | null;
}

// ── checagem de contexto ────────────────────────────────────────────────────
const PEDIU_PARA_PARAR = /\b(parar|pare|n[aã]o quero (mais )?(receber|mensagem|contato)|sair da lista|descadastr|me tire|n[aã]o me (chame|mande))\b/i;

export async function checarContexto(t: Tarefa): Promise<Checagem> {
  const sb = getClient();
  const desde = t.criado_em;
  const tipoNegocio = t.tipo === "negociacao" || t.tipo === "retorno_prometido" || t.tipo === "reativacao";
  const dela: { texto: string; quando: string }[] = [];
  const nossas: { texto: string; quando: string }[] = [];

  if (t.telefone) {
    const h = await sb
      .from("n8n_chat_histories")
      .select("created_at, type:message->>type, content:message->>content")
      .in("session_id", variantesTelefone(t.telefone))
      .gt("created_at", desde)
      .order("id", { ascending: true })
      .limit(40);
    for (const m of (h.data ?? []) as { created_at: string; type: string | null; content: string | null }[]) {
      const texto = (m.content ?? "").replace(/^CANAL:\s*\w+\s*/i, "").slice(0, 400);
      (m.type === "human" ? dela : nossas).push({ texto, quando: m.created_at });
    }
  }
  if (t.ig_id) {
    const h = await sb.from("ig_mensagens").select("papel, texto, criado_em").eq("ig_id", t.ig_id).gt("criado_em", desde).order("id", { ascending: true }).limit(40);
    for (const m of (h.data ?? []) as { papel: string; texto: string; criado_em: string }[]) {
      (m.papel === "user" ? dela : nossas).push({ texto: m.texto.slice(0, 400), quando: m.criado_em });
    }
  }

  // 1) pediu para não receber contato → nunca faz sentido
  if (dela.some((m) => PEDIU_PARA_PARAR.test(m.texto))) {
    return { faz_sentido: false, resumo: "A pessoa pediu para não receber mais contato. Não envie.", novas_mensagens: dela.length, em: new Date().toISOString() };
  }

  // 2) já agendou depois que a tarefa foi criada → negociação/retorno/reativação perderam o sentido
  if (t.telefone && tipoNegocio) {
    const a = await sb
      .from("agendamentos")
      .select("data_hora, status")
      .in("telefone_lead", variantesTelefone(t.telefone))
      .neq("status", "cancelado")
      .gt("criado_em", desde)
      .order("data_hora", { ascending: true })
      .limit(1);
    const ag = (a.data ?? [])[0] as { data_hora: string; status: string } | undefined;
    if (ag) {
      return {
        faz_sentido: false,
        resumo: `Já marcou sessão para ${new Date(ag.data_hora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}. A negociação já se resolveu.`,
        novas_mensagens: dela.length,
        em: new Date().toISOString(),
      };
    }
  }

  // 3) sem conversa nova: segue como planejado
  if (!dela.length && !nossas.length) {
    return { faz_sentido: true, resumo: "Sem conversas novas desde que a tarefa foi criada. Pode seguir como planejado.", novas_mensagens: 0, em: new Date().toISOString() };
  }

  // 4) houve conversa: o modelo avalia se a tarefa ainda cabe
  const trecho = [...dela.map((m) => ({ ...m, quem: "PACIENTE" })), ...nossas.map((m) => ({ ...m, quem: "CLÍNICA" }))]
    .sort((a, b) => a.quando.localeCompare(b.quando))
    .map((m) => `${m.quem}: ${m.texto}`)
    .join("\n")
    .slice(0, 3000);
  const r = await perguntarJSON<{ faz_sentido?: boolean; resumo?: string }>(
    "Você revisa tarefas de acompanhamento de uma clínica de fisioterapia. Diga se a tarefa AINDA FAZ SENTIDO depois da conversa que aconteceu desde que ela foi criada. " +
      "Não faz sentido se o assunto já foi resolvido, se a pessoa já respondeu ao que a tarefa buscava, se já agendou, se desistiu, ou se pediu para não ser contatada. " +
      'Responda só JSON: {"faz_sentido": true|false, "resumo": "1 ou 2 frases em português dizendo o que aconteceu e por que a tarefa deve (ou não) seguir"}.',
    `TAREFA: ${t.titulo} (${TIPOS[t.tipo].label}). Motivo: ${t.motivo ?? "—"}.\nMensagem planejada: ${t.mensagem ?? "—"}\n\nCONVERSA DESDE A CRIAÇÃO:\n${trecho}`,
  );
  if (r && typeof r.faz_sentido === "boolean") {
    return { faz_sentido: r.faz_sentido, resumo: (r.resumo ?? "").slice(0, 400) || "Conferido pela IA.", novas_mensagens: dela.length, em: new Date().toISOString() };
  }
  return {
    faz_sentido: true,
    resumo: `Houve ${dela.length + nossas.length} mensagem(ns) desde a criação e não consegui avaliar sozinho. Leia a conversa antes de aprovar.`,
    novas_mensagens: dela.length,
    em: new Date().toISOString(),
  };
}

export async function salvarChecagem(id: number, c: Checagem) {
  await getClient().from("tarefas").update({ checagem: c, checada_em: c.em }).eq("id", id);
}

// ── execução ────────────────────────────────────────────────────────────────
export async function executarTarefa(t: Tarefa): Promise<{ ok: boolean; erro?: string }> {
  const msg = (t.mensagem ?? "").trim();
  if (!msg) return { ok: false, erro: "Sem mensagem." };
  const sb = getClient();
  if (t.canal === "whatsapp" && t.telefone) {
    const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
    const r = await enviarTextoInstancia(instancia, t.telefone, msg);
    if (!r.ok) return { ok: false, erro: r.error ?? "Falha no envio." };
    await sb.from("n8n_chat_histories").insert({
      session_id: t.telefone,
      message: { type: "ai", content: msg, tool_calls: [], additional_kwargs: { via: "tarefa" }, response_metadata: {}, invalid_tool_calls: [] },
    });
    return { ok: true };
  }
  if (t.canal === "instagram" && t.ig_id) {
    const r = await enviarDM(t.ig_id, msg);
    if (!r.ok) return { ok: false, erro: r.erro ?? "Falha no envio." };
    await sb.from("ig_mensagens").insert({ ig_id: t.ig_id, papel: "assistant", texto: msg, mid: r.id ?? null, tipo: "tarefa" });
    return { ok: true };
  }
  return { ok: false, erro: "Esta tarefa é manual (ligação/presencial)." };
}

export async function marcar(id: number, patch: Partial<Pick<Tarefa, "status" | "aprovada_em" | "executada_em" | "resultado" | "mensagem" | "devida_em" | "titulo" | "auto_envio">>) {
  return getClient().from("tarefas").update(patch).eq("id", id);
}

/** Envia as tarefas aprovadas que já venceram, dentro do expediente, conferindo o contexto antes. */
export async function executarVencidas(maxEnvios = 5): Promise<{ enviadas: number; devolvidas: number; falhas: number }> {
  const sb = getClient();
  const r = await sb
    .from("tarefas")
    .select("*")
    .eq("status", "aprovada")
    .eq("auto_envio", true)
    .in("canal", ["whatsapp", "instagram"])
    .lte("devida_em", new Date().toISOString())
    .order("devida_em", { ascending: true })
    .limit(maxEnvios);
  let enviadas = 0;
  let devolvidas = 0;
  let falhas = 0;
  for (const t of (r.data ?? []) as Tarefa[]) {
    // Confere de novo: o paciente pode ter respondido entre a aprovação e agora.
    const ch = await checarContexto({ ...t, criado_em: t.aprovada_em ?? t.criado_em });
    await salvarChecagem(t.id, ch);
    if (!ch.faz_sentido) {
      await marcar(t.id, { status: "sugerida", aprovada_em: null, resultado: `Devolvida para revisão: ${ch.resumo}` });
      devolvidas++;
      continue;
    }
    const e = await executarTarefa(t);
    if (e.ok) {
      await marcar(t.id, { status: "executada", executada_em: new Date().toISOString(), resultado: "Enviada automaticamente." });
      enviadas++;
      await new Promise((res) => setTimeout(res, 15000 + Math.random() * 15000)); // intervalo humano entre envios
    } else {
      await marcar(t.id, { resultado: `Falha no envio: ${(e.erro ?? "").slice(0, 160)}` });
      falhas++;
    }
  }
  return { enviadas, devolvidas, falhas };
}

// ── sugestões automáticas ───────────────────────────────────────────────────
const ETAPAS_NEGOCIANDO = ["qualificando", "materiais_enviados", "roteado", "politica_enviada", "transferido"];

export async function gerarSugestoes(): Promise<{ posSessao: number; negociacao: number; retornos: number }> {
  const sb = getClient();
  const agora = new Date();
  const hoje = diaSP(agora);
  const out = { posSessao: 0, negociacao: 0, retornos: 0 };

  // (a) depois da sessão: D+1 cuidado, D+7 reavaliação, D+14 avaliação no Google, D+30 indicação
  const quarenta = new Date(agora.getTime() - 40 * 86400000).toISOString();
  const ags = await sb
    .from("agendamentos")
    .select("id, telefone_lead, nome_lead, data_hora")
    .eq("status", "compareceu")
    .gte("data_hora", quarenta)
    .lte("data_hora", agora.toISOString())
    .limit(200);
  const OFFS: { dias: number; tipo: TipoTarefa }[] = [
    { dias: 1, tipo: "pos_sessao" },
    { dias: 7, tipo: "reavaliacao" },
    { dias: 14, tipo: "avaliacao_google" },
    { dias: 30, tipo: "indicacao" },
  ];
  for (const a of (ags.data ?? []) as { id: string; telefone_lead: string; nome_lead: string | null; data_hora: string }[]) {
    const dSessao = diaSP(new Date(a.data_hora));
    const passados = Math.floor((spParaUTC(hoje, "12:00").getTime() - spParaUTC(dSessao, "12:00").getTime()) / 86400000);
    for (const o of OFFS) {
      if (passados < o.dias || passados - o.dias > 2) continue; // só os que vencem agora (sem acumular atraso antigo)
      const id = await criarTarefa({
        chave: `pos:${a.id}:${o.dias}`,
        telefone: a.telefone_lead,
        nome: a.nome_lead,
        tipo: o.tipo,
        origem: "playbook",
        motivo: `Sessão de ${dSessao.split("-").reverse().join("/")}`,
        devida_em: spParaUTC(hoje, o.tipo === "pos_sessao" ? "09:00" : "10:00"),
      });
      if (id) out.posSessao++;
    }
  }

  // (b) negociação: quem conversou e sumiu (2, 5 e 10 dias), sem sessão marcada
  const doze = new Date(agora.getTime() - 12 * 86400000).toISOString();
  const doisDias = new Date(agora.getTime() - 2 * 86400000).toISOString();
  const cs = await sb
    .from("ff_contatos")
    .select("telefone, nome, ultima_interacao")
    .eq("fechado", false)
    .is("resultado", null)
    .in("funnel_stage", ETAPAS_NEGOCIANDO)
    .gte("ultima_interacao", doze)
    .lte("ultima_interacao", doisDias)
    .limit(120);
  for (const c of (cs.data ?? []) as { telefone: string; nome: string | null; ultima_interacao: string }[]) {
    const a = await sb.from("agendamentos").select("id").in("telefone_lead", variantesTelefone(c.telefone)).neq("status", "cancelado").limit(1);
    if (a.data?.length) continue; // já tem sessão
    const aberta = await sb.from("tarefas").select("id").eq("telefone", c.telefone).eq("tipo", "negociacao").in("status", ["sugerida", "aprovada"]).limit(1);
    if (aberta.data?.length) continue;
    const dias = Math.floor((agora.getTime() - new Date(c.ultima_interacao).getTime()) / 86400000);
    const marco = [10, 5, 2].find((m) => dias >= m);
    if (!marco) continue;
    const id = await criarTarefa({
      chave: `neg:${c.telefone}:${marco}:${diaSP(new Date(c.ultima_interacao))}`,
      telefone: c.telefone,
      nome: c.nome,
      tipo: "negociacao",
      origem: "playbook",
      motivo: `Sem resposta há ${dias} dias`,
      mensagem: marco === 10 ? `${c.nome ? `Oi, ${primeiroNome(c.nome)}!` : "Oi!"} Não quero te incomodar: se ainda fizer sentido cuidar disso, é só me chamar por aqui que eu vejo um horário com o Anderson. Fico à disposição 🙂` : undefined,
      devida_em: spParaUTC(hoje, "10:30"),
      personalizar: marco !== 10,
    });
    if (id) out.negociacao++;
  }

  // (c) compromissos de retorno ditos na conversa ("te dou um retorno amanhã")
  const trintaH = new Date(agora.getTime() - 30 * 3600 * 1000).toISOString();
  const ativos = await sb
    .from("ff_contatos")
    .select("telefone, nome")
    .eq("fechado", false)
    .gte("ultima_interacao", trintaH)
    .limit(12);
  for (const c of (ativos.data ?? []) as { telefone: string; nome: string | null }[]) {
    const h = await sb
      .from("n8n_chat_histories")
      .select("type:message->>type, content:message->>content")
      .in("session_id", variantesTelefone(c.telefone))
      .order("id", { ascending: false })
      .limit(12);
    const msgs = ((h.data ?? []) as { type: string | null; content: string | null }[]).reverse();
    if (!msgs.some((m) => m.type === "human")) continue;
    const texto = msgs.map((m) => `${m.type === "human" ? "PACIENTE" : "CLÍNICA"}: ${(m.content ?? "").replace(/^CANAL:\s*\w+\s*/i, "").slice(0, 300)}`).join("\n");
    const r = await perguntarJSON<{ tem_compromisso?: boolean; data?: string | null; motivo?: string }>(
      `Hoje é ${hoje} (horário de Brasília). Leia a conversa de WhatsApp de uma clínica de fisioterapia e diga se o PACIENTE prometeu dar um retorno em uma data ou prazo ("amanhã", "daqui a 3 dias", "na sexta", "dia 25", "semana que vem", "depois do pagamento") ou pediu para falarem depois. ` +
        'Responda só JSON: {"tem_compromisso": true|false, "data": "AAAA-MM-DD" (a data calculada a partir de hoje) ou null, "motivo": "frase curta do que ele ficou de decidir"}. Se não houver compromisso claro, tem_compromisso=false.',
      texto,
      200,
    );
    if (!r?.tem_compromisso || !r.data || !/^\d{4}-\d{2}-\d{2}$/.test(r.data) || r.data < hoje) continue;
    const id = await criarTarefa({
      chave: `ret:${c.telefone}:${r.data}`,
      telefone: c.telefone,
      nome: c.nome,
      tipo: "retorno_prometido",
      origem: "conversa",
      motivo: (r.motivo ?? "").slice(0, 160) || null,
      devida_em: spParaUTC(r.data, "09:30"),
      personalizar: true,
    });
    if (id) out.retornos++;
  }
  return out;
}

// ── resumo do dia (WhatsApp para o Anderson) ────────────────────────────────
export async function montarResumoDoDia(): Promise<{ texto: string; total: number }> {
  const sb = getClient();
  const agora = new Date();
  const r = await sb
    .from("tarefas")
    .select("*")
    .in("status", ["sugerida", "aprovada"])
    .lte("devida_em", fimDoDiaSP(agora).toISOString())
    .order("devida_em", { ascending: true })
    .limit(40);
  const lista = (r.data ?? []) as Tarefa[];
  for (const t of lista) {
    const c = await checarContexto(t);
    t.checagem = c;
    await salvarChecagem(t.id, c);
  }
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const aprovar = lista.filter((t) => t.status === "sugerida");
  const aprovadas = lista.filter((t) => t.status === "aprovada");
  const linhas: string[] = [];
  linhas.push(`☀️ Bom dia, Anderson! Plano de hoje (${agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" })}):`);
  if (!lista.length) {
    linhas.push("Nenhuma tarefa de relacionamento para hoje. 🙂");
  } else {
    if (aprovar.length) {
      linhas.push(`\n*Para você aprovar (${aprovar.length}):*`);
      for (const t of aprovar.slice(0, 12)) {
        const alerta = t.checagem && !t.checagem.faz_sentido ? " ⚠️ rever" : "";
        linhas.push(`• ${hora(t.devida_em)} ${TIPOS[t.tipo].emoji} ${t.nome ?? "Paciente"} — ${TIPOS[t.tipo].label}${alerta}`);
        if (alerta) linhas.push(`   ↳ ${t.checagem?.resumo}`);
      }
    }
    if (aprovadas.length) {
      linhas.push(`\n*Já aprovadas para hoje (${aprovadas.length}):*`);
      for (const t of aprovadas.slice(0, 10)) linhas.push(`• ${hora(t.devida_em)} ${TIPOS[t.tipo].emoji} ${t.nome ?? "Paciente"} — ${TIPOS[t.tipo].label}`);
    }
  }
  linhas.push(`\nAbra, confira e aprove: ${SITE_URL.replace("https://", "https://painel.")}/tarefas`);
  return { texto: linhas.join("\n"), total: lista.length };
}

export async function enviarAoDono(texto: string): Promise<number> {
  const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  if (!instancia) return 0;
  let n = 0;
  for (const d of destinatariosAlerta()) {
    if (!d.whatsapp) continue;
    const r = await enviarTextoInstancia(instancia, d.whatsapp, texto);
    if (r.ok) n++;
  }
  return n;
}

/** Tarefas que aparecem no Google Agenda (as descartadas entram para o evento ser apagado). */
export async function tarefasParaAgenda(): Promise<Tarefa[]> {
  const desde = new Date(Date.now() - 8 * 86400000).toISOString();
  const ate = new Date(Date.now() + 60 * 86400000).toISOString();
  const r = await getClient().from("tarefas").select("*").gte("devida_em", desde).lte("devida_em", ate).order("devida_em", { ascending: true }).limit(300);
  return (r.data ?? []) as Tarefa[];
}
