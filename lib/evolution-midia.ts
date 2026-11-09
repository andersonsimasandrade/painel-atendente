// ANEXOS DA CONVERSA: lista os documentos e imagens que o paciente enviou pelo WhatsApp e baixa o arquivo (via Evolution API),
// para guardar no prontuário com um clique. Só no servidor (usa EVOLUTION_API_KEY). Server-only.
import { getClient } from "./db";
import { soDigitos, variantesTelefone } from "./telefone";

export interface MidiaRecebida {
  id: string; // id da mensagem no WhatsApp
  tipo: "documento" | "imagem";
  nome: string | null;
  mime: string | null;
  legenda: string | null;
  quando: string | null; // ISO
}

type Json = Record<string, unknown>;
type R<T> = { ok: true } & T | { ok: false; error: string };

function env() {
  const base = (process.env.EVOLUTION_API_URL ?? "").replace(/\/+$/, "");
  const apikey = process.env.EVOLUTION_API_KEY ?? "";
  return { base, apikey, instanciaPadrao: (process.env.EVOLUTION_INSTANCE ?? "").trim() };
}

async function instanciaDoContato(telefone: string): Promise<string> {
  const r = await getClient().from("ff_contatos").select("ultima_instancia").in("telefone", variantesTelefone(telefone)).limit(1);
  const i = (r.data?.[0] as { ultima_instancia?: string | null } | undefined)?.ultima_instancia?.trim();
  return i || env().instanciaPadrao;
}

async function evo(path: string, corpo: Json, timeoutMs = 25000): Promise<{ status: number; json: unknown }> {
  const { base, apikey } = env();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { apikey, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* sem corpo */
  }
  return { status: res.status, json };
}

function registros(j: unknown): Json[] {
  const o = j as { messages?: { records?: Json[] } | Json[]; records?: Json[] } | Json[] | null;
  if (Array.isArray(o)) return o;
  const m = o?.messages;
  if (Array.isArray(m)) return m;
  return (m && Array.isArray((m as { records?: Json[] }).records) ? (m as { records: Json[] }).records : o?.records) ?? [];
}

function paraMidia(r: Json): MidiaRecebida | null {
  const key = (r.key ?? {}) as Json;
  if (key.fromMe === true || !key.id) return null; // exame vem do paciente
  const msg = (r.message ?? {}) as Json;
  const docMsg = (msg.documentMessage ??
    ((msg.documentWithCaptionMessage as Json | undefined)?.message as Json | undefined)?.documentMessage) as Json | undefined;
  const img = msg.imageMessage as Json | undefined;
  const ts = Number(r.messageTimestamp);
  const quando = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : null;
  if (docMsg) {
    return {
      id: String(key.id),
      tipo: "documento",
      nome: typeof docMsg.fileName === "string" ? docMsg.fileName : typeof docMsg.title === "string" ? docMsg.title : null,
      mime: typeof docMsg.mimetype === "string" ? docMsg.mimetype : null,
      legenda: typeof docMsg.caption === "string" && docMsg.caption.trim() ? docMsg.caption.trim() : null,
      quando,
    };
  }
  if (img) {
    return {
      id: String(key.id),
      tipo: "imagem",
      nome: null,
      mime: typeof img.mimetype === "string" ? img.mimetype : "image/jpeg",
      legenda: typeof img.caption === "string" && img.caption.trim() ? img.caption.trim() : null,
      quando,
    };
  }
  return null;
}

/** Documentos e imagens que ESTE paciente enviou (mais recentes primeiro). */
export async function listarMidiasRecebidas(telefone: string): Promise<R<{ itens: MidiaRecebida[] }>> {
  const { base, apikey } = env();
  if (!base || !apikey) return { ok: false, error: "Evolution não configurada no painel." };
  const instancia = await instanciaDoContato(telefone);
  if (!instancia) return { ok: false, error: "Instância do WhatsApp não encontrada." };

  const variantes = variantesTelefone(telefone);
  const fim8 = soDigitos(telefone).slice(-8);
  const achados = new Map<string, MidiaRecebida>();
  let algumaRespostaOk = false;
  let ultimoErro = "";

  // 1) pelo número do paciente (com e sem o 9)
  for (const v of variantes) {
    try {
      const r = await evo(`/chat/findMessages/${encodeURIComponent(instancia)}`, { where: { key: { remoteJid: `${v}@s.whatsapp.net` } }, page: 1, offset: 200 });
      if (r.status >= 200 && r.status < 300) {
        algumaRespostaOk = true;
        for (const rec of registros(r.json)) {
          const m = paraMidia(rec);
          if (m) achados.set(m.id, { ...m, quando: m.quando });
        }
      } else ultimoErro = `Evolution ${r.status}`;
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : "falha de rede";
    }
  }

  // 2) contatos que o WhatsApp entrega como LID: procura nos anexos recentes pelo número escondido na mensagem
  if (!achados.size) {
    for (const tipo of ["documentMessage", "imageMessage"]) {
      try {
        const r = await evo(`/chat/findMessages/${encodeURIComponent(instancia)}`, { where: { messageType: tipo }, page: 1, offset: 100 });
        if (r.status >= 200 && r.status < 300) {
          algumaRespostaOk = true;
          for (const rec of registros(r.json)) {
            const key = (rec.key ?? {}) as Json;
            const donos = [key.remoteJid, key.remoteJidAlt, key.senderPn, key.participant, key.participantAlt].map((x) => soDigitos(String(x ?? "")));
            if (!donos.some((d) => d.length >= 8 && d.endsWith(fim8))) continue;
            const m = paraMidia(rec);
            if (m) achados.set(m.id, m);
          }
        }
      } catch {
        /* segue */
      }
    }
  }

  if (!algumaRespostaOk) return { ok: false, error: `Não consegui consultar o WhatsApp agora${ultimoErro ? ` (${ultimoErro})` : ""}.` };
  const itens = [...achados.values()].sort((a, b) => (b.quando ?? "").localeCompare(a.quando ?? ""));
  return { ok: true, itens };
}

/** Baixa o arquivo de uma mensagem (base64 → Buffer). */
export async function baixarMidia(telefone: string, msgId: string): Promise<R<{ buffer: Buffer; mime: string; nome: string | null }>> {
  const { base, apikey } = env();
  if (!base || !apikey) return { ok: false, error: "Evolution não configurada no painel." };
  const instancia = await instanciaDoContato(telefone);
  try {
    const r = await evo(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, { message: { key: { id: msgId } }, convertToMp4: false }, 60000);
    const j = (r.json ?? {}) as Json;
    let b64 = typeof j.base64 === "string" ? j.base64 : "";
    if (r.status >= 300 || !b64) return { ok: false, error: `O WhatsApp não entregou o arquivo (${r.status}). Peça ao paciente para reenviar ou salve o link.` };
    const i = b64.indexOf("base64,");
    if (i >= 0) b64 = b64.slice(i + 7);
    return {
      ok: true,
      buffer: Buffer.from(b64, "base64"),
      mime: typeof j.mimetype === "string" ? j.mimetype.split(";")[0] : "application/octet-stream",
      nome: typeof j.fileName === "string" ? j.fileName : null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao baixar o arquivo." };
  }
}
