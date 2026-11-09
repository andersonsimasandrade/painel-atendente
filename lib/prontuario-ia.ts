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

/** Lê um PDF: devolve o texto e os links (anotações clicáveis e endereços escritos no texto). */
export async function lerPdf(buf: Buffer): Promise<{ texto: string; links: string[] }> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const texto = (Array.isArray(text) ? text.join("\n") : text).replace(/[ \t]+\n/g, "\n").trim();
  const achados = new Set<string>();
  const limpar = (u: string) => u.replace(/[)\].,;:'"]+$/, "");
  for (const m of texto.matchAll(/https?:\/\/[^\s<>"']+/gi)) achados.add(limpar(m[0]));
  try {
    const paginas = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= paginas; i++) {
      const pagina = await pdf.getPage(i);
      for (const a of (await pagina.getAnnotations()) as { url?: string; unsafeUrl?: string }[]) {
        const u = a.url || a.unsafeUrl;
        if (u && /^https?:\/\//i.test(u)) achados.add(limpar(u));
      }
    }
  } catch {
    /* sem anotações: ficam só os links do texto */
  }
  return { texto, links: [...achados].slice(0, 5) };
}

const SISTEMA_RESUMO =
  "Você ajuda um fisioterapeuta a ler documentos de exames de imagem. Se o documento for um LAUDO (texto do médico descrevendo achados), resuma em português, em tópicos curtos " +
  "(no máximo 8 linhas começando com '• '), citando regiões/níveis e achados exatamente como o laudo descreve. " +
  "Se for apenas uma CAPA, guia, protocolo ou página de acesso (sem os achados do exame), marque e_laudo=false e descreva em uma linha o que o documento é (ex.: tipo de exame e data). " +
  "Regras: não dê diagnóstico, não indique tratamento, não faça prognóstico, não invente nada que não esteja no documento, não inclua nome, CPF ou dados pessoais. " +
  'Responda só JSON: {"e_laudo": true|false, "resumo": "..."}.';

interface RespostaResumo {
  e_laudo?: boolean;
  resumo?: string;
}

async function resumirComVisao(dataUri: string): Promise<RespostaResumo | null> {
  const mensagens = [
    { role: "system", content: SISTEMA_RESUMO },
    { role: "user", content: [{ type: "text", text: "Resuma este exame." }, { type: "image_url", image_url: { url: dataUri } }] },
  ];
  const tentativas: { url: string; key: string; model: string }[] = [];
  const groq = (process.env.GROQ_API_KEY ?? "").trim();
  if (groq) tentativas.push({ url: "https://api.groq.com/openai/v1/chat/completions", key: groq, model: (process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct").trim() });
  const oai = (process.env.OPENAI_API_KEY ?? "").trim();
  if (oai) tentativas.push({ url: "https://api.openai.com/v1/chat/completions", key: oai, model: (process.env.PRONTUARIO_MODEL ?? "gpt-4.1-mini").trim() });
  for (const t of tentativas) {
    try {
      const res = await fetch(t.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: t.model, temperature: 0.1, max_tokens: 700, response_format: { type: "json_object" }, messages: mensagens }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as RespostaResumo;
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

/**
 * RASCUNHO de resumo a partir do ARQUIVO do exame. PDF: lê o texto (e acha o link de acesso ao exame, comum nas capas dos laboratórios);
 * imagem ou PDF sem texto: leitura por IA com visão. Só resume o que está escrito no documento; o Anderson revisa antes de usar.
 * Os dados saem do painel para o provedor de IA (Groq/OpenAI) somente quando o Anderson clica.
 */
export async function resumirArquivoExame(telefone: string, id: string): Promise<R<{ resumo: string | null; aviso: string | null }>> {
  const sb = getClient();
  const r = await sb.from("paciente_exames").select("arquivo_path, arquivo_mime, arquivo_nome, link_url").eq("id", id).in("telefone", variantesTelefone(telefone)).limit(1);
  const row = r.data?.[0] as { arquivo_path?: string | null; arquivo_mime?: string | null; arquivo_nome?: string | null; link_url?: string | null } | undefined;
  if (!row?.arquivo_path) return { ok: false, error: "Este exame não tem arquivo guardado." };
  const dl = await sb.storage.from(BUCKET).download(row.arquivo_path);
  if (dl.error || !dl.data) return { ok: false, error: "Não consegui abrir o arquivo guardado." };
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const mime = row.arquivo_mime || "application/pdf";

  let resposta: RespostaResumo | null = null;
  let aviso: string | null = null;

  if (mime === "application/pdf") {
    let pdf: { texto: string; links: string[] } = { texto: "", links: [] };
    try {
      pdf = await lerPdf(buf);
    } catch (e) {
      console.error("[prontuario] ler pdf:", e instanceof Error ? e.message : e);
    }
    // o link de acesso ao exame (capa do laboratório) vai para o campo "link do exame"
    if (pdf.links.length && !row.link_url) {
      await sb.from("paciente_exames").update({ link_url: pdf.links[0] }).eq("id", id);
      aviso = "Achei o link de acesso ao exame dentro do PDF e coloquei no botão “Abrir link do exame”.";
    }
    if (pdf.texto.length >= 120) {
      resposta = await perguntarJSON<RespostaResumo>(SISTEMA_RESUMO, `DOCUMENTO:\n${pdf.texto.slice(0, 12000)}`, 700);
    } else if (buf.length <= 12 * 1024 * 1024) {
      resposta = await resumirComVisao(`data:application/pdf;base64,${buf.toString("base64")}`);
    }
  } else {
    if (buf.length > 3 * 1024 * 1024) return { ok: false, error: "A imagem é grande demais para a leitura por IA (limite de 3 MB). Cole o texto do laudo." };
    resposta = await resumirComVisao(`data:${mime};base64,${buf.toString("base64")}`);
  }

  const resumo = resposta?.resumo?.trim() || null;
  if (resposta && resposta.e_laudo === false) {
    return { ok: true, resumo: null, aviso: `${aviso ? `${aviso} ` : ""}Este arquivo parece ser só uma capa/guia, sem os achados do exame${resumo ? ` (${resumo})` : ""}. Abra o link do exame para ler o laudo e cole o texto aqui.` };
  }
  if (!resumo) {
    return aviso ? { ok: true, resumo: null, aviso } : { ok: false, error: "Não consegui ler o arquivo agora. Cole o texto do laudo para resumir." };
  }
  const up = await sb.from("paciente_exames").update({ resumo: resumo.slice(0, 4000), resumo_por_ia: true }).eq("id", id);
  if (up.error) return { ok: false, error: up.error.message };
  return { ok: true, resumo, aviso };
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
