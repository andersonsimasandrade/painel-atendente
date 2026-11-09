// IA do PRONTUÁRIO: resumo do arquivo do exame (PDF/imagem), transcrição da sessão gravada e rascunho da evolução.
// Tudo é RASCUNHO: o fisioterapeuta revisa e assina. Nada é guardado sem o clique dele. Server-only.
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { perguntarJSON } from "./llm";
import type { TipoExame } from "./prontuario-tipos";

const BUCKET = "prontuario";
type R<T> = ({ ok: true } & T) | { ok: false; error: string };

const dor = (v: unknown): number | null => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
};

/** Palpite do tipo de exame pelo nome do arquivo (o Anderson corrige se precisar). */
export function tipoPeloNome(nome: string | null): TipoExame {
  const n = (nome ?? "").toLowerCase();
  if (/resson|\bmri\b|\brm\b/.test(n)) return "ressonancia";
  if (/raio|\brx\b|radiograf/.test(n)) return "raio_x";
  if (/ultra|\busg\b/.test(n)) return "ultrassom";
  if (/tomog|\btc\b/.test(n)) return "tomografia";
  if (/laudo|relat/.test(n)) return "laudo";
  return "outro";
}

/** Ids das mensagens do WhatsApp cujo anexo já foi salvo no prontuário. */
export async function anexosJaSalvos(telefone: string): Promise<Set<string>> {
  const r = await getClient().from("paciente_exames").select("origem_msg_id").in("telefone", variantesTelefone(telefone)).not("origem_msg_id", "is", null);
  return new Set(((r.data ?? []) as { origem_msg_id: string }[]).map((x) => x.origem_msg_id));
}

/**
 * RASCUNHO de resumo a partir do ARQUIVO do exame (PDF ou imagem do laudo), lido por IA com visão (OpenAI).
 * Só resume o que está escrito no documento. Os dados saem do painel para a OpenAI: só roda quando o Anderson clica.
 */
export async function resumirArquivoExame(telefone: string, id: string): Promise<R<{ resumo: string }>> {
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) return { ok: false, error: "A leitura de arquivos por IA não está ligada (falta a chave da OpenAI no painel). Cole o texto do laudo para resumir." };
  const sb = getClient();
  const r = await sb.from("paciente_exames").select("arquivo_path, arquivo_mime, arquivo_nome").eq("id", id).in("telefone", variantesTelefone(telefone)).limit(1);
  const row = r.data?.[0] as { arquivo_path?: string | null; arquivo_mime?: string | null; arquivo_nome?: string | null } | undefined;
  if (!row?.arquivo_path) return { ok: false, error: "Este exame não tem arquivo guardado." };
  const dl = await sb.storage.from(BUCKET).download(row.arquivo_path);
  if (dl.error || !dl.data) return { ok: false, error: "Não consegui abrir o arquivo guardado." };
  const buf = Buffer.from(await dl.data.arrayBuffer());
  if (buf.length > 12 * 1024 * 1024) return { ok: false, error: "O arquivo é grande demais para a leitura por IA (limite de 12 MB). Cole o texto do laudo." };
  const mime = row.arquivo_mime || "application/pdf";
  const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
  const parte =
    mime === "application/pdf"
      ? { type: "file", file: { filename: (row.arquivo_nome || "exame.pdf").slice(0, 80), file_data: dataUri } }
      : { type: "image_url", image_url: { url: dataUri } };
  const sistema =
    "Você ajuda um fisioterapeuta a ler laudos de exames de imagem. Resuma o documento em português, em tópicos curtos (no máximo 8 linhas começando com '• '), " +
    "citando regiões/níveis e achados exatamente como o laudo descreve. Regras: não dê diagnóstico, não indique tratamento, não faça prognóstico, não invente nada que não esteja no documento, " +
    "não inclua nome, CPF ou dados pessoais. Se o documento não for um laudo legível, diga isso em uma linha. Responda só JSON: {\"resumo\": \"...\"}.";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: (process.env.PRONTUARIO_MODEL ?? "gpt-4.1-mini").trim(),
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: [{ type: "text", text: "Resuma este exame." }, parte] },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return { ok: false, error: `A IA não conseguiu ler o arquivo agora (${res.status}). Cole o texto do laudo.` };
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const resumo = (JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as { resumo?: string }).resumo?.trim();
    if (!resumo) return { ok: false, error: "A IA não devolveu resumo. Cole o texto do laudo." };
    const up = await sb.from("paciente_exames").update({ resumo: resumo.slice(0, 4000), resumo_por_ia: true }).eq("id", id);
    if (up.error) return { ok: false, error: up.error.message };
    return { ok: true, resumo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao resumir o arquivo." };
  }
}

// ── Gravação da sessão: áudio → texto → RASCUNHO da evolução ───────────────

export interface RascunhoEvolucao {
  queixa: string | null;
  achados: string | null;
  conduta: string | null;
  plano: string | null;
  dor_inicio: number | null;
  dor_fim: number | null;
}

/** Transcreve o áudio da sessão (Groq Whisper). O áudio NÃO é guardado em lugar nenhum. */
export async function transcreverSessao(buffer: Buffer, mime: string): Promise<R<{ texto: string }>> {
  const key = (process.env.GROQ_API_KEY ?? "").trim();
  if (!key) return { ok: false, error: "A transcrição não está ligada (falta a chave GROQ_API_KEY no painel)." };
  if (buffer.length < 2000) return { ok: false, error: "A gravação ficou vazia." };
  if (buffer.length > 24 * 1024 * 1024) return { ok: false, error: "A gravação passou de 24 MB (cerca de 1h30). Grave em duas partes." };
  const ext = mime.includes("mp4") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
  const f = new FormData();
  f.set("file", new Blob([new Uint8Array(buffer)], { type: mime || "audio/webm" }), `sessao.${ext}`);
  f.set("model", (process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo").trim());
  f.set("language", "pt");
  f.set("response_format", "json");
  f.set("temperature", "0");
  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: f,
      signal: AbortSignal.timeout(170000),
    });
    if (!res.ok) {
      const t = (await res.text().catch(() => "")).slice(0, 160);
      return { ok: false, error: `A transcrição falhou (${res.status}). ${t}` };
    }
    const j = (await res.json()) as { text?: string };
    const texto = (j.text ?? "").trim();
    return texto.length >= 20 ? { ok: true, texto } : { ok: false, error: "Não consegui entender a fala da gravação." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha na transcrição." };
  }
}

/** Monta o RASCUNHO dos campos da evolução a partir da transcrição (só o que foi dito; o Anderson revisa). */
export async function rascunhoDaSessao(transcricao: string): Promise<RascunhoEvolucao | null> {
  const t = transcricao.length > 26000 ? `${transcricao.slice(0, 14000)}\n[...]\n${transcricao.slice(-11000)}` : transcricao;
  const sistema =
    "Você ajuda um fisioterapeuta a registrar o prontuário. Abaixo está a transcrição automática de uma sessão (fisioterapeuta e paciente conversam; não há identificação de quem fala e pode haver erros de reconhecimento). " +
    "Preencha os campos SOMENTE com o que foi dito, em português, em frases curtas e objetivas, sem inventar. " +
    "queixa = relato do paciente (dor, local, desde quando, o que piora/melhora); achados = o que o fisioterapeuta observou/testou; conduta = manobras e técnicas realizadas; plano = orientações, exercícios para casa e retorno combinado. " +
    "dor_inicio e dor_fim = nota de dor de 0 a 10 no início e no fim da sessão, somente se o paciente disse o número; senão null. Campo sem informação = null. Não inclua nomes nem dados pessoais. " +
    'Responda só JSON: {"queixa":...,"achados":...,"conduta":...,"plano":...,"dor_inicio":...,"dor_fim":...}.';
  const r = await perguntarJSON<Record<string, unknown>>(sistema, `TRANSCRIÇÃO:\n${t}`, 1100);
  if (!r) return null;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : null);
  return { queixa: s(r.queixa), achados: s(r.achados), conduta: s(r.conduta), plano: s(r.plano), dor_inicio: dor(r.dor_inicio), dor_fim: dor(r.dor_fim) };
}
