import { getClient } from "@/lib/db";
import { destinatariosAlerta } from "@/lib/config";
import { enviarTextoInstancia } from "@/lib/evolution";
import { CREFITO } from "@/lib/site";
import { soDigitos, telefoneCanonico, variantesTelefone } from "@/lib/telefone";

// Indicações de parceiros (Estética Arlete, Espaço Beira-Mar, outros espaços e profissionais).
//
// Duas entradas:
//   • LINK do parceiro (/p/<codigo>): a pessoa abre o WhatsApp já com "fui indicado(a) por…"; quem chama é o paciente.
//   • FORMULÁRIO (/indicar/<codigo>): o parceiro informa nome e telefone do paciente (com a caixa "a pessoa autorizou").
//     A indicação espera algumas horas (para o paciente ter tempo de procurar por conta própria) e depois fica "pronta":
//     o Anderson envia a primeira mensagem com UM clique. Nada sai sozinho.
//
// Proteções do número de WhatsApp: só entre 08:00 e 20:00, no máximo LIMITE_ENVIOS_DIA por dia, e se o paciente
// já escreveu por conta própria a indicação vira "respondeu" e nenhuma mensagem é enviada.

export const LIMITE_ENVIOS_DIA = 8;
export const HORAS_ATE_ESFRIAR = 24;

export function latenciaHoras(): number {
  const n = Number((process.env.INDICACAO_LATENCIA_HORAS ?? "").trim());
  return Number.isFinite(n) && n >= 1 && n <= 24 ? n : 6;
}

export type StatusIndicacao = "aguardando" | "pronta" | "contatada" | "respondeu" | "ja_contato" | "descartada";

export interface Parceiro {
  id: number;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export interface Indicacao {
  id: number;
  parceiro_id: number;
  paciente_nome: string;
  paciente_telefone: string;
  quem_indicou: string | null;
  observacao: string | null;
  status: StatusIndicacao;
  liberar_em: string;
  contatada_em: string | null;
  respondeu_em: string | null;
  texto_enviado: string | null;
  criado_em: string;
}

const SP = 3 * 3600 * 1000; // Brasília = UTC-3 fixo

export function dentroDaJanela(agora = new Date()): boolean {
  const h = new Date(agora.getTime() - SP).getUTCHours();
  return h >= 8 && h < 20;
}

/** Empurra um horário que cai fora das 08h–20h para as 08h seguintes. */
export function ajustarParaJanela(d: Date): Date {
  const sp = new Date(d.getTime() - SP);
  const h = sp.getUTCHours();
  if (h >= 8 && h < 20) return d;
  if (h >= 20) sp.setUTCDate(sp.getUTCDate() + 1);
  sp.setUTCHours(8, 0, 0, 0);
  return new Date(sp.getTime() + SP);
}

export function normalizarTelefone(bruto: string): string | null {
  let d = soDigitos(bruto);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

export function mensagemPadrao(pacienteNome: string, parceiroNome: string): string {
  const primeiro = pacienteNome.trim().split(/\s+/)[0] || "";
  return (
    `Olá${primeiro ? ", " + primeiro : ""}! Aqui é o Anderson Andrade, fisioterapeuta (${CREFITO}), em Florianópolis. ` +
    `A equipe de ${parceiroNome} passou o seu contato porque você demonstrou interesse em saber como funciona a fisioterapia com terapia manual. ` +
    `Posso te ajudar com alguma dúvida ou explicar como é a consulta? ` +
    `Se preferir que eu não escreva, é só me avisar que não entro mais em contato. 🙂`
  );
}

export async function listarParceiros(): Promise<Parceiro[]> {
  const r = await getClient().from("parceiros").select("id, codigo, nome, ativo").order("nome");
  return (r.data ?? []) as Parceiro[];
}

export async function parceiroPorCodigo(codigo: string): Promise<Parceiro | null> {
  const r = await getClient().from("parceiros").select("id, codigo, nome, ativo").eq("codigo", codigo).limit(1);
  return ((r.data?.[0] ?? null) as Parceiro | null) ?? null;
}

export function gerarCodigoParceiro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export interface NovaIndicacao {
  parceiroCodigo: string;
  pacienteNome: string;
  pacienteTelefone: string;
  quemIndicou?: string | null;
  observacao?: string | null;
  consentimento: boolean;
}

export async function criarIndicacao(i: NovaIndicacao): Promise<{ ok: boolean; erro?: string; duplicada?: boolean; jaContato?: boolean }> {
  const nome = i.pacienteNome.trim().slice(0, 120);
  if (!nome) return { ok: false, erro: "Informe o nome do paciente." };
  const tel = normalizarTelefone(i.pacienteTelefone);
  if (!tel) return { ok: false, erro: "Informe o WhatsApp do paciente com DDD." };
  if (!i.consentimento) return { ok: false, erro: "Confirme que o paciente autorizou o contato." };
  const parceiro = await parceiroPorCodigo(i.parceiroCodigo);
  if (!parceiro || !parceiro.ativo) return { ok: false, erro: "Parceiro não encontrado." };

  const sb = getClient();
  const variantes = variantesTelefone(tel);
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const rep = await sb.from("indicacoes").select("id").in("paciente_telefone", variantes).gte("criado_em", desde).limit(1);
  if (rep.data?.length) return { ok: true, duplicada: true };

  const quem = (i.quemIndicou ?? "").trim().slice(0, 80) || null;
  const obs = (i.observacao ?? "").trim().slice(0, 300) || null;

  // Cadastro do lead: se o paciente escrever antes de nós, o histórico já terá a origem.
  const ex = await sb.from("ff_contatos").select("telefone, nome, total_mensagens, origem_canal, origem_parceiro").in("telefone", variantes).limit(1);
  const atual = (ex.data?.[0] ?? null) as { telefone: string; nome: string | null; total_mensagens: number | null; origem_canal: string | null; origem_parceiro: string | null } | null;
  const nota = `Indicado por ${parceiro.nome}${quem ? ` (${quem})` : ""}.${obs ? ` ${obs}` : ""}`;
  if (!atual) {
    await sb.from("ff_contatos").insert({
      telefone: tel,
      nome,
      observacoes: nota,
      origem_canal: "indicacao",
      origem_parceiro: parceiro.codigo,
      origem_manual: true,
      origem_em: new Date().toISOString(),
      ultima_instancia: (process.env.EVOLUTION_INSTANCE ?? "").trim() || null,
    });
  } else if (!atual.origem_canal) {
    await sb.from("ff_contatos").update({ origem_canal: "indicacao", origem_parceiro: parceiro.codigo, origem_manual: true, origem_em: new Date().toISOString() }).eq("telefone", atual.telefone);
  }

  // Quem já conversou com a gente não recebe "primeira mensagem".
  const jaContato = (atual?.total_mensagens ?? 0) > 0;
  const agora = new Date();
  const ins = await sb.from("indicacoes").insert({
    parceiro_id: parceiro.id,
    paciente_nome: nome,
    paciente_telefone: tel,
    quem_indicou: quem,
    observacao: obs,
    consentimento: true,
    consentimento_em: agora.toISOString(),
    status: jaContato ? "ja_contato" : "aguardando",
    liberar_em: ajustarParaJanela(new Date(agora.getTime() + latenciaHoras() * 3600 * 1000)).toISOString(),
  });
  if (ins.error) return { ok: false, erro: "Não consegui registrar agora. Tente de novo." };
  return { ok: true, jaContato };
}

async function avisarDono(texto: string) {
  const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  if (!instancia) return;
  for (const d of destinatariosAlerta()) {
    if (d.whatsapp) await enviarTextoInstancia(instancia, d.whatsapp, texto);
  }
}

async function pacienteEscreveu(telefone: string, desde: string): Promise<boolean> {
  const r = await getClient().from("ff_mensagens").select("id").in("telefone", variantesTelefone(telefone)).eq("direcao", "entrada").gte("criada_em", desde).limit(1);
  return !!r.data?.length;
}

/** Relógio (a cada 5 min): reconhece quem escreveu sozinho, libera as indicações e avisa o Anderson (uma vez, dentro das 08h–20h). */
export async function rodarIndicacoes(): Promise<{ liberadas: number; responderam: number }> {
  const sb = getClient();
  const abertas = await sb.from("indicacoes").select("id, paciente_telefone, criado_em, status, liberar_em, pronta_avisada_em").in("status", ["aguardando", "pronta"]);
  const lista = (abertas.data ?? []) as { id: number; paciente_telefone: string; criado_em: string; status: string; liberar_em: string; pronta_avisada_em: string | null }[];
  let responderam = 0;
  let liberadas = 0;
  const agora = new Date();
  const novas: number[] = [];

  for (const i of lista) {
    if (await pacienteEscreveu(i.paciente_telefone, i.criado_em)) {
      await sb.from("indicacoes").update({ status: "respondeu", respondeu_em: agora.toISOString() }).eq("id", i.id);
      responderam++;
      continue;
    }
    if (i.status === "aguardando" && new Date(i.liberar_em) <= agora && dentroDaJanela(agora)) {
      await sb.from("indicacoes").update({ status: "pronta" }).eq("id", i.id);
      liberadas++;
      novas.push(i.id);
    }
  }
  if (novas.length && dentroDaJanela(agora)) {
    await avisarDono(`📋 ${novas.length === 1 ? "1 indicação pronta" : `${novas.length} indicações prontas`} para você contatar. Abra o painel → Indicações e envie com um clique.`).catch(() => undefined);
    await sb.from("indicacoes").update({ pronta_avisada_em: agora.toISOString() }).in("id", novas);
  }
  return { liberadas, responderam };
}

export async function enviarIndicacao(id: number, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const sb = getClient();
  const r = await sb.from("indicacoes").select("id, paciente_telefone, criado_em, status").eq("id", id).limit(1);
  const i = (r.data?.[0] ?? null) as { id: number; paciente_telefone: string; criado_em: string; status: string } | null;
  if (!i) return { ok: false, erro: "Indicação não encontrada." };
  if (i.status !== "aguardando" && i.status !== "pronta") return { ok: false, erro: "Essa indicação já foi tratada." };
  const msg = texto.trim().slice(0, 1200);
  if (!msg) return { ok: false, erro: "A mensagem está vazia." };
  if (!dentroDaJanela()) return { ok: false, erro: "Mensagens só saem entre 8h e 20h. Tente nesse horário." };

  if (await pacienteEscreveu(i.paciente_telefone, i.criado_em)) {
    await sb.from("indicacoes").update({ status: "respondeu", respondeu_em: new Date().toISOString() }).eq("id", id);
    return { ok: false, erro: "O paciente já escreveu por conta própria. Não precisa enviar: responda pela conversa." };
  }
  const hoje = new Date(Date.now() - SP).toISOString().slice(0, 10);
  const feitas = await sb.from("indicacoes").select("id", { count: "exact", head: true }).gte("contatada_em", `${hoje}T03:00:00Z`);
  if ((feitas.count ?? 0) >= LIMITE_ENVIOS_DIA) return { ok: false, erro: `Limite de ${LIMITE_ENVIOS_DIA} primeiras mensagens por dia (proteção do número). Envie amanhã.` };

  const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  if (!instancia) return { ok: false, erro: "Instância do WhatsApp não configurada." };
  const env = await enviarTextoInstancia(instancia, i.paciente_telefone, msg);
  if (!env.ok) return { ok: false, erro: env.error ?? "O WhatsApp não aceitou a mensagem." };

  await sb.from("indicacoes").update({ status: "contatada", contatada_em: new Date().toISOString(), texto_enviado: msg }).eq("id", id);
  // Registra na conversa (como o painel faz nas confirmações): o robô passa a saber de onde a pessoa veio.
  await sb
    .from("n8n_chat_histories")
    .insert({
      session_id: i.paciente_telefone,
      message: { type: "ai", content: msg, tool_calls: [], additional_kwargs: { via: "indicacao" }, response_metadata: {}, invalid_tool_calls: [] },
    })
    .then(undefined, () => undefined);
  return { ok: true };
}

export interface LinhaParceiro {
  parceiro: Parceiro;
  indicacoes: number; // formulário
  aguardando: number;
  contatadas: number;
  responderam: number;
  leads: number; // contatos com origem neste parceiro (link + formulário + cadastro manual)
  agendados: number;
  compareceram: number;
}

export async function relatorioParceiros(): Promise<LinhaParceiro[]> {
  const sb = getClient();
  const [parceiros, indic, contatos, agend] = await Promise.all([
    listarParceiros(),
    sb.from("indicacoes").select("parceiro_id, status"),
    sb.from("ff_contatos").select("telefone, origem_parceiro").not("origem_parceiro", "is", null),
    sb.from("agendamentos").select("telefone_lead, status"),
  ]);
  const ind = (indic.data ?? []) as { parceiro_id: number; status: string }[];
  const cont = (contatos.data ?? []) as { telefone: string; origem_parceiro: string }[];
  const ag = (agend.data ?? []) as { telefone_lead: string; status: string }[];
  const agPor = new Map<string, string[]>();
  for (const a of ag) {
    const k = telefoneCanonico(a.telefone_lead);
    agPor.set(k, [...(agPor.get(k) ?? []), a.status]);
  }
  return parceiros.map((p) => {
    const meus = ind.filter((x) => x.parceiro_id === p.id);
    const leads = cont.filter((c) => c.origem_parceiro === p.codigo);
    let agendados = 0;
    let compareceram = 0;
    for (const l of leads) {
      const st = (agPor.get(telefoneCanonico(l.telefone)) ?? []).filter((s) => s !== "cancelado");
      if (st.length) agendados++;
      if (st.includes("compareceu")) compareceram++;
    }
    return {
      parceiro: p,
      indicacoes: meus.length,
      aguardando: meus.filter((x) => x.status === "aguardando" || x.status === "pronta").length,
      contatadas: meus.filter((x) => x.status === "contatada").length,
      responderam: meus.filter((x) => x.status === "respondeu").length,
      leads: leads.length,
      agendados,
      compareceram,
    };
  });
}

export async function listarIndicacoes(): Promise<(Indicacao & { parceiro_nome: string })[]> {
  const sb = getClient();
  const [r, ps] = await Promise.all([
    sb
      .from("indicacoes")
      .select("id, parceiro_id, paciente_nome, paciente_telefone, quem_indicou, observacao, status, liberar_em, contatada_em, respondeu_em, texto_enviado, criado_em")
      .order("criado_em", { ascending: false })
      .limit(200),
    listarParceiros(),
  ]);
  const nome = new Map(ps.map((p) => [p.id, p.nome]));
  return ((r.data ?? []) as Indicacao[]).map((i) => ({ ...i, parceiro_nome: nome.get(i.parceiro_id) ?? "Parceiro" }));
}
