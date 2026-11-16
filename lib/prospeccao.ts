// Prospecção de parcerias (estúdios de Pilates, academias, nutricionistas…): envio lento e humano pelo WhatsApp do consultório.
// Regras de segurança (o número do robô já foi bloqueado duas vezes):
//  - 1 mensagem a cada 30 min (mais um intervalo aleatório de 0 a 6 min), só de segunda a sexta, das 9h às 18h (Brasília);
//  - no máximo 16 por dia;
//  - confere se o número existe no WhatsApp antes de escrever;
//  - quem responde "não" nunca mais recebe nada;
//  - o robô fica CALADO nessas conversas (senão ele trataria um parceiro como paciente) e o Anderson é avisado de toda resposta.
// Server-only. Falha em qualquer etapa NÃO derruba o painel.
import { getClient } from "./db";
import { destinatariosAlerta } from "./config";
import { enviarTextoInstancia } from "./evolution";
import { registrarNaConversa } from "./confirmacao-envio";
import { chamarPausaWebhook } from "./painel-pausa";
import { variantesTelefone } from "./telefone";
import { CREFITO } from "./site";

export const INTERVALO_MIN = 30;
export const LIMITE_DIA = 16;
const JANELA_INI_H = 9;
const JANELA_FIM_H = 18;
const SP = 3 * 3600 * 1000;

// Dias entre uma mensagem e a próxima: D0 → D4 → D10 → D21.
const DIAS_ATE_PROXIMA: Record<number, number> = { 1: 4, 2: 6, 3: 11 };

export type StatusProspecto =
  | "fila"
  | "aguardando"
  | "respondeu"
  | "parceiro"
  | "recusou"
  | "encerrado"
  | "sem_telefone"
  | "sem_whatsapp"
  | "so_presencial";

export interface Prospecto {
  id: number;
  nome: string;
  lugar: string;
  regiao: "centro" | "capoeiras";
  categoria: string | null;
  modelo: string;
  gancho: string | null;
  telefone: string | null;
  telefone_original: string | null;
  endereco: string | null;
  prioridade: number;
  status: StatusProspecto;
  passo: number;
  ultimo_envio_em: string | null;
  proximo_em: string | null;
  respondeu_em: string | null;
  ultima_resposta: string | null;
  parceiro_codigo: string | null;
  observacao: string | null;
}

// ---------- textos ----------

const LOCAL: Record<string, string> = {
  centro: "Atendo no Espaço Beira Mar, na R. Altamiro Guimarães, 190, ao lado do Beiramar Shopping.",
  capoeiras: "Atendo na Rua Joaquim Carneiro, 207, em Capoeiras.",
};

const ASSINATURA = `Aqui é o Anderson Andrade, fisioterapeuta (${CREFITO})`;

function abertura(p: Prospecto): string {
  const g = (p.gancho ?? "").trim();
  if (g && /atendo/i.test(g)) return g;
  return `${g ? g + " " : ""}${LOCAL[p.regiao]}`;
}

/** Texto do passo (1 = apresentação, 2 = D4, 3 = D10, 4 = D21) para este prospecto. */
export function textoDoPasso(p: Prospecto, passo: number): string {
  const lugar = p.lugar;
  const m = p.modelo;
  if (passo === 1) {
    if (m === "B")
      return `Olá, tudo bem? ${ASSINATURA}. ${abertura(p)} Queria me apresentar ao ${lugar}: de vez em quando um aluno chega com dor ou com alguma limitação que foge do que o Pilates pode tratar, e fica sem saber a quem recorrer. Se isso acontecer aí, posso conversar com o aluno e orientar, sem custo nenhum para vocês. Posso te mandar uma apresentação curta? Se preferir que eu não escreva mais, é só avisar. 🙂`;
    if (m === "D")
      return `Olá, tudo bem? ${ASSINATURA}. ${abertura(p)} Acho que atendemos o mesmo perfil de pessoa, só que em frentes diferentes, e queria me apresentar. Se fizer sentido, podemos criar uma troca de indicações entre nós, sempre pelo que for melhor para o paciente. Posso te mandar uma apresentação curta? Se preferir que eu não escreva mais, é só avisar. 🙂`;
    return `Olá, tudo bem? ${ASSINATURA}. ${abertura(p)} Trabalho com terapia manual e reabilitação de dor e lesões de quem treina. Muita gente para de treinar por dor no ombro, no joelho ou na coluna e não sabe a quem procurar. Se algum aluno do ${lugar} estiver assim, posso avaliar e orientar. Posso passar aí para me apresentar? Se preferir que eu não escreva mais, é só avisar. 🙂`;
  }
  if (passo === 2) {
    if (m === "D") return `Oi! Só confirmando se você viu a minha mensagem. Se for mais fácil, a gente toma um café perto do seu consultório. 🙂`;
    if (m === "B") return `Oi! Só passando para confirmar se a minha mensagem chegou. Não precisa responder agora. Se preferir, passo aí no ${lugar} rapidinho para deixar um cartão. Qual o melhor dia? 🙂`;
    return `Oi! Passando para saber se você viu a minha mensagem. Posso deixar um cartão com o instrutor responsável, sem tomar o seu tempo. Qual o melhor dia e horário? 🙂`;
  }
  if (passo === 3) {
    if (m === "D") return `Olá! Se algum paciente seu tiver dor que atrapalha o movimento ou o treino, pode me chamar. Com a autorização do paciente, posso devolver uma orientação por escrito para você acompanhar o caso. E fico feliz em indicar você quando alguém precisar do seu trabalho.`;
    if (m === "B") return `Olá! Se for útil para o ${lugar}, posso montar um material curto com sinais de que um aluno deve procurar avaliação antes de continuar nas aulas. Também faço uma conversa de 20 minutos sobre postura e dor nas costas para os alunos, sem custo. Se fizer sentido, combinamos.`;
    return `Olá! Se tiver interesse, faço uma conversa curta (15 a 20 minutos) para os alunos do ${lugar} sobre prevenção de lesões no treino, sem custo. Combino o dia com você.`;
  }
  return `Olá! Este é o meu último contato, para não incomodar. Fica o meu número: se alguém do ${lugar} precisar de fisioterapia, é só indicar o WhatsApp deste consultório. Obrigado! 🙏`;
}

/** Respostas que significam "não quero": o prospecto nunca mais recebe mensagem. */
export function pareceRecusa(t: string): boolean {
  return /\b(n[aã]o\s+(tenho\s+interesse|quero|precisa|preciso|me\s+(escreva|mande|envie)|envie|mande|escreva|obrigad)|pare\b|parar\b|sair\b|remov|descadastr|me\s+tire|n[aã]o\s+tem\s+interesse|sem\s+interesse|spam|bloque)/i.test(t);
}

// ---------- configuração e estado ----------

async function cfg(chave: string): Promise<string | null> {
  const r = await getClient().from("prospeccao_config").select("valor").eq("chave", chave).limit(1);
  return (r.data?.[0] as { valor: string | null } | undefined)?.valor ?? null;
}
async function setCfg(chave: string, valor: string | null): Promise<void> {
  await getClient().from("prospeccao_config").upsert({ chave, valor }, { onConflict: "chave" });
}
export async function campanhaAtiva(): Promise<boolean> {
  return (await cfg("ativa")) === "sim";
}
export async function definirCampanha(ativa: boolean): Promise<void> {
  await setCfg("ativa", ativa ? "sim" : "nao");
}

function horaSP(d: Date): { dow: number; h: number; ymd: string } {
  const sp = new Date(d.getTime() - SP);
  return { dow: sp.getUTCDay(), h: sp.getUTCHours(), ymd: sp.toISOString().slice(0, 10) };
}
export function dentroDaJanelaProspeccao(d: Date = new Date()): boolean {
  const { dow, h } = horaSP(d);
  return dow >= 1 && dow <= 5 && h >= JANELA_INI_H && h < JANELA_FIM_H;
}

export async function listarProspectos(): Promise<Prospecto[]> {
  const r = await getClient().from("prospeccao").select("*").order("prioridade").order("id");
  return (r.data ?? []) as Prospecto[];
}

// ---------- WhatsApp ----------

/** true = existe · false = não existe · null = não deu para saber (Evolution fora do ar). */
async function existeNoWhatsApp(numero: string, instancia: string): Promise<{ existe: boolean | null; jid: string | null }> {
  const base = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_KEY;
  if (!base || !apikey) return { existe: null, jid: null };
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/chat/whatsappNumbers/${encodeURIComponent(instancia)}`, {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ numbers: [numero] }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { existe: null, jid: null };
    const j = (await res.json()) as { exists?: boolean; jid?: string }[];
    const r = Array.isArray(j) ? j[0] : null;
    if (!r) return { existe: null, jid: null };
    const dig = String(r.jid ?? "").split("@")[0].replace(/\D/g, "");
    return r.exists && dig.length >= 10 ? { existe: true, jid: dig } : { existe: false, jid: null };
  } catch {
    return { existe: null, jid: null };
  }
}

/** Mensagens que a pessoa mandou depois de `desde`, lidas direto da Evolution (vale mesmo com o robô calado). */
async function respostasNaEvolution(numero: string, instancia: string, desde: Date): Promise<string[]> {
  const base = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_KEY;
  if (!base || !apikey) return [];
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/chat/findMessages/${encodeURIComponent(instancia)}`, {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ where: { key: { remoteJid: `${numero}@s.whatsapp.net`, fromMe: false } } }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as unknown;
    const lista: unknown[] = Array.isArray(j)
      ? j
      : Array.isArray((j as { messages?: { records?: unknown[] } })?.messages?.records)
        ? ((j as { messages: { records: unknown[] } }).messages.records)
        : Array.isArray((j as { records?: unknown[] })?.records)
          ? (j as { records: unknown[] }).records
          : [];
    const out: string[] = [];
    for (const m of lista as { messageTimestamp?: number | string; key?: { fromMe?: boolean }; message?: Record<string, unknown> }[]) {
      if (m?.key?.fromMe) continue;
      const ts = Number(m?.messageTimestamp ?? 0) * 1000;
      if (!ts || ts <= desde.getTime()) continue;
      const msg = m?.message ?? {};
      const txt =
        (msg.conversation as string | undefined) ??
        ((msg.extendedTextMessage as { text?: string } | undefined)?.text) ??
        (msg.audioMessage ? "[áudio]" : msg.imageMessage ? "[imagem]" : msg.documentMessage ? "[documento]" : "[mensagem]");
      out.push(String(txt));
    }
    return out;
  } catch {
    return [];
  }
}

async function respostasDoBanco(telefone: string, desde: Date): Promise<string[]> {
  const sb = getClient();
  const v = variantesTelefone(telefone);
  const r = await sb.from("ff_mensagens").select("conteudo").in("telefone", v).eq("direcao", "entrada").gt("criada_em", desde.toISOString()).order("id");
  const a = ((r.data ?? []) as { conteudo: string | null }[]).map((x) => x.conteudo ?? "").filter(Boolean);
  if (a.length) return a;
  const h = await sb.from("n8n_chat_histories").select("message").in("session_id", v).gt("created_at", desde.toISOString()).order("id");
  return ((h.data ?? []) as { message: { type?: string; content?: unknown } | null }[])
    .filter((x) => x.message?.type === "human")
    .map((x) => String(x.message?.content ?? ""))
    .filter(Boolean);
}

async function avisarDono(texto: string): Promise<void> {
  const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  if (!instancia) return;
  for (const d of destinatariosAlerta()) {
    if (d.whatsapp) await enviarTextoInstancia(instancia, d.whatsapp, texto).catch(() => undefined);
  }
}

// ---------- ciclo ----------

const g = globalThis as unknown as { __prospeccaoRelogio?: boolean; __prospPausa?: Map<number, number> };

async function manterRoboCalado(p: Prospecto, forcar = false): Promise<void> {
  if (!p.telefone) return;
  g.__prospPausa ??= new Map();
  const ult = g.__prospPausa.get(p.id) ?? 0;
  if (!forcar && Date.now() - ult < 12 * 3600 * 1000) return;
  const r = await chamarPausaWebhook(p.telefone, "pause");
  if (r.ok) g.__prospPausa.set(p.id, Date.now());
}

async function detectarRespostas(instancia: string): Promise<number> {
  const sb = getClient();
  const r = await sb.from("prospeccao").select("*").eq("status", "aguardando").not("ultimo_envio_em", "is", null);
  let n = 0;
  for (const p of (r.data ?? []) as Prospecto[]) {
    if (!p.telefone || !p.ultimo_envio_em) continue;
    const desde = new Date(p.ultimo_envio_em);
    let rs = await respostasDoBanco(p.telefone, desde);
    if (!rs.length) rs = await respostasNaEvolution(p.telefone, instancia, desde);
    if (!rs.length) {
      await manterRoboCalado(p);
      continue;
    }
    const texto = rs.join(" / ").slice(0, 400);
    const recusou = rs.some(pareceRecusa);
    await sb
      .from("prospeccao")
      .update({ status: recusou ? "recusou" : "respondeu", respondeu_em: new Date().toISOString(), ultima_resposta: texto, proximo_em: null })
      .eq("id", p.id);
    await sb.from("ff_contatos").update({ lead_ativo: false }).in("telefone", variantesTelefone(p.telefone)).then(undefined, () => undefined);
    await manterRoboCalado(p, true);
    await avisarDono(
      recusou
        ? `🤝 Parceria: ${p.lugar} respondeu que não tem interesse. Não vou escrever mais.\n«${texto.slice(0, 200)}»`
        : `🤝 Parceria: ${p.lugar} respondeu!\n«${texto.slice(0, 300)}»\nO robô está calado nessa conversa. Abra o painel → Prospecção.`,
    );
    n++;
  }
  return n;
}

async function enviosHoje(): Promise<number> {
  const { ymd } = horaSP(new Date());
  const r = await getClient().from("prospeccao").select("id", { count: "exact", head: true }).gte("ultimo_envio_em", `${ymd}T03:00:00Z`);
  return r.count ?? 0;
}

async function escolherProximo(): Promise<Prospecto | null> {
  const sb = getClient();
  const agora = new Date().toISOString();
  const due = await sb.from("prospeccao").select("*").eq("status", "aguardando").lte("proximo_em", agora).lt("passo", 4).order("proximo_em").limit(1);
  if (due.data?.length) return due.data[0] as Prospecto;
  const novo = await sb.from("prospeccao").select("*").eq("status", "fila").eq("passo", 0).not("telefone", "is", null).order("prioridade").order("id").limit(1);
  return (novo.data?.[0] ?? null) as Prospecto | null;
}

/** Um ciclo do relógio (chamado a cada minuto). Devolve o que fez, para log. */
export async function rodarProspeccao(): Promise<string | null> {
  const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  if (!instancia) return null;
  const sb = getClient();
  const respondidos = await detectarRespostas(instancia);
  // Quem já respondeu (ou virou parceiro) continua com o robô calado até a conversa ser encerrada.
  const abertos = await sb.from("prospeccao").select("*").in("status", ["respondeu", "parceiro"]);
  for (const x of (abertos.data ?? []) as Prospecto[]) await manterRoboCalado(x);

  if (!(await campanhaAtiva())) return respondidos ? `respostas:${respondidos}` : null;
  const agora = new Date();
  if (!dentroDaJanelaProspeccao(agora)) return respondidos ? `respostas:${respondidos}` : null;
  const depois = await cfg("proximo_envio_apos");
  if (depois && new Date(depois) > agora) return respondidos ? `respostas:${respondidos}` : null;
  if ((await enviosHoje()) >= LIMITE_DIA) return null;

  const p = await escolherProximo();
  if (!p || !p.telefone) return null;
  const passo = p.passo + 1;
  const adiar = async (min: number) => setCfg("proximo_envio_apos", new Date(Date.now() + min * 60000).toISOString());

  const chk = await existeNoWhatsApp(p.telefone, instancia);
  if (chk.existe === null) {
    await adiar(10);
    return "evolution-indisponivel";
  }
  if (!chk.existe) {
    await sb.from("prospeccao").update({ status: "sem_whatsapp", observacao: "Número não tem WhatsApp." }).eq("id", p.id);
    return `sem-whatsapp:${p.id}`;
  }
  const destino = chk.jid ?? p.telefone;
  const texto = textoDoPasso(p, passo);

  // Cala o robô ANTES de escrever (a resposta pode chegar em segundos).
  const pa = await chamarPausaWebhook(destino, "pause");
  if (!pa.ok) {
    await adiar(15);
    await sb.from("prospeccao").update({ observacao: `Não consegui calar o robô: ${pa.error ?? "erro"}. Tentando de novo.` }).eq("id", p.id);
    return "pausa-falhou";
  }
  const env = await enviarTextoInstancia(instancia, destino, texto);
  if (!env.ok) {
    await adiar(15);
    await sb.from("prospeccao").update({ observacao: `Envio falhou: ${(env.error ?? "erro").slice(0, 150)}` }).eq("id", p.id);
    return "envio-falhou";
  }
  const proximo = DIAS_ATE_PROXIMA[passo];
  await sb
    .from("prospeccao")
    .update({
      telefone: destino,
      passo,
      status: proximo ? "aguardando" : "encerrado",
      ultimo_envio_em: new Date().toISOString(),
      proximo_em: proximo ? new Date(Date.now() + proximo * 86400000).toISOString() : null,
      observacao: null,
    })
    .eq("id", p.id);
  await registrarNaConversa(destino, [texto], "prospeccao");
  await adiar(INTERVALO_MIN + Math.floor(Math.random() * 7));
  return `enviado:${p.lugar}:passo${passo}`;
}

export function iniciarRelogioProspeccao() {
  if (g.__prospeccaoRelogio) return;
  g.__prospeccaoRelogio = true;
  let rodando = false;
  setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await rodarProspeccao();
      if (r) console.log("[prospeccao]", r);
    } catch (e) {
      console.error("[prospeccao]", e instanceof Error ? e.message : e);
    } finally {
      rodando = false;
    }
  }, 60 * 1000);
}
