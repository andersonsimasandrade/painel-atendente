// NEGÓCIOS: histórico de cada tentativa de venda/atendimento por pessoa.
//   • 1 negócio ABERTO por pessoa, no máximo. Ao nascer o contato, o banco cria o 1º negócio (gatilho SQL).
//   • PERDIDO: tira a pessoa do funil (desfecho "perdido"), cancela mensagens e tarefas pendentes e guarda o motivo.
//   • Se a pessoa voltar a ter interesse (ou for uma recompra), abre-se OUTRO negócio: o histórico continua e as
//     métricas de resultado comercial e retenção ficam fiéis.
// Server-only.
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { enfileirarSequencia } from "./funil";
import { setEstagioManual } from "./db";
import type { ContatoPendente, MetricasNegocios, Negocio, TipoNegocio } from "./negocios-tipos";

type R = { ok: true } | { ok: false; error: string };
const num = (v: unknown): number | null => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

async function telefoneReal(telefone: string): Promise<string | null> {
  const r = await getClient().from("ff_contatos").select("telefone").in("telefone", variantesTelefone(telefone)).limit(1);
  return (r.data?.[0] as { telefone?: string } | undefined)?.telefone ?? null;
}

function paraNegocio(r: Record<string, unknown>): Negocio {
  return {
    id: Number(r.id),
    telefone: String(r.telefone),
    criado_em: String(r.criado_em),
    tipo: (r.tipo as Negocio["tipo"]) ?? "inicial",
    status: (r.status as Negocio["status"]) ?? "aberto",
    fechado_em: (r.fechado_em as string | null) ?? null,
    valor: num(r.valor),
    motivo_perda: (r.motivo_perda as string | null) ?? null,
    observacao: (r.observacao as string | null) ?? null,
  };
}

export async function listarNegocios(telefone: string): Promise<Negocio[]> {
  const r = await getClient()
    .from("negocios")
    .select("*")
    .in("telefone", variantesTelefone(telefone))
    .order("criado_em", { ascending: false })
    .limit(50);
  return ((r.data ?? []) as Record<string, unknown>[]).map(paraNegocio);
}

async function negocioAberto(tel: string): Promise<Negocio | null> {
  const r = await getClient().from("negocios").select("*").eq("telefone", tel).eq("status", "aberto").limit(1);
  const row = (r.data?.[0] ?? null) as Record<string, unknown> | null;
  return row ? paraNegocio(row) : null;
}

/** PERDIDO: sai do funil, guarda o motivo no histórico e cancela o que estava programado para a pessoa. */
export async function perderNegocio(telefone: string, motivo: string, observacao?: string): Promise<R> {
  const sb = getClient();
  const tel = await telefoneReal(telefone);
  if (!tel) return { ok: false, error: "Lead não encontrado." };
  const m = String(motivo ?? "").trim().slice(0, 160) || "Sem motivo informado";
  const agora = new Date().toISOString();

  const aberto = await negocioAberto(tel);
  if (aberto) {
    const u = await sb
      .from("negocios")
      .update({ status: "perdido", fechado_em: agora, motivo_perda: m, observacao: observacao?.trim().slice(0, 300) || aberto.observacao })
      .eq("id", aberto.id);
    if (u.error) return { ok: false, error: u.error.message };
  } else {
    const i = await sb.from("negocios").insert({ telefone: tel, tipo: "inicial", status: "perdido", fechado_em: agora, motivo_perda: m });
    if (i.error) return { ok: false, error: i.error.message };
  }

  const c = await sb
    .from("ff_contatos")
    .update({ resultado: "perdido", resultado_motivo: m.slice(0, 200), resultado_em: agora })
    .eq("telefone", tel);
  if (c.error) return { ok: false, error: c.error.message };

  // linha do tempo, mensagens do funil e tarefas pendentes
  await sb.from("ff_eventos").insert({ telefone: tel, stage: "perdido", canal: "painel" });
  await enfileirarSequencia(tel, "perdido").catch(() => undefined); // etapa sem mensagens: só cancela a régua pendente
  await sb
    .from("tarefas")
    .update({ status: "descartada", resultado: "Negociação marcada como perdida." })
    .in("telefone", variantesTelefone(tel))
    .in("status", ["sugerida", "aprovada"]);
  return { ok: true };
}

/** Registra o fechamento no histórico (chamado quando o valor fechado é salvo). */
export async function ganharNegocio(telefone: string, valor: number | null): Promise<void> {
  try {
    const sb = getClient();
    const tel = await telefoneReal(telefone);
    if (!tel) return;
    const agora = new Date().toISOString();
    const aberto = await negocioAberto(tel);
    if (aberto) {
      await sb.from("negocios").update({ status: "ganho", fechado_em: agora, valor }).eq("id", aberto.id);
    } else {
      await sb.from("negocios").insert({ telefone: tel, tipo: "recompra", status: "ganho", fechado_em: agora, valor });
    }
  } catch (e) {
    console.error("[negocios] ganhar:", e instanceof Error ? e.message : e);
  }
}

/** "Desfazer fechamento": o último negócio concretizado volta a ficar em andamento (se não houver outro aberto). */
export async function desfazerGanho(telefone: string): Promise<void> {
  try {
    const sb = getClient();
    const tel = await telefoneReal(telefone);
    if (!tel || (await negocioAberto(tel))) return;
    const r = await sb.from("negocios").select("id").eq("telefone", tel).eq("status", "ganho").order("fechado_em", { ascending: false }).limit(1);
    const id = (r.data?.[0] as { id?: number } | undefined)?.id;
    if (id) await sb.from("negocios").update({ status: "aberto", fechado_em: null, valor: null }).eq("id", id);
  } catch (e) {
    console.error("[negocios] desfazer ganho:", e instanceof Error ? e.message : e);
  }
}

/** NOVA NEGOCIAÇÃO: a pessoa voltou a ter interesse ou é uma recompra. Volta ao funil com histórico preservado. */
export async function novoNegocio(telefone: string, tipo: TipoNegocio, observacao?: string): Promise<R> {
  const sb = getClient();
  const tel = await telefoneReal(telefone);
  if (!tel) return { ok: false, error: "Lead não encontrado." };
  if (await negocioAberto(tel)) return { ok: false, error: "Já existe uma negociação em andamento para esta pessoa." };
  const t: TipoNegocio = tipo === "recompra" ? "recompra" : "reativacao";
  const i = await sb.from("negocios").insert({ telefone: tel, tipo: t, status: "aberto", observacao: observacao?.trim().slice(0, 300) || null });
  if (i.error) return { ok: false, error: i.error.message };
  const c = await sb
    .from("ff_contatos")
    .update({ resultado: null, resultado_motivo: null, resultado_em: null, lead_ativo: true, followup_count: 0 })
    .eq("telefone", tel);
  if (c.error) return { ok: false, error: c.error.message };
  await setEstagioManual(tel, "qualificando"); // volta ao funil e registra na linha do tempo
  return { ok: true };
}

/** Métricas de negócios do período (concretizados, perdidos, reativados) e o que está em andamento agora. */
export async function metricasNegocios(desde: string, ate: string): Promise<MetricasNegocios> {
  const r = await getClient().from("negocios").select("*").limit(20000);
  const todos = ((r.data ?? []) as Record<string, unknown>[]).map(paraNegocio);
  const ini = new Date(`${desde}T00:00:00-03:00`).getTime();
  const fim = new Date(`${ate}T23:59:59-03:00`).getTime();
  const no = (iso: string | null) => (iso ? new Date(iso).getTime() >= ini && new Date(iso).getTime() <= fim : false);

  const ganhos = todos.filter((n) => n.status === "ganho" && no(n.fechado_em));
  const perdidos = todos.filter((n) => n.status === "perdido" && no(n.fechado_em));
  const motivos = new Map<string, number>();
  for (const p of perdidos) motivos.set(p.motivo_perda ?? "Sem motivo", (motivos.get(p.motivo_perda ?? "Sem motivo") ?? 0) + 1);
  return {
    abertos: todos.filter((n) => n.status === "aberto").length,
    criadosNoPeriodo: todos.filter((n) => no(n.criado_em)).length,
    concretizados: ganhos.length,
    receita: ganhos.reduce((t, n) => t + (n.valor ?? 0), 0),
    perdidos: perdidos.length,
    reativados: todos.filter((n) => n.tipo !== "inicial" && no(n.criado_em)).length,
    conversao: ganhos.length + perdidos.length > 0 ? ganhos.length / (ganhos.length + perdidos.length) : null,
    motivosPerda: [...motivos.entries()].map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd),
  };
}

const DIA = 86400000;

/**
 * Quem precisa ser contactado:
 *   • "voltou": marcada como perdida mas escreveu depois (pode ter voltado a ter interesse);
 *   • "recompra": paciente com negócio concretizado há 30+ dias, sem nova negociação aberta (acompanhamento / nova consulta);
 *   • "reativacao": negociação perdida há 30 a 180 dias (vale tentar um contato gentil).
 */
export async function contatarAgora(limite = 12): Promise<ContatoPendente[]> {
  const sb = getClient();
  const r = await sb.from("negocios").select("*").limit(20000);
  const todos = ((r.data ?? []) as Record<string, unknown>[]).map(paraNegocio);
  const porTel = new Map<string, Negocio[]>();
  for (const n of todos) porTel.set(n.telefone, [...(porTel.get(n.telefone) ?? []), n]);

  const agora = Date.now();
  const candidatos: { tel: string; tipo: ContatoPendente["tipo"]; ref: number; motivo: string }[] = [];
  for (const [tel, lista] of porTel) {
    if (lista.some((n) => n.status === "aberto")) continue; // já tem negociação em andamento
    const ult = [...lista].sort((a, b) => new Date(b.fechado_em ?? b.criado_em).getTime() - new Date(a.fechado_em ?? a.criado_em).getTime())[0];
    const ref = new Date(ult.fechado_em ?? ult.criado_em).getTime();
    const dias = Math.floor((agora - ref) / DIA);
    if (ult.status === "ganho" && dias >= 30) {
      candidatos.push({ tel, tipo: "recompra", ref, motivo: `Paciente há ${dias} dias sem nova negociação: acompanhar ou oferecer nova consulta` });
    } else if (ult.status === "perdido" && dias >= 30 && dias <= 180) {
      candidatos.push({ tel, tipo: "reativacao", ref, motivo: `Negociação perdida há ${dias} dias (${ult.motivo_perda ?? "sem motivo"}): vale um contato gentil` });
    } else if (ult.status === "perdido") {
      candidatos.push({ tel, tipo: "reativacao", ref, motivo: "" }); // placeholder: só entra se tiver voltado a falar (abaixo)
    }
  }

  // quem foi marcada como perdida mas escreveu depois
  const perdidos = candidatos.map((c) => c.tel);
  const voltaram = new Map<string, number>();
  if (perdidos.length) {
    const m = await sb.from("ff_mensagens").select("telefone, criada_em").in("telefone", perdidos).eq("direcao", "entrada").order("criada_em", { ascending: false }).limit(2000);
    for (const row of (m.data ?? []) as { telefone: string; criada_em: string }[]) {
      if (!voltaram.has(row.telefone)) voltaram.set(row.telefone, new Date(row.criada_em).getTime());
    }
  }

  const saida: { tel: string; tipo: ContatoPendente["tipo"]; dias: number; motivo: string }[] = [];
  for (const c of candidatos) {
    const lista = porTel.get(c.tel) ?? [];
    const ult = [...lista].sort((a, b) => new Date(b.fechado_em ?? b.criado_em).getTime() - new Date(a.fechado_em ?? a.criado_em).getTime())[0];
    const escreveu = voltaram.get(c.tel);
    if (ult.status === "perdido" && escreveu && escreveu > ref(ult)) {
      saida.push({ tel: c.tel, tipo: "voltou", dias: Math.floor((agora - escreveu) / DIA), motivo: "Marcada como perdida, mas voltou a escrever: pode ter voltado a ter interesse" });
    } else if (c.motivo) {
      saida.push({ tel: c.tel, tipo: c.tipo, dias: Math.floor((agora - c.ref) / DIA), motivo: c.motivo });
    }
  }
  const ordem = { voltou: 0, recompra: 1, reativacao: 2 } as const;
  saida.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || b.dias - a.dias);
  const top = saida.slice(0, limite);

  const nomes = new Map<string, string | null>();
  if (top.length) {
    const n = await sb.from("ff_contatos").select("telefone, nome").in("telefone", top.map((t) => t.tel));
    for (const row of (n.data ?? []) as { telefone: string; nome: string | null }[]) nomes.set(row.telefone, row.nome);
  }
  return top.map((t) => ({ telefone: t.tel, nome: nomes.get(t.tel) ?? null, tipo: t.tipo, dias: t.dias, motivo: t.motivo }));
}

function ref(n: Negocio): number {
  return new Date(n.fechado_em ?? n.criado_em).getTime();
}
