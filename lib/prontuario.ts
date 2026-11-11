// PRONTUÁRIO do paciente: exames (link e/ou arquivo + resumo do laudo) e evolução por sessão.
// Dados de saúde (LGPD): as tabelas só abrem para o servidor (service role) e os arquivos ficam em bucket privado,
// entregues por link assinado de curta duração. Server-only.
import { randomUUID } from "node:crypto";
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { perguntarJSON } from "./llm";
import { LIMITE_ARQUIVO_MB, MIMES_EXAME, type Evolucao, type Exame, type TipoExame } from "./prontuario-tipos";

const BUCKET = "prontuario";
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const txt = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
const dor = (v: unknown): number | null => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
};
const dataIso = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

async function telefoneReal(telefone: string): Promise<string | null> {
  const r = await getClient().from("ff_contatos").select("telefone").in("telefone", variantesTelefone(telefone)).limit(1);
  return (r.data?.[0] as { telefone?: string } | undefined)?.telefone ?? null;
}

function paraExame(r: Record<string, unknown>): Exame {
  return {
    id: String(r.id),
    titulo: String(r.titulo),
    tipo: (r.tipo as TipoExame) ?? "outro",
    data_exame: (r.data_exame as string | null) ?? null,
    link_url: (r.link_url as string | null) ?? null,
    tem_arquivo: !!r.arquivo_path,
    arquivo_nome: (r.arquivo_nome as string | null) ?? null,
    arquivo_mime: (r.arquivo_mime as string | null) ?? null,
    laudo_texto: (r.laudo_texto as string | null) ?? null,
    resumo: (r.resumo as string | null) ?? null,
    resumo_por_ia: r.resumo_por_ia === true,
    criado_em: String(r.criado_em),
  };
}

function paraEvolucao(r: Record<string, unknown>): Evolucao {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: String(r.id),
    agendamento_id: (r.agendamento_id as string | null) ?? null,
    data_sessao: String(r.data_sessao),
    queixa: (r.queixa as string | null) ?? null,
    achados: (r.achados as string | null) ?? null,
    conduta: (r.conduta as string | null) ?? null,
    plano: (r.plano as string | null) ?? null,
    observacoes: (r.observacoes as string | null) ?? null,
    dor_inicio: n(r.dor_inicio),
    dor_fim: n(r.dor_fim),
    criado_em: String(r.criado_em),
  };
}

export async function listarProntuario(telefone: string): Promise<{ exames: Exame[]; evolucoes: Evolucao[] }> {
  const sb = getClient();
  const v = variantesTelefone(telefone);
  const [e, ev] = await Promise.all([
    sb.from("paciente_exames").select("*").in("telefone", v).order("criado_em", { ascending: false }).limit(100),
    sb.from("paciente_evolucao").select("*").in("telefone", v).order("data_sessao", { ascending: false }).order("criado_em", { ascending: false }).limit(200),
  ]);
  return {
    exames: ((e.data ?? []) as Record<string, unknown>[]).map(paraExame),
    evolucoes: ((ev.data ?? []) as Record<string, unknown>[]).map(paraEvolucao),
  };
}

export interface DadosExame {
  titulo?: unknown;
  tipo?: unknown;
  data_exame?: unknown;
  link_url?: unknown;
  laudo_texto?: unknown;
  resumo?: unknown;
  resumo_por_ia?: unknown;
  origem_msg_id?: unknown; // id da mensagem do WhatsApp de onde o arquivo veio (evita salvar duas vezes)
}

/** Guarda um exame. `arquivo` (PDF/imagem) vai para o bucket privado; o link do exame pode vir junto ou sozinho. */
export async function salvarExame(
  telefone: string,
  d: DadosExame,
  arquivo?: { buffer: Buffer; nome: string; mime: string },
): Promise<R<{ id: string }>> {
  const tel = await telefoneReal(telefone);
  if (!tel) return { ok: false, error: "Paciente não encontrado." };
  const titulo = txt(d.titulo, 140);
  if (!titulo) return { ok: false, error: "Dê um nome ao exame (ex.: Ressonância da coluna cervical)." };
  const link = txt(d.link_url, 1000);
  if (link && !/^https?:\/\//i.test(link)) return { ok: false, error: "O link do exame deve começar com http:// ou https://." };
  const tipos: TipoExame[] = ["ressonancia", "raio_x", "ultrassom", "tomografia", "laudo", "outro"];
  const tipo = tipos.includes(d.tipo as TipoExame) ? (d.tipo as TipoExame) : "outro";

  let arquivoPath: string | null = null;
  let arquivoNome: string | null = null;
  let arquivoMime: string | null = null;
  if (arquivo) {
    if (!MIMES_EXAME.includes(arquivo.mime)) return { ok: false, error: "Envie PDF, JPG, PNG ou WEBP." };
    if (arquivo.buffer.length > LIMITE_ARQUIVO_MB * 1024 * 1024) return { ok: false, error: `O arquivo passa de ${LIMITE_ARQUIVO_MB} MB.` };
    const seguro = arquivo.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "exame";
    arquivoPath = `${tel}/${randomUUID()}-${seguro}`;
    const up = await getClient().storage.from(BUCKET).upload(arquivoPath, arquivo.buffer, { contentType: arquivo.mime, upsert: false });
    if (up.error) return { ok: false, error: `Não consegui guardar o arquivo: ${up.error.message}` };
    arquivoNome = arquivo.nome.slice(0, 160);
    arquivoMime = arquivo.mime;
  }
  if (!link && !arquivoPath && !txt(d.laudo_texto, 20000)) {
    return { ok: false, error: "Informe o link do exame, envie o arquivo ou cole o texto do laudo." };
  }

  const ins = await getClient()
    .from("paciente_exames")
    .insert({
      telefone: tel,
      titulo,
      tipo,
      data_exame: dataIso(d.data_exame),
      link_url: link,
      arquivo_path: arquivoPath,
      arquivo_nome: arquivoNome,
      arquivo_mime: arquivoMime,
      laudo_texto: txt(d.laudo_texto, 20000),
      resumo: txt(d.resumo, 4000),
      resumo_por_ia: d.resumo_por_ia === true,
      origem_msg_id: txt(d.origem_msg_id, 200),
    })
    .select("id");
  if (ins.error) {
    if (arquivoPath) await getClient().storage.from(BUCKET).remove([arquivoPath]).catch(() => undefined);
    if (/duplicate key|unique/i.test(ins.error.message)) return { ok: false, error: "Este anexo já foi salvo no prontuário." };
    return { ok: false, error: ins.error.message };
  }
  return { ok: true, id: String((ins.data?.[0] as { id: string }).id) };
}

/** Atualiza só o resumo (edição manual depois do rascunho da IA). */
export async function atualizarResumo(telefone: string, id: string, resumo: string): Promise<R> {
  const r = await getClient()
    .from("paciente_exames")
    .update({ resumo: txt(resumo, 4000), resumo_por_ia: false })
    .eq("id", id)
    .in("telefone", variantesTelefone(telefone))
    .select("id");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Exame não encontrado." };
}

/** Link assinado (2 min) para abrir o arquivo do exame. */
export async function linkDoArquivo(telefone: string, id: string): Promise<string | null> {
  const r = await getClient().from("paciente_exames").select("arquivo_path").eq("id", id).in("telefone", variantesTelefone(telefone)).limit(1);
  const path = (r.data?.[0] as { arquivo_path?: string | null } | undefined)?.arquivo_path;
  if (!path) return null;
  const s = await getClient().storage.from(BUCKET).createSignedUrl(path, 120);
  return s.data?.signedUrl ?? null;
}

export async function excluirExame(telefone: string, id: string): Promise<R> {
  const sb = getClient();
  const r = await sb.from("paciente_exames").select("arquivo_path").eq("id", id).in("telefone", variantesTelefone(telefone)).limit(1);
  const row = r.data?.[0] as { arquivo_path?: string | null } | undefined;
  if (!row) return { ok: false, error: "Exame não encontrado." };
  const d = await sb.from("paciente_exames").delete().eq("id", id);
  if (d.error) return { ok: false, error: d.error.message };
  if (row.arquivo_path) await sb.storage.from(BUCKET).remove([row.arquivo_path]).catch(() => undefined);
  return { ok: true };
}

export async function salvarEvolucao(
  telefone: string,
  d: Record<string, unknown>,
): Promise<R<{ id: string }>> {
  const tel = await telefoneReal(telefone);
  if (!tel) return { ok: false, error: "Paciente não encontrado." };
  const linha = {
    telefone: tel,
    agendamento_id: typeof d.agendamento_id === "string" && d.agendamento_id ? d.agendamento_id : null,
    data_sessao: dataIso(d.data_sessao) ?? undefined,
    queixa: txt(d.queixa, 4000),
    achados: txt(d.achados, 4000),
    conduta: txt(d.conduta, 4000),
    plano: txt(d.plano, 4000),
    observacoes: txt(d.observacoes, 4000),
    dor_inicio: dor(d.dor_inicio),
    dor_fim: dor(d.dor_fim),
    gravacao_autorizada: d.gravacao_autorizada === true,
    rascunho_ia: d.rascunho_ia === true,
  };
  if (!linha.queixa && !linha.achados && !linha.conduta && !linha.plano && !linha.observacoes) {
    return { ok: false, error: "Escreva ao menos um campo da evolução." };
  }
  const ins = await getClient().from("paciente_evolucao").insert(linha).select("id");
  if (ins.error) return { ok: false, error: ins.error.message };
  return { ok: true, id: String((ins.data?.[0] as { id: string }).id) };
}

export async function excluirEvolucao(telefone: string, id: string): Promise<R> {
  const r = await getClient().from("paciente_evolucao").delete().eq("id", id).in("telefone", variantesTelefone(telefone)).select("id");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Registro não encontrado." };
}

/**
 * RASCUNHO de resumo do laudo (a IA só resume o que o laudo descreve; o Anderson revisa antes de usar).
 * Sem diagnóstico, sem conduta, sem inventar. Devolve null se não houver modelo disponível.
 */
export async function resumirLaudo(texto: string): Promise<string | null> {
  const base = texto.trim().slice(0, 12000);
  if (base.length < 30) return null;
  const sistema =
    "Você ajuda um fisioterapeuta a ler laudos de exames de imagem. Resuma o laudo em português, em tópicos curtos (no máximo 8 linhas começando com '• '), " +
    "citando regiões/níveis e achados exatamente como o laudo descreve (ex.: retificação, protrusão, compressão, estenose, degeneração). " +
    "Regras: não dê diagnóstico, não indique tratamento, não faça prognóstico, não invente nada que não esteja no texto, não inclua nome, CPF ou dados pessoais. " +
    "Se houver 'impressão diagnóstica' do médico, resuma como 'O laudo descreve: ...'. Responda só JSON: {\"resumo\": \"...\"}.";
  const r = await perguntarJSON<{ resumo?: string }>(sistema, `LAUDO:\n${base}`, 700);
  const s = r?.resumo?.trim();
  return s ? s.slice(0, 4000) : null;
}

/**
 * Anotação da sessão → evolução: acrescenta o texto ao campo "observações" da evolução dessa sessão
 * (a da consulta ligada, ou a do mesmo dia). Se ainda não existe evolução, cria uma.
 */
export async function registrarObservacaoNaEvolucao(
  telefone: string,
  agendamentoId: string | null,
  dataSessao: string,
  texto: string,
): Promise<{ ok: boolean; error?: string }> {
  const tel = await telefoneReal(telefone);
  if (!tel) return { ok: false, error: "Paciente não encontrado." };
  const sb = getClient();
  const t = texto.trim().slice(0, 4000);
  let q = sb.from("paciente_evolucao").select("id, observacoes").in("telefone", variantesTelefone(tel)).order("criado_em", { ascending: false }).limit(1);
  q = agendamentoId ? q.eq("agendamento_id", agendamentoId) : q.eq("data_sessao", dataSessao);
  const r = await q;
  const atual = r.data?.[0] as { id: string; observacoes: string | null } | undefined;
  if (atual) {
    const junto = [atual.observacoes, t].filter(Boolean).join("\n\n").slice(0, 4000);
    const u = await sb.from("paciente_evolucao").update({ observacoes: junto }).eq("id", atual.id);
    return u.error ? { ok: false, error: u.error.message } : { ok: true };
  }
  const i = await sb.from("paciente_evolucao").insert({ telefone: tel, agendamento_id: agendamentoId, data_sessao: dataSessao, observacoes: t });
  return i.error ? { ok: false, error: i.error.message } : { ok: true };
}
