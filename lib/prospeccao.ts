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
import { enviarMidiaWhatsApp, enviarTextoInstancia } from "./evolution";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { enviarPartes, registrarNaConversa } from "./confirmacao-envio";
import { chamarPausaWebhook } from "./painel-pausa";
import { variantesTelefone } from "./telefone";
import { CREFITO } from "./site";

export const INTERVALO_MIN = 30;
export const LIMITE_DIA = 16;
const JANELA_INI_H = 9;
const JANELA_FIM_H = 18;
const SP = 3 * 3600 * 1000;

// Dias entre uma mensagem e a próxima: D0 → D4 → D10 → D21 e, depois, um recado a cada 30 dias.
// Só para quando o estabelecimento responde (ou recusa). Segurança: no máximo 8 mensagens ao todo (cerca de 5 meses).
const DIAS_ATE_PROXIMA: Record<number, number> = { 1: 4, 2: 6, 3: 11, 4: 30, 5: 30, 6: 30, 7: 30 };
const ULTIMO_PASSO = 8;

export type StatusProspecto =
  | "fila"
  | "aguardando"
  | "respondeu"
  | "parceiro"
  | "recusou"
  | "encerrado"
  | "sem_telefone"
  | "sem_whatsapp"
  | "so_presencial"
  | "silenciado"; // número que o robô NUNCA deve atender (ex.: outra empresa do Anderson)

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

/** Mensagens do passo (1 = apresentação, 2 = D4, 3 = D10, 4 = D21). Curtas e com parágrafos, para ler fácil no celular. */
export function textosDoPasso(p: Prospecto, passo: number): string[] {
  const lugar = p.lugar;
  const m = p.modelo;
  const sair = "Se preferir que eu não escreva mais, é só avisar. 🙂";
  if (passo === 1) {
    const oi = `Olá, tudo bem? 😊

${ASSINATURA}.

${abertura(p)}`;
    if (m === "B")
      return [
        oi,
        `Queria me apresentar à equipe de ${lugar}.

De vez em quando um aluno chega com dor ou alguma limitação que foge do que o Pilates pode tratar, e fica sem saber a quem recorrer.

Se isso acontecer aí, posso conversar com o aluno e orientar, sem custo nenhum para vocês.`,
        `Posso te mandar uma apresentação em PDF?

Se fizer sentido, gostaria também de marcar uma ligação rápida de 10 minutos para conhecer o serviço de vocês.

${sair}`,
      ];
    if (m === "D")
      return [
        oi,
        `Acho que atendemos o mesmo perfil de pessoa, só que em frentes diferentes.

Se fizer sentido, podemos criar uma troca de indicações entre nós, sempre pelo que for melhor para o paciente.`,
        `Posso te mandar uma apresentação em PDF?

Se topar, gostaria também de marcar uma ligação rápida de 10 minutos para conhecer o seu serviço e ver como podemos indicar um ao outro.

${sair}`,
      ];
    return [
      oi,
      `Trabalho com terapia manual e reabilitação de dor e lesões de quem treina.

Muita gente para de treinar por dor no ombro, no joelho ou na coluna e não sabe a quem procurar. Se algum aluno de ${lugar} estiver assim, posso avaliar e orientar.`,
      `Posso te mandar uma apresentação em PDF?

Se fizer sentido, gostaria também de marcar uma ligação rápida de 10 minutos para conhecer o serviço de vocês.

${sair}`,
    ];
  }
  if (passo === 2) {
    if (m === "D") return [`Oi! Só confirmando se você viu a minha mensagem.

Se for mais fácil, a gente toma um café perto do seu consultório. 🙂`];
    if (m === "B") return [`Oi! Só passando para confirmar se a minha mensagem chegou.

Não precisa responder agora. Se preferir, passo aí rapidinho para deixar um cartão. Qual o melhor dia? 🙂`];
    return [`Oi! Passando para saber se você viu a minha mensagem.

Posso deixar um cartão com o instrutor responsável, sem tomar o seu tempo. Qual o melhor dia e horário? 🙂`];
  }
  if (passo === 3) {
    if (m === "D")
      return [
        `Olá! Se algum paciente seu tiver dor que atrapalha o movimento ou o treino, pode me chamar.`,
        `Com a autorização do paciente, posso devolver uma orientação por escrito para você acompanhar o caso.

E fico feliz em indicar você quando alguém precisar do seu trabalho.`,
      ];
    if (m === "B")
      return [
        `Olá! Se for útil para ${lugar}, posso montar um material curto com sinais de que um aluno deve procurar avaliação antes de continuar nas aulas.`,
        `Também faço uma conversa de 20 minutos sobre postura e dor nas costas para os alunos, sem custo.

Se fizer sentido, combinamos.`,
      ];
    return [
      `Olá! Se tiver interesse, faço uma conversa curta (15 a 20 minutos) para os alunos de ${lugar} sobre prevenção de lesões no treino, sem custo.`,
      `Combino o dia com você.`,
    ];
  }
  if (passo === 4)
    return [`Olá! Passando só para deixar o meu contato.

Se alguém de ${lugar} precisar de fisioterapia, ou se quiser conversar sobre uma parceria, é só me chamar por aqui. 🙂`];
  if (passo === 5)
    return [`Oi! Tudo bem por aí? 😊

Sigo à disposição para uma conversa rápida de 10 minutos, quando for um bom momento para você.`];
  if (passo === 6)
    return [`Olá! Espero que esteja tudo bem com ${lugar}.

Se algum aluno ou cliente precisar de uma avaliação de fisioterapia, pode me indicar. Fico à disposição. 🙂`];
  if (passo === 7)
    return [`Oi! Passando para desejar uma ótima semana. 😊

Se a parceria fizer sentido em algum momento, é só me chamar.`];
  return [`Olá! Este é o meu último recado, para não incomodar.

Fica o meu número: se alguém de ${lugar} precisar de fisioterapia, é só indicar o WhatsApp deste consultório.

Obrigado! 🙏`];
}

/** Para mostrar na tela: as mensagens do passo separadas por uma linha. */
export function textoDoPasso(p: Prospecto, passo: number): string {
  return textosDoPasso(p, passo).join(`

— próxima mensagem —

`);
}

/** Resposta automática de WhatsApp Business (menu, boas-vindas, horário): não conta como resposta de uma pessoa. */
export function pareceRespostaAutomatica(t: string): boolean {
  return /(digite\s+\d|digite\s+a\s+op|escolha\s+uma\s+op|agradece\s+(o\s+)?seu\s+contato|seja\s+(muito\s+)?bem[\s-]?vind|mensagem\s+autom[áa]tica|resposta\s+autom[áa]tica|no\s+momento\s+(n[ãa]o|estamos)|nosso\s+hor[áa]rio\s+de\s+atendimento|em\s+que\s+(posso|podemos)\s+(lhe\s+)?ajudar|retornaremos|retornamos\s+assim|assistente\s+virtual|oi,\s*none|conseguiu\s+ver\s+minha\s+[úu]ltima\s+mensagem)/i.test(t);
}

/** Respostas que significam "não quero": o prospecto nunca mais recebe mensagem. */
export function pareceRecusa(t: string): boolean {
  return /\b(n[aã]o\s+(tenho\s+interesse|temos\s+interesse|tem\s+interesse|quero|queremos|precisa|preciso|precisamos|me\s+(escreva|mande|envie)|envie|mande|escreva|obrigad)|pare\b|parar\b|sair\b|remov|descadastr|me\s+tire|sem\s+interesse|spam|bloque)/i.test(t);
}

/** Só confirmou que viu/recebeu ("chegou", "recebi", "ok"): não é resposta de interesse, a sequência continua. */
export function pareceApenasConfirmacao(t: string): boolean {
  const s = t.trim().toLowerCase().replace(/[.!,;:)(🙂👍🙏😊\s]+$/gu, "");
  return s.length <= 40 && /^(oi,?\s*|ol[aá],?\s*)?(chegou|recebi|vi sim|vi|ok|blz|beleza|certo|obrigad[oa])(\s+(sim|amigo|amiga|anderson|obrigad[oa]))*$/.test(s);
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


// ---------- respostas a quem escreveu (fila) ----------

/** Separador entre mensagens de uma resposta (uma linha com três sinais de igual). */
export const SEPARADOR = "\n===\n";

export const TEXTO_APRESENTACAO = [
  "Obrigado pelo retorno! 😊",
  "Segue a minha apresentação em PDF, com os serviços, como funciona a consulta e meus links (site, Instagram e YouTube).",
  "[PDF]",
  `Gostaria de marcar uma ligação ou um café rápido (10 a 15 minutos) para conhecer melhor o seu serviço e ver como posso indicar o seu trabalho também.

Qual o melhor dia e horário para você?`,
].join(SEPARADOR);

/** Coloca uma resposta na fila. Separe as mensagens por uma linha "===" e use [PDF] onde a apresentação deve ir como arquivo. */
export async function enfileirarResposta(prospeccaoId: number, texto: string): Promise<boolean> {
  const r = await getClient().from("prospeccao_respostas").insert({ prospeccao_id: prospeccaoId, texto: texto.slice(0, 3000) });
  return !r.error;
}

function dentroDaJanelaDeResposta(d: Date = new Date()): boolean {
  const { h } = horaSP(d);
  return h >= 8 && h < 20;
}

async function processarRespostas(instancia: string): Promise<string | null> {
  if (!dentroDaJanelaDeResposta()) return null;
  const sb = getClient();
  const q = await sb.from("prospeccao_respostas").select("id, prospeccao_id, texto").eq("status", "pendente").order("id").limit(1);
  const item = (q.data?.[0] ?? null) as { id: number; prospeccao_id: number; texto: string } | null;
  if (!item) return null;
  const pr = await sb.from("prospeccao").select("*").eq("id", item.prospeccao_id).limit(1);
  const p = (pr.data?.[0] ?? null) as Prospecto | null;
  const falha = async (erro: string, definitivo = false) => {
    await sb.from("prospeccao_respostas").update({ status: definitivo ? "erro" : "pendente", erro: erro.slice(0, 200) }).eq("id", item.id);
    return `resposta-falhou:${item.id}`;
  };
  if (!p?.telefone) return falha("Prospecto sem telefone.", true);
  if (["recusou", "silenciado"].includes(p.status)) return falha("Prospecto não deve receber mensagem.", true);
  // marca como em andamento antes de enviar (não repete se algo travar no meio)
  const u = await sb.from("prospeccao_respostas").update({ status: "enviando" }).eq("id", item.id).eq("status", "pendente").select("id");
  if (!u.data?.length) return null;
  const chk = await existeNoWhatsApp(p.telefone, instancia);
  const destino = chk.jid ?? p.telefone;
  await chamarPausaWebhook(destino, "pause");
  const enviadas: string[] = [];
  let pdfOk = true;
  const partes = item.texto.split(SEPARADOR).map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < partes.length; i++) {
    if (partes[i] === "[PDF]") {
      try {
        const buf = await readFile(join(process.cwd(), "public", "apresentacao-parceiros.pdf"));
        const r = await enviarMidiaWhatsApp(destino, { mediatype: "document", mimetype: "application/pdf", media: buf.toString("base64"), fileName: "Apresentacao-Anderson-Andrade-Fisioterapia.pdf" }, instancia);
        if (!r.ok) pdfOk = false;
        else enviadas.push("📎 Apresentação em PDF enviada");
      } catch {
        pdfOk = false;
      }
      if (!pdfOk) break;
    } else {
      const r = await enviarTextoInstancia(instancia, destino, partes[i]);
      if (!r.ok) {
        await sb.from("prospeccao_respostas").update({ status: "erro", erro: (r.error ?? "erro").slice(0, 200) }).eq("id", item.id);
        if (enviadas.length) await registrarNaConversa(destino, enviadas, "prospeccao");
        return `resposta-erro:${item.id}`;
      }
      enviadas.push(partes[i]);
    }
    if (i < partes.length - 1) await new Promise((res) => setTimeout(res, 3000 + Math.floor(Math.random() * 3000)));
  }
  await sb.from("prospeccao_respostas").update({ status: pdfOk ? "enviada" : "erro", erro: pdfOk ? null : "Falha ao enviar o PDF.", enviada_em: new Date().toISOString() }).eq("id", item.id);
  await registrarNaConversa(destino, enviadas, "prospeccao");
  await sb.from("prospeccao").update({ telefone: destino, observacao: `Resposta enviada em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` }).eq("id", p.id);
  return `resposta-enviada:${p.lugar}`;
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
    // Menu/boas-vindas automáticos do WhatsApp Business do estabelecimento não são resposta de uma pessoa.
    const humanas = rs.filter((x) => !pareceRespostaAutomatica(x) && !pareceApenasConfirmacao(x));
    if (!humanas.length) {
      await manterRoboCalado(p);
      continue;
    }
    rs = humanas;
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

/** Deixa cada estabelecimento cadastrado como contato "parceiro" no painel (com o número na forma que o WhatsApp entrega), para o Anderson saber quem é quando escrever. */
async function sincronizarContatos(instancia: string): Promise<number> {
  const sb = getClient();
  const r = await sb.from("prospeccao").select("*").not("telefone", "is", null).not("status", "in", "(sem_whatsapp,silenciado)").order("id");
  let n = 0;
  for (const p of (r.data ?? []) as Prospecto[]) {
    if (n >= 4) break; // poucos por ciclo: cada um consulta a Evolution
    if (!p.telefone) continue;
    const ja = await sb.from("ff_contatos").select("telefone").in("telefone", variantesTelefone(p.telefone)).limit(1);
    if (ja.data?.length) continue;
    const chk = await existeNoWhatsApp(p.telefone, instancia);
    if (!chk.existe || !chk.jid) continue;
    const jaJid = await sb.from("ff_contatos").select("telefone").in("telefone", variantesTelefone(chk.jid)).limit(1);
    if (jaJid.data?.length) continue;
    const regiao = p.regiao === "centro" ? "Centro/Beira-Mar" : "Capoeiras";
    const ins = await sb.from("ff_contatos").insert({
      telefone: chk.jid,
      nome: p.lugar,
      perfil: "parceiro",
      lead_ativo: false,
      funnel_stage: "novo",
      observacoes: `PARCERIA (campanha de prospecção, nov/2026): ${p.lugar} · ${p.categoria ?? ""} · ${regiao}. Não é paciente: é estabelecimento/profissional para parceria.`,
    });
    if (!ins.error) n++;
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
  const due = await sb.from("prospeccao").select("*").eq("status", "aguardando").lte("proximo_em", agora).lt("passo", ULTIMO_PASSO).order("proximo_em").limit(1);
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
  await sincronizarContatos(instancia).catch(() => 0);
  const respEnviada = await processarRespostas(instancia).catch(() => null);
  if (respEnviada) return respEnviada; // uma coisa por ciclo
  // Quem já respondeu, virou parceiro ou foi silenciado continua com o robô calado (a pausa do robô dura 24 h, então é renovada).
  const abertos = await sb.from("prospeccao").select("*").in("status", ["respondeu", "parceiro", "silenciado", "recusou"]);
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
  const partes = textosDoPasso(p, passo);

  // Cala o robô ANTES de escrever (a resposta pode chegar em segundos).
  const pa = await chamarPausaWebhook(destino, "pause");
  if (!pa.ok) {
    await adiar(15);
    await sb.from("prospeccao").update({ observacao: `Não consegui calar o robô: ${pa.error ?? "erro"}. Tentando de novo.` }).eq("id", p.id);
    return "pausa-falhou";
  }
  const env = await enviarPartes(instancia, destino, partes);
  if (!env.ok) {
    await adiar(15);
    await sb.from("prospeccao").update({ observacao: `Envio falhou: ${(env.erro ?? "erro").slice(0, 150)}` }).eq("id", p.id);
    if (!env.enviadas.length) return "envio-falhou";
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
  await registrarNaConversa(destino, env.enviadas, "prospeccao");
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
