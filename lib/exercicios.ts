// PRESCRIÇÃO DE EXERCÍCIOS: biblioteca do Anderson, plano por paciente (com link público por código secreto) e check-ins.
// A página do paciente mostra só o primeiro nome e o plano; o código do link é aleatório e longo. Server-only.
import { randomBytes } from "node:crypto";
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { destinatariosAlerta } from "./config";
import { enviarTextoInstancia } from "./evolution";
import type { CheckinPrescricao, Exercicio, ItemPrescricao, Prescricao } from "./exercicios-tipos";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const txt = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
const inteiro = (v: unknown, min: number, max: number): number | null => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const urlOk = (v: unknown): string | null => {
  const s = txt(v, 500);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

// ── Biblioteca ─────────────────────────────────────────────────────────────

function paraExercicio(r: Record<string, unknown>): Exercicio {
  return {
    id: String(r.id),
    nome: String(r.nome),
    regiao: (r.regiao as string | null) ?? null,
    instrucoes: (r.instrucoes as string | null) ?? null,
    video_url: (r.video_url as string | null) ?? null,
    series: r.series == null ? null : Number(r.series),
    repeticoes: (r.repeticoes as string | null) ?? null,
    frequencia: (r.frequencia as string | null) ?? null,
    observacao: (r.observacao as string | null) ?? null,
    modelo: r.modelo === true,
    ativo: r.ativo !== false,
  };
}

export async function listarExercicios(incluirInativos = false): Promise<Exercicio[]> {
  let q = getClient().from("exercicios").select("*").order("regiao", { ascending: true, nullsFirst: false }).order("nome", { ascending: true }).limit(500);
  if (!incluirInativos) q = q.eq("ativo", true);
  const r = await q;
  return ((r.data ?? []) as Record<string, unknown>[]).map(paraExercicio);
}

export async function salvarExercicio(d: Record<string, unknown>, id?: string): Promise<R<{ id: string }>> {
  const nome = txt(d.nome, 140);
  if (!nome) return { ok: false, error: "Dê um nome ao exercício." };
  const video = txt(d.video_url, 500);
  if (video && !urlOk(video)) return { ok: false, error: "O link do vídeo deve começar com http:// ou https://." };
  const linha = {
    nome,
    regiao: txt(d.regiao, 60),
    instrucoes: txt(d.instrucoes, 3000),
    video_url: video,
    series: inteiro(d.series, 1, 20),
    repeticoes: txt(d.repeticoes, 60),
    frequencia: txt(d.frequencia, 80),
    observacao: txt(d.observacao, 600),
    modelo: false, // ao salvar, o Anderson assume o conteúdo: deixa de ser "modelo"
    ativo: d.ativo !== false,
  };
  const sb = getClient();
  if (id) {
    const u = await sb.from("exercicios").update(linha).eq("id", id).select("id");
    if (u.error) return { ok: false, error: u.error.message };
    return u.data?.length ? { ok: true, id } : { ok: false, error: "Exercício não encontrado." };
  }
  const i = await sb.from("exercicios").insert(linha).select("id");
  if (i.error) return { ok: false, error: i.error.message };
  return { ok: true, id: String((i.data?.[0] as { id: string }).id) };
}

export async function excluirExercicio(id: string): Promise<R> {
  // os planos já criados guardam uma cópia do exercício: apagar da biblioteca não muda o que o paciente vê
  const d = await getClient().from("exercicios").delete().eq("id", id).select("id");
  if (d.error) return { ok: false, error: d.error.message };
  return d.data?.length ? { ok: true } : { ok: false, error: "Exercício não encontrado." };
}

// ── Plano do paciente ──────────────────────────────────────────────────────

async function telefoneReal(telefone: string): Promise<string | null> {
  const r = await getClient().from("ff_contatos").select("telefone").in("telefone", variantesTelefone(telefone)).limit(1);
  return (r.data?.[0] as { telefone?: string } | undefined)?.telefone ?? null;
}

function paraItem(r: Record<string, unknown>): ItemPrescricao {
  return {
    exercicio_id: (r.exercicio_id as string | null) ?? null,
    nome: String(r.nome),
    instrucoes: (r.instrucoes as string | null) ?? null,
    video_url: (r.video_url as string | null) ?? null,
    series: r.series == null ? null : Number(r.series),
    repeticoes: (r.repeticoes as string | null) ?? null,
    frequencia: (r.frequencia as string | null) ?? null,
    observacao: (r.observacao as string | null) ?? null,
  };
}

function paraCheckin(r: Record<string, unknown>): CheckinPrescricao {
  return {
    id: String(r.id),
    dias_feitos: r.dias_feitos == null ? null : Number(r.dias_feitos),
    dor: r.dor == null ? null : Number(r.dor),
    comentario: (r.comentario as string | null) ?? null,
    criado_em: String(r.criado_em),
  };
}

export async function criarPrescricao(
  telefone: string,
  d: { titulo?: unknown; orientacoes?: unknown; itens?: unknown },
): Promise<R<{ id: string; codigo: string }>> {
  const tel = await telefoneReal(telefone);
  if (!tel) return { ok: false, error: "Paciente não encontrado." };
  const itens = (Array.isArray(d.itens) ? d.itens : []).slice(0, 30).map((x) => x as Record<string, unknown>);
  const validos = itens.filter((i) => txt(i.nome, 140));
  if (!validos.length) return { ok: false, error: "Escolha ao menos um exercício." };

  const sb = getClient();
  const codigo = randomBytes(12).toString("base64url"); // 16 caracteres, impossível de adivinhar
  const p = await sb
    .from("prescricoes")
    .insert({ telefone: tel, codigo, titulo: txt(d.titulo, 120) ?? "Plano de exercícios", orientacoes: txt(d.orientacoes, 3000) })
    .select("id");
  if (p.error) return { ok: false, error: p.error.message };
  const id = String((p.data?.[0] as { id: string }).id);

  const linhas = validos.map((i, ordem) => ({
    prescricao_id: id,
    ordem,
    exercicio_id: typeof i.exercicio_id === "string" && i.exercicio_id ? i.exercicio_id : null,
    nome: txt(i.nome, 140) as string,
    instrucoes: txt(i.instrucoes, 3000),
    video_url: urlOk(i.video_url),
    series: inteiro(i.series, 1, 20),
    repeticoes: txt(i.repeticoes, 60),
    frequencia: txt(i.frequencia, 80),
    observacao: txt(i.observacao, 600),
  }));
  const it = await sb.from("prescricao_itens").insert(linhas);
  if (it.error) {
    await sb.from("prescricoes").delete().eq("id", id);
    return { ok: false, error: it.error.message };
  }
  return { ok: true, id, codigo };
}

export async function listarPrescricoes(telefone: string): Promise<Prescricao[]> {
  const sb = getClient();
  const r = await sb.from("prescricoes").select("*").in("telefone", variantesTelefone(telefone)).order("criado_em", { ascending: false }).limit(30);
  const base = (r.data ?? []) as Record<string, unknown>[];
  if (!base.length) return [];
  const ids = base.map((p) => String(p.id));
  const [it, ck] = await Promise.all([
    sb.from("prescricao_itens").select("*").in("prescricao_id", ids).order("ordem", { ascending: true }),
    sb.from("prescricao_checkins").select("*").in("prescricao_id", ids).order("criado_em", { ascending: false }).limit(200),
  ]);
  const itens = (it.data ?? []) as Record<string, unknown>[];
  const checks = (ck.data ?? []) as Record<string, unknown>[];
  return base.map((p) => ({
    id: String(p.id),
    codigo: String(p.codigo),
    titulo: String(p.titulo),
    orientacoes: (p.orientacoes as string | null) ?? null,
    ativa: p.ativa !== false,
    criado_em: String(p.criado_em),
    enviado_em: (p.enviado_em as string | null) ?? null,
    itens: itens.filter((i) => String(i.prescricao_id) === String(p.id)).map(paraItem),
    checkins: checks.filter((c) => String(c.prescricao_id) === String(p.id)).map(paraCheckin),
  }));
}

export async function marcarEnviada(telefone: string, id: string): Promise<void> {
  await getClient().from("prescricoes").update({ enviado_em: new Date().toISOString() }).eq("id", id).in("telefone", variantesTelefone(telefone));
}

export async function encerrarPrescricao(telefone: string, id: string, ativa: boolean): Promise<R> {
  const r = await getClient().from("prescricoes").update({ ativa }).eq("id", id).in("telefone", variantesTelefone(telefone)).select("id");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Plano não encontrado." };
}

export async function excluirPrescricao(telefone: string, id: string): Promise<R> {
  const r = await getClient().from("prescricoes").delete().eq("id", id).in("telefone", variantesTelefone(telefone)).select("id");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Plano não encontrado." };
}

// ── Página pública do paciente ─────────────────────────────────────────────

export interface PlanoPublico {
  id: string;
  titulo: string;
  orientacoes: string | null;
  criado_em: string;
  primeiroNome: string | null;
  itens: ItemPrescricao[];
}

/** Plano pelo código secreto do link. Devolve só o primeiro nome do paciente (nunca telefone). */
export async function planoPublico(codigo: string): Promise<PlanoPublico | null> {
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(codigo)) return null;
  const sb = getClient();
  const r = await sb.from("prescricoes").select("*").eq("codigo", codigo).eq("ativa", true).limit(1);
  const p = r.data?.[0] as Record<string, unknown> | undefined;
  if (!p) return null;
  const [it, c] = await Promise.all([
    sb.from("prescricao_itens").select("*").eq("prescricao_id", p.id as string).order("ordem", { ascending: true }),
    sb.from("ff_contatos").select("nome").eq("telefone", p.telefone as string).limit(1),
  ]);
  const nome = ((c.data?.[0] as { nome?: string | null } | undefined)?.nome ?? "").trim();
  const primeiro = nome ? nome.split(/\s+/)[0] : "";
  return {
    id: String(p.id),
    titulo: String(p.titulo),
    orientacoes: (p.orientacoes as string | null) ?? null,
    criado_em: String(p.criado_em),
    primeiroNome: primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : null,
    itens: ((it.data ?? []) as Record<string, unknown>[]).map(paraItem),
  };
}

/** Check-in do paciente pelo link. No máximo 1 a cada 2 minutos por plano (evita repetição e abuso). */
export async function registrarCheckin(codigo: string, d: { dias_feitos?: unknown; dor?: unknown; comentario?: unknown }): Promise<R> {
  const plano = await planoPublico(codigo);
  if (!plano) return { ok: false, error: "Link inválido ou encerrado." };
  const dias = inteiro(d.dias_feitos, 0, 7);
  const dor = inteiro(d.dor, 0, 10);
  const comentario = txt(d.comentario, 600);
  if (dias == null && dor == null && !comentario) return { ok: false, error: "Conte como foi: dias feitos, dor ou um recado." };
  const sb = getClient();
  const ult = await sb.from("prescricao_checkins").select("criado_em").eq("prescricao_id", plano.id).order("criado_em", { ascending: false }).limit(1);
  const t = (ult.data?.[0] as { criado_em?: string } | undefined)?.criado_em;
  if (t && Date.now() - new Date(t).getTime() < 2 * 60 * 1000) return { ok: false, error: "Recebemos agora há pouco. Obrigado!" };
  const i = await sb.from("prescricao_checkins").insert({ prescricao_id: plano.id, dias_feitos: dias, dor, comentario });
  if (i.error) return { ok: false, error: "Não consegui registrar agora. Tente de novo." };

  // Avisa o Anderson quando o retorno pede atenção: dor alta, poucos dias feitos ou um recado do paciente.
  if ((dor != null && dor >= 7) || (dias != null && dias <= 1) || comentario) {
    try {
      const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
      if (instancia) {
        const msg = `📋 Retorno dos exercícios de ${plano.primeiroNome ?? "um paciente"}: ${dias != null ? `fez ${dias} dia(s)` : "dias não informados"}${dor != null ? ` · dor ${dor}/10` : ""}${comentario ? ` · “${comentario.slice(0, 200)}”` : ""}. Veja na ficha do paciente.`;
        for (const d of destinatariosAlerta()) if (d.whatsapp) await enviarTextoInstancia(instancia, d.whatsapp, msg).catch(() => undefined);
      }
    } catch {
      /* o aviso é um extra: o retorno já foi gravado */
    }
  }
  return { ok: true };
}
