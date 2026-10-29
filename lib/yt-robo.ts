import { getClient } from "@/lib/db";
import { destinatariosAlerta } from "@/lib/config";
import { enviarTextoInstancia } from "@/lib/evolution";
import { comentarioSoGesto, temInteresse } from "@/lib/ig-gratidao";
import { SITE_URL } from "@/lib/site";
import { credencialYT, listarComentarios, responderComentarioYT, youtubeConfigurado, type ThreadYT } from "@/lib/youtube";

// Robô de comentários do YouTube: lê os comentários novos do canal e responde em público.
//  • elogio, emoji ou comentário sem pergunta → agradecimento curto;
//  • pergunta ou interesse → convite para marcar a consulta pelo site (link com origem "youtube") e aviso ao Anderson;
//  • spam, links e o próprio canal → ignorados.
// Regras do consultório: sem preço, sem promessa de resultado, sem diagnóstico, "consulta".
// Roda só entre 08:00 e 20:00 (Brasília). YOUTUBE_ROBO=desligado → só registra, não responde.

const LIMITE_POR_VOLTA = 10; // respostas por rodada (cada resposta custa 50 da cota diária de 10 mil)
const LIMITE_POR_DIA = 80;

const AGRADECER = [
  "Muito obrigado pelo comentário! 💚",
  "Que bom ter você por aqui! Obrigado pelo carinho 🙏",
  "Obrigado por assistir e comentar! 😊",
  "Agradeço demais pela mensagem! 💚",
];

function linkConsulta(videoId: string | null): string {
  const p = new URLSearchParams({ utm_source: "youtube", utm_medium: "comentario", utm_campaign: "resposta_comentarios", utm_content: videoId ?? "canal" });
  return `${SITE_URL}/?${p.toString()}`;
}

function convidar(nome: string | null, videoId: string | null): string {
  const primeiro = (nome ?? "").replace(/^@/, "").split(/\s+/)[0];
  const ola = primeiro && primeiro.length <= 20 ? `Olá, ${primeiro}!` : "Olá!";
  return `${ola} Obrigado pelo comentário. Para tirar dúvidas ou marcar uma consulta de fisioterapia em Florianópolis (Capoeiras ou Centro), é só escolher o horário por aqui: ${linkConsulta(videoId)} 💚`;
}

function foraDaJanela(agora = new Date()): boolean {
  const h = new Date(agora.getTime() - 3 * 3600 * 1000).getUTCHours(); // Brasília = UTC-3 fixo
  return h < 8 || h >= 20;
}

function spam(texto: string): boolean {
  return /https?:|www\.|\.com\b|\.br\b|ganhe|sorteio|seguidores|renda extra|chama no (dm|pv)|t\.me|whatsapp\.com/i.test(texto);
}

async function avisarDono(texto: string) {
  const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  if (!instancia) return;
  for (const d of destinatariosAlerta()) {
    if (d.whatsapp) await enviarTextoInstancia(instancia, d.whatsapp, texto);
  }
}

export interface ResultadoYT {
  lidos: number;
  novos: number;
  respondidos: number;
  motivo?: string;
}

export async function rodarComentariosYT(): Promise<ResultadoYT> {
  const vazio: ResultadoYT = { lidos: 0, novos: 0, respondidos: 0 };
  if (!youtubeConfigurado()) return { ...vazio, motivo: "sem chaves do Google" };
  const cred = await credencialYT();
  if (!cred) return { ...vazio, motivo: "canal não conectado" };
  if (foraDaJanela()) return { ...vazio, motivo: "fora da janela 08h-20h" };

  const sb = getClient();
  const threads: ThreadYT[] = await listarComentarios(cred, 3);

  // grava o que ainda não conhecemos
  const ids = threads.map((t) => t.id);
  const conhecidos = new Set<string>();
  if (ids.length) {
    const r = await sb.from("yt_comentarios").select("comentario_id").in("comentario_id", ids);
    for (const x of (r.data ?? []) as { comentario_id: string }[]) conhecidos.add(x.comentario_id);
  }
  const novos = threads.filter((t) => !conhecidos.has(t.id));
  if (novos.length) {
    await sb.from("yt_comentarios").insert(
      novos.map((t) => {
        const proprio = !!t.autor_id && t.autor_id === cred.canal_id;
        const status = proprio ? "proprio" : t.respostas > 0 ? "ja_respondido" : spam(t.texto) || !t.texto.trim() ? "ignorado" : "novo";
        return { comentario_id: t.id, video_id: t.video_id, autor_id: t.autor_id, autor_nome: t.autor_nome, texto: t.texto, publicado_em: t.publicado_em, respostas: t.respostas, status };
      }),
    );
  }

  if ((process.env.YOUTUBE_ROBO ?? "").trim().toLowerCase() === "desligado") return { lidos: threads.length, novos: novos.length, respondidos: 0, motivo: "robô desligado" };

  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const jaHoje = await sb.from("yt_comentarios").select("comentario_id", { count: "exact", head: true }).in("status", ["respondido", "agradecido"]).gte("respondido_em", `${hoje}T03:00:00Z`);
  let restante = Math.min(LIMITE_POR_VOLTA, LIMITE_POR_DIA - (jaHoje.count ?? 0));
  if (restante <= 0) return { lidos: threads.length, novos: novos.length, respondidos: 0, motivo: "limite diário" };

  // mais recentes primeiro; o resgate dos antigos acontece aos poucos, nas voltas seguintes
  const fila = await sb.from("yt_comentarios").select("comentario_id, video_id, autor_nome, texto").eq("status", "novo").order("publicado_em", { ascending: false }).limit(restante);
  let respondidos = 0;
  for (const c of (fila.data ?? []) as { comentario_id: string; video_id: string | null; autor_nome: string | null; texto: string }[]) {
    if (restante <= 0) break;
    const interessado = !comentarioSoGesto(c.texto) && temInteresse(c.texto);
    const texto = interessado ? convidar(c.autor_nome, c.video_id) : AGRADECER[Math.floor(Math.random() * AGRADECER.length)];
    const r = await responderComentarioYT(cred, c.comentario_id, texto);
    if (!r.ok) {
      await sb.from("yt_comentarios").update({ status: "erro", erro: (r.erro ?? "erro").slice(0, 300) }).eq("comentario_id", c.comentario_id);
      continue;
    }
    await sb.from("yt_comentarios").update({ status: interessado ? "respondido" : "agradecido", resposta_id: r.id ?? null, respondido_em: new Date().toISOString(), erro: null }).eq("comentario_id", c.comentario_id);
    respondidos++;
    restante--;
    if (interessado) {
      await avisarDono(`▶️ YouTube: ${c.autor_nome ?? "alguém"} comentou com interesse: "${c.texto.slice(0, 160)}". O robô respondeu em público com o link para marcar a consulta.`).catch(() => undefined);
    }
    await new Promise((res) => setTimeout(res, 4000 + Math.floor(Math.random() * 4000))); // ritmo humano
  }
  return { lidos: threads.length, novos: novos.length, respondidos };
}
