// DEVOLUTIVA DO CASO: documento privado que o Anderson entrega ao paciente (e que ele pode mostrar a outro profissional).
// Conteúdo = o que o Anderson revisou e aprovou (retrato salvo na criação). A evolução da dor é lida do prontuário ao abrir.
// O link usa um código aleatório; a página mostra só o primeiro nome. Server-only.
import { randomBytes } from "node:crypto";
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { nascimentoIso } from "./devolutiva-acesso";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface ExameDevolutiva {
  titulo: string;
  tipo: string;
  data: string | null;
  resumo: string;
}

export interface Devolutiva {
  id: string;
  codigo: string;
  titulo: string;
  relato: string | null;
  exames: ExameDevolutiva[];
  achados: string | null;
  plano: string | null;
  observacoes: string | null;
  mostrar_dor: boolean;
  local: "capoeiras" | "centro" | null; // consultório da última sessão realizada
  data_sessao: string | null; // dia da última sessão realizada (AAAA-MM-DD)
  sessao_em: string | null; // data e hora da última sessão realizada
  prescricao_codigo: string | null;
  ativa: boolean;
  criado_em: string;
  enviado_em: string | null;
}

export interface PontoDor {
  data: string; // AAAA-MM-DD
  inicio: number | null;
  fim: number | null;
}

export interface DevolutivaPublica extends Devolutiva {
  primeiroNome: string | null;
  dor: PontoDor[];
}

const txt = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

async function telefoneReal(telefone: string): Promise<string | null> {
  const r = await getClient().from("ff_contatos").select("telefone").in("telefone", variantesTelefone(telefone)).limit(1);
  return (r.data?.[0] as { telefone?: string } | undefined)?.telefone ?? null;
}

function paraExames(v: unknown): ExameDevolutiva[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.titulo === "string" && typeof x.resumo === "string")
    .map((x) => ({ titulo: String(x.titulo), tipo: String(x.tipo ?? "outro"), data: typeof x.data === "string" ? x.data : null, resumo: String(x.resumo) }));
}

async function codigoDaPrescricao(id: string | null): Promise<string | null> {
  if (!id) return null;
  const r = await getClient().from("prescricoes").select("codigo, ativa").eq("id", id).limit(1);
  const p = r.data?.[0] as { codigo?: string; ativa?: boolean } | undefined;
  return p?.ativa ? (p.codigo ?? null) : null;
}

async function paraDevolutiva(r: Record<string, unknown>): Promise<Devolutiva> {
  return {
    id: String(r.id),
    codigo: String(r.codigo),
    titulo: String(r.titulo),
    relato: (r.relato as string | null) ?? null,
    exames: paraExames(r.exames),
    achados: (r.achados as string | null) ?? null,
    plano: (r.plano as string | null) ?? null,
    observacoes: (r.observacoes as string | null) ?? null,
    mostrar_dor: r.mostrar_dor !== false,
    local: r.local === "capoeiras" || r.local === "centro" ? (r.local as "capoeiras" | "centro") : null,
    data_sessao: (r.data_sessao as string | null) ?? null,
    sessao_em: (r.sessao_em as string | null) ?? null,
    prescricao_codigo: await codigoDaPrescricao((r.prescricao_id as string | null) ?? null),
    ativa: r.ativa !== false,
    criado_em: String(r.criado_em),
    enviado_em: (r.enviado_em as string | null) ?? null,
  };
}

export async function criarDevolutiva(telefone: string, d: Record<string, unknown>): Promise<R<{ id: string; codigo: string }>> {
  const tel = await telefoneReal(telefone);
  if (!tel) return { ok: false, error: "Paciente não encontrado." };
  const exames = paraExames(d.exames).slice(0, 10).map((e) => ({ ...e, titulo: e.titulo.slice(0, 140), resumo: e.resumo.slice(0, 4000) }));
  const relato = txt(d.relato, 4000);
  const achados = txt(d.achados, 4000);
  const plano = txt(d.plano, 4000);
  if (!relato && !exames.length && !achados && !plano) return { ok: false, error: "Escreva ao menos uma parte da devolutiva." };
  // A data de nascimento é a "senha" do link: precisa existir (informada agora ou já cadastrada).
  const nascInformado = nascimentoIso(String(d.data_nascimento ?? ""));
  if (nascInformado) await salvarNascimento(tel, nascInformado);
  else if (!(await nascimentoDoPaciente(tel))) return { ok: false, error: "Informe a data de nascimento do paciente: é a senha para abrir o link." };
  const codigo = randomBytes(12).toString("base64url");

  // Local e data da assinatura: consultório e dia da última sessão realizada (senão, a última evolução registrada; senão, hoje).
  const sb = getClient();
  const variantes = variantesTelefone(tel);
  const hojeSP = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  let dataSessao: string = hojeSP;
  let local: "capoeiras" | "centro" | null = null;
  let sessaoEm: string | null = null;
  const ag = await sb.from("agendamentos").select("data_hora, local").in("telefone_lead", variantes).eq("status", "compareceu").order("data_hora", { ascending: false }).limit(1);
  const ultima = ag.data?.[0] as { data_hora: string; local: string | null } | undefined;
  if (ultima) {
    sessaoEm = ultima.data_hora;
    dataSessao = new Date(new Date(ultima.data_hora).getTime() - 3 * 3600000).toISOString().slice(0, 10);
    local = ultima.local === "capoeiras" || ultima.local === "centro" ? ultima.local : null;
  } else {
    const ev = await sb.from("paciente_evolucao").select("data_sessao").in("telefone", variantes).order("data_sessao", { ascending: false }).limit(1);
    const d = (ev.data?.[0] as { data_sessao?: string } | undefined)?.data_sessao;
    if (d) dataSessao = d;
  }

  const i = await sb
    .from("devolutivas")
    .insert({
      telefone: tel,
      codigo,
      titulo: txt(d.titulo, 120) ?? "Devolutiva do seu caso",
      relato,
      exames,
      achados,
      plano,
      observacoes: txt(d.observacoes, 3000),
      mostrar_dor: d.mostrar_dor !== false,
      local,
      data_sessao: dataSessao,
      sessao_em: sessaoEm,
      prescricao_id: typeof d.prescricao_id === "string" && d.prescricao_id ? d.prescricao_id : null,
    })
    .select("id");
  if (i.error) return { ok: false, error: i.error.message };
  return { ok: true, id: String((i.data?.[0] as { id: string }).id), codigo };
}

export async function listarDevolutivas(telefone: string): Promise<Devolutiva[]> {
  const r = await getClient().from("devolutivas").select("*").in("telefone", variantesTelefone(telefone)).order("criado_em", { ascending: false }).limit(20);
  return Promise.all(((r.data ?? []) as Record<string, unknown>[]).map(paraDevolutiva));
}

export async function marcarDevolutivaEnviada(telefone: string, id: string): Promise<void> {
  await getClient().from("devolutivas").update({ enviado_em: new Date().toISOString() }).eq("id", id).in("telefone", variantesTelefone(telefone));
}

export async function ativarDevolutiva(telefone: string, id: string, ativa: boolean): Promise<R> {
  const r = await getClient().from("devolutivas").update({ ativa }).eq("id", id).in("telefone", variantesTelefone(telefone)).select("id");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Devolutiva não encontrada." };
}

export async function excluirDevolutiva(telefone: string, id: string): Promise<R> {
  const r = await getClient().from("devolutivas").delete().eq("id", id).in("telefone", variantesTelefone(telefone)).select("id");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Devolutiva não encontrada." };
}

/** Devolutiva pelo código secreto do link (ativa). Devolve só o primeiro nome do paciente; nunca telefone. */
export async function devolutivaPublica(codigo: string): Promise<DevolutivaPublica | null> {
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(codigo)) return null;
  const sb = getClient();
  const r = await sb.from("devolutivas").select("*").eq("codigo", codigo).eq("ativa", true).limit(1);
  const row = r.data?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const tel = String(row.telefone);
  const [c, ev] = await Promise.all([
    sb.from("ff_contatos").select("nome").eq("telefone", tel).limit(1),
    row.mostrar_dor === false
      ? Promise.resolve({ data: [] as unknown[] })
      : sb.from("paciente_evolucao").select("data_sessao, dor_inicio, dor_fim").in("telefone", variantesTelefone(tel)).order("data_sessao", { ascending: true }).limit(60),
  ]);
  const nome = ((c.data?.[0] as { nome?: string | null } | undefined)?.nome ?? "").trim().split(/\s+/)[0];
  const dor = ((ev.data ?? []) as { data_sessao: string; dor_inicio: number | null; dor_fim: number | null }[])
    .filter((e) => e.dor_inicio != null || e.dor_fim != null)
    .map((e) => ({ data: e.data_sessao, inicio: e.dor_inicio, fim: e.dor_fim }));
  const base = await paraDevolutiva(row);
  return { ...base, primeiroNome: nome ? nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase() : null, dor };
}

// ── Data de nascimento (senha do link) e assinatura do profissional ────────────────────────────────────────

export async function nascimentoDoPaciente(telefone: string): Promise<string | null> {
  const r = await getClient().from("ff_contatos").select("data_nascimento").in("telefone", variantesTelefone(telefone)).limit(1);
  return ((r.data?.[0] as { data_nascimento?: string | null } | undefined)?.data_nascimento ?? null) || null;
}

export async function salvarNascimento(telefone: string, iso: string): Promise<void> {
  await getClient().from("ff_contatos").update({ data_nascimento: iso }).in("telefone", variantesTelefone(telefone));
}

/** Para a "porta" da devolutiva: o documento existe e está ativo? Qual a data de nascimento esperada? */
export async function dadosDeAcesso(codigo: string): Promise<{ nascimento: string | null } | null> {
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(codigo)) return null;
  const sb = getClient();
  const r = await sb.from("devolutivas").select("telefone, ativa").eq("codigo", codigo).limit(1);
  const row = r.data?.[0] as { telefone?: string; ativa?: boolean } | undefined;
  if (!row || row.ativa === false || !row.telefone) return null;
  return { nascimento: await nascimentoDoPaciente(row.telefone) };
}

let assinaturaCache: { b64: string | null; em: number } | null = null;
/** Assinatura do profissional (PNG em base64, guardada no banco privado). Só é entregue depois que o paciente abre o documento. */
export async function assinaturaProfissional(): Promise<string | null> {
  if (assinaturaCache && Date.now() - assinaturaCache.em < 10 * 60 * 1000) return assinaturaCache.b64;
  const r = await getClient().from("profissional_assinatura").select("png_base64").eq("id", 1).limit(1);
  const b64 = ((r.data?.[0] as { png_base64?: string } | undefined)?.png_base64 ?? "").trim();
  const ok = /^[A-Za-z0-9+/=]+$/.test(b64) ? b64 : null;
  assinaturaCache = { b64: ok, em: Date.now() };
  return ok;
}
