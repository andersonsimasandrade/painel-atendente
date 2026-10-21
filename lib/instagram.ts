import { createHmac, timingSafeEqual } from "node:crypto";

// Integração com a API do Instagram (login do Instagram).
// Variáveis de ambiente (nenhuma é obrigatória para o painel subir):
//   INSTAGRAM_APP_SECRET   chave secreta do app do Instagram (assina cada webhook; aceita várias, separadas por vírgula)
//   INSTAGRAM_VERIFY_TOKEN texto combinado com a Meta ao cadastrar o webhook
//   INSTAGRAM_ACCESS_TOKEN token da conta @andersonandrade_fisio (usado para responder)
//   INSTAGRAM_CONTA_ID     id da conta profissional (ex.: 17841477869753397)

const GRAPH = "https://graph.instagram.com/v26.0";

export type TipoEvento = "mensagem" | "comentario" | "eco";

export interface EventoIG {
  tipo: TipoEvento;
  ig_conta: string;
  remetente_id: string;
  remetente_user: string | null;
  mid: string | null;
  comentario_id: string | null;
  midia_id: string | null;
  texto: string | null;
  quando: number | null;
  /** Tipos de anexo da mensagem (image, video, audio, share, story_mention, like_heart...). Vazio se for só texto. */
  anexos: string[];
  /** A mensagem é resposta a um story (ou menção em story). */
  resposta_story: boolean;
}

/** Confere a assinatura "sha256=..." que a Meta manda no cabeçalho X-Hub-Signature-256. */
export function assinaturaValida(corpo: string, cabecalho: string | null): boolean {
  const segredos = (process.env.INSTAGRAM_APP_SECRET ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 16);
  if (!segredos.length || !cabecalho?.startsWith("sha256=")) return false;
  const recebido = Buffer.from(cabecalho.slice(7), "hex");
  for (const s of segredos) {
    const calculado = createHmac("sha256", s).update(corpo, "utf8").digest();
    if (recebido.length === calculado.length && timingSafeEqual(new Uint8Array(recebido), new Uint8Array(calculado))) {
      return true;
    }
  }
  return false;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Transforma o corpo do webhook em uma lista simples de eventos (mensagens, ecos e comentários). */
export function extrairEventos(corpo: unknown): EventoIG[] {
  const out: EventoIG[] = [];
  const raiz = obj(corpo);
  if (raiz.object !== "instagram" || !Array.isArray(raiz.entry)) return out;
  for (const e of raiz.entry) {
    const entrada = obj(e);
    const conta = String(entrada.id ?? "");
    // Mensagens diretas
    if (Array.isArray(entrada.messaging)) {
      for (const m of entrada.messaging) {
        const ev = obj(m);
        const msg = obj(ev.message);
        if (!msg.mid) continue; // leituras, reações etc. não interessam por enquanto
        const eco = msg.is_echo === true;
        const anexos = (Array.isArray(msg.attachments) ? msg.attachments : [])
          .map((a) => String(obj(a).type ?? "").toLowerCase())
          .filter(Boolean);
        const story = !!obj(msg.reply_to).story || anexos.includes("story_mention");
        const de = String(obj(ev.sender).id ?? "");
        const para = String(obj(ev.recipient).id ?? "");
        out.push({
          tipo: eco ? "eco" : "mensagem",
          ig_conta: conta,
          // No eco, quem manda é a própria conta; o paciente é o destinatário.
          remetente_id: eco ? para : de,
          remetente_user: null,
          mid: String(msg.mid),
          comentario_id: null,
          midia_id: null,
          texto: txt(msg.text),
          quando: typeof ev.timestamp === "number" ? ev.timestamp : null,
          anexos,
          resposta_story: story,
        });
      }
    }
    // Comentários em posts
    if (Array.isArray(entrada.changes)) {
      for (const c of entrada.changes) {
        const ch = obj(c);
        if (ch.field !== "comments") continue;
        const v = obj(ch.value);
        const de = obj(v.from);
        const cid = txt(v.id);
        if (!cid) continue;
        // Comentários escritos pela própria conta (respostas do robô) não geram novo atendimento.
        if (String(de.id ?? "") === conta) continue;
        out.push({
          tipo: "comentario",
          ig_conta: conta,
          remetente_id: String(de.id ?? ""),
          remetente_user: txt(de.username),
          mid: null,
          comentario_id: cid,
          midia_id: txt(obj(v.media).id),
          texto: txt(v.text),
          quando: null,
          anexos: [],
          resposta_story: false,
        });
      }
    }
  }
  return out;
}

export interface ResultadoIG {
  ok: boolean;
  status: number;
  erro?: string;
  /** id da mensagem enviada (message_id) ou do comentário criado (id). */
  id?: string;
}

async function chamar(caminho: string, corpo: unknown): Promise<ResultadoIG> {
  const token = (process.env.INSTAGRAM_ACCESS_TOKEN ?? "").trim();
  if (!token) return { ok: false, status: 0, erro: "INSTAGRAM_ACCESS_TOKEN ausente" };
  try {
    const r = await fetch(`${GRAPH}${caminho}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      let id: string | undefined;
      try {
        const j = (await r.json()) as { message_id?: string; id?: string };
        id = j.message_id ?? j.id;
      } catch {
        /* sem corpo */
      }
      return { ok: true, status: r.status, id };
    }
    return { ok: false, status: r.status, erro: (await r.text()).slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, erro: e instanceof Error ? e.message : "falha de rede" };
  }
}

const conta = () => (process.env.INSTAGRAM_CONTA_ID ?? "me").trim() || "me";

/** Responde no direct (janela de 24 h depois da última mensagem da pessoa). */
export function enviarDM(destinatarioId: string, texto: string) {
  return chamar(`/${conta()}/messages`, { recipient: { id: destinatarioId }, message: { text: texto.slice(0, 1000) } });
}

/** Mensagem privada para quem comentou (uma por comentário, em até 7 dias). */
export function respostaPrivada(comentarioId: string, texto: string) {
  return chamar(`/${conta()}/messages`, { recipient: { comment_id: comentarioId }, message: { text: texto.slice(0, 1000) } });
}

/** Resposta pública a um comentário. */
export function responderComentario(comentarioId: string, texto: string) {
  return chamar(`/${comentarioId}/replies`, { message: texto.slice(0, 2000) });
}

/** Nome e @ de quem escreveu (só funciona depois que a pessoa mandou mensagem). */
export async function perfilDe(igId: string): Promise<{ nome: string | null; username: string | null }> {
  const token = (process.env.INSTAGRAM_ACCESS_TOKEN ?? "").trim();
  if (!token) return { nome: null, username: null };
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(igId)}?fields=name,username`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { nome: null, username: null };
    const j = (await r.json()) as { name?: string; username?: string };
    return { nome: j.name ?? null, username: j.username ?? null };
  } catch {
    return { nome: null, username: null };
  }
}
