// Gratidão no Instagram: curtida, elogio, compartilhamento, menção em story, figurinha, foto/vídeo/áudio sem pergunta.
// Nesses casos o robô responde SÓ com gratidão e acolhimento: nada de preço, agendamento, pergunta comercial,
// "não consigo ver a mídia" ou "não entendi". Empurrar venda a quem só reagiu inibe novas interações.
// A conversa só entra no fluxo de atendimento quando a pessoa demonstra interesse genuíno.
// Funções puras (sem I/O), testáveis isoladamente.

/** Sinais de interesse real: pergunta, pedido de informação, agenda, valor, dor, endereço... */
const INTERESSE =
  /agend|marca[çc][aã]o|\bmarcar\b|hor[aá]rio|\bvalor|pre[çc]o|quanto|consulta|sess[aã]o|\batende(m|s)?\b|endere[çc]o|onde fica|localiza|informa[çc]|\bcomo (faz|fa[çc]o|funciona|chego)|\bquero\b|gostaria|interesse|interessad|\bdor(es)?\b|coluna|cervical|lombar|fisio\b|tratamento|conv[eê]nio|\bplano\b|whats|telefone|contato|dispon[ií]vel|\bvaga|preciso|procuro|\bajuda\b|me chama|chama no/i;

/** Elogio ou agradecimento simples. */
const ELOGIO =
  /obrigad|valeu|gratid|parab[eé]n|\blind[oa]s?\b|amei|adorei|maravilh|excelente|[oó]timo|\btop\b|\bshow\b|perfeit|incr[ií]vel|demais|inspirador|que bom|aben[cç]oa|deus|am[eé]m|boa\b|boa sorte|sucesso|linda|fant[aá]stic|\bamo\b|curti|gostei|muito bom|bem bom|bacana|legal|[oó]tim[oa]/i;

const TEM_LETRA_OU_NUMERO = /[\p{L}\p{N}]/u;
const TEM_EMOJI = /\p{Extended_Pictographic}/u;

/** O texto traz interesse genuíno (ou pergunta)? */
export function temInteresse(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false;
  return t.includes("?") || INTERESSE.test(t);
}

export type ClasseMensagem = "gratidao" | "normal";

/**
 * Decide se a mensagem do direct pede só gratidão.
 * Mensagem sem texto com mídia/compartilhamento/story/figurinha, só emojis, ou elogio curto sem interesse = gratidão.
 */
export function classificarMensagem(texto: string | null | undefined, anexos: string[], respostaStory: boolean): ClasseMensagem {
  const t = (texto ?? "").trim();
  if (!t) return anexos.length > 0 || respostaStory ? "gratidao" : "normal";
  if (temInteresse(t)) return "normal";
  if (!TEM_LETRA_OU_NUMERO.test(t)) return "gratidao"; // só emoji e pontuação
  if (t.length <= 90 && ELOGIO.test(t)) return "gratidao";
  return "normal";
}

/** Rótulo curto, para o CRM mostrar o que a pessoa fez quando não há texto. */
export function descreverGesto(anexos: string[], respostaStory: boolean): string {
  if (anexos.some((a) => ["share", "ig_post", "ig_reel", "reel"].includes(a))) return "(compartilhou uma publicação)";
  if (anexos.includes("story_mention")) return "(mencionou o perfil em um story)";
  if (respostaStory) return "(reagiu a um story)";
  if (anexos.includes("like_heart")) return "(enviou um coração)";
  if (anexos.some((a) => a === "image")) return "(enviou uma imagem)";
  if (anexos.some((a) => a === "video")) return "(enviou um vídeo)";
  if (anexos.some((a) => a === "audio")) return "(enviou um áudio)";
  if (anexos.length) return "(enviou uma mídia)";
  return "(mensagem sem texto)";
}

export function foiCompartilhamento(anexos: string[], respostaStory: boolean): boolean {
  return respostaStory || anexos.some((a) => ["share", "ig_post", "ig_reel", "reel", "story_mention"].includes(a));
}

const primeiroNome = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] ?? "";

// {n} vira ", Carla" quando o nome é conhecido (e nada quando não é).
const CARINHO = [
  "Que alegria receber o seu carinho{n}! 💚 Muito obrigado, de coração.",
  "Obrigado{n}! Fico muito feliz que tenha gostado 🙏",
  "Recebi com muita gratidão{n}! O seu apoio faz toda a diferença por aqui 💚",
  "Muito obrigado{n}! É um prazer ter você por aqui acompanhando o nosso trabalho 😊",
];
const CARINHO_COM_PORTA = [
  "Obrigado pelo carinho{n}! 💚 Se um dia quiser conhecer o trabalho ou agendar uma consulta, é só me chamar por aqui.",
  "Muito obrigado{n}! 🙏 Quando quiser saber mais ou marcar uma consulta, estarei por aqui para ajudar.",
];
const COMPARTILHOU = [
  "Muito obrigado por compartilhar{n}! 💚 Isso significa muito para nós.",
  "Que presente você ter compartilhado{n}! Muito obrigado 🙏",
];
const COMPARTILHOU_COM_PORTA = [
  "Muito obrigado por compartilhar{n}! 💚 Se um dia quiser saber mais ou agendar uma consulta, é só me chamar por aqui.",
];

/** Resposta de gratidão para o direct. Evita repetir a anterior. */
export function respostaGratidao(o: {
  nome?: string | null;
  compartilhou: boolean;
  semente: number;
  anterior?: string | null;
  comPorta: boolean;
}): string {
  const pool = o.compartilhou
    ? o.comPorta
      ? COMPARTILHOU_COM_PORTA
      : COMPARTILHOU
    : o.comPorta
      ? CARINHO_COM_PORTA
      : CARINHO;
  const n = primeiroNome(o.nome) ? `, ${primeiroNome(o.nome)}` : "";
  for (let i = 0; i < pool.length; i++) {
    const t = pool[(o.semente + i) % pool.length].replace("{n}", n);
    if (t !== (o.anterior ?? "")) return t;
  }
  return pool[o.semente % pool.length].replace("{n}", n);
}

const PUBLICAS = [
  "Muito obrigado pelo carinho! 💚",
  "Gratidão! Fico feliz que tenha gostado 🙏",
  "Obrigado por acompanhar o nosso trabalho! 😊",
  "Que bom ter você por aqui! Muito obrigado 💚",
];
const PUBLICAS_COMPARTILHOU = ["Muito obrigado por compartilhar! 💚", "Obrigado por levar o nosso trabalho adiante! 🙏"];

/** Resposta pública de gratidão para comentário sem pergunta ou interesse. */
export function respostaPublicaGratidao(semente: number, compartilhou = false): string {
  const pool = compartilhou ? PUBLICAS_COMPARTILHOU : PUBLICAS;
  return pool[semente % pool.length];
}

/** Comentário só com emoji, ou só marcando alguém (@amigo): é carinho ou compartilhamento. */
export function comentarioSoGesto(texto: string | null | undefined): "emoji" | "marcacao" | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  if (/https?:|www\./i.test(t)) return null;
  const semMarca = t.replace(/@\w[\w.]*/g, " ").trim();
  if (!TEM_LETRA_OU_NUMERO.test(semMarca)) {
    if (t.includes("@")) return "marcacao";
    return TEM_EMOJI.test(t) ? "emoji" : null;
  }
  return null;
}
