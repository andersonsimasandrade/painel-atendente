// Etapas PERSONALIZÁVEIS do funil (funil_etapas) + sequência de mensagens por
// etapa (funil_etapa_msgs) + fila de envio (funil_envios). Server-only.
//
// Regras de convivência com o BOT (que grava funnel_stage direto no n8n):
//  • As 7 etapas de fábrica têm sistema=true: podem ser renomeadas/recoloridas/
//    reordenadas, mas NUNCA excluídas — o bot continua gravando essas chaves.
//  • Etapas novas (sistema=false) são livres; excluir uma move os leads dela.
//  • A sequência dispara SÓ em movimento MANUAL (kanban/seletor do painel) —
//    a rota /api/lead/[tel]/estagio enfileira; o bot não passa por ela.
//  • Cancelamento automático (na hora do envio, no cron): lead respondeu depois
//    do movimento OU já não está mais na etapa → mensagem não sai.

import { getClient } from "./db";
import { STAGE_ORDER } from "./theme";
import { variantesTelefone } from "./telefone";

export interface Etapa {
  key: string;
  label: string;
  color: string;
  position: number;
  rank: number;
  sistema: boolean;
}

export interface EtapaMsg {
  id: number;
  etapa_key: string;
  ordem: number;
  atraso_min: number; // desde a ENTRADA na etapa (0 = imediato)
  texto: string; // aceita {nome}
}

export const PALETA_ETAPAS = [
  "#2FE58F", "#18A57C", "#39B7C4", "#4EA8DE",
  "#A78BFA", "#E0A63C", "#E05C5C", "#8D9A93",
];

export const MAX_ETAPAS = 12;
export const MAX_MSGS_POR_ETAPA = 10;

// Fallback quando a tabela está inacessível: as 7 de fábrica (o painel nunca
// pode ficar sem colunas por causa de um soluço no banco).
const ETAPAS_PADRAO: Etapa[] = STAGE_ORDER.map((s, i) => ({
  key: s.key,
  label: s.label,
  color: s.color,
  position: i + 1,
  rank: s.rank,
  sistema: true,
}));

export async function getEtapas(): Promise<Etapa[]> {
  try {
    const res = await getClient()
      .from("funil_etapas")
      .select("key, label, color, position, rank, sistema")
      .order("position", { ascending: true })
      .limit(100);
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as Etapa[];
    return rows.length ? rows : ETAPAS_PADRAO;
  } catch (e) {
    console.error("[funil] getEtapas:", e);
    return ETAPAS_PADRAO;
  }
}

export async function getEtapasComMsgs(): Promise<{
  etapas: Etapa[];
  msgs: Record<string, EtapaMsg[]>;
}> {
  const etapas = await getEtapas();
  const msgs: Record<string, EtapaMsg[]> = {};
  try {
    const res = await getClient()
      .from("funil_etapa_msgs")
      .select("id, etapa_key, ordem, atraso_min, texto")
      .order("etapa_key")
      .order("ordem", { ascending: true })
      .limit(500);
    if (res.error) throw new Error(res.error.message);
    for (const m of (res.data ?? []) as EtapaMsg[]) {
      (msgs[m.etapa_key] ??= []).push(m);
    }
  } catch (e) {
    console.error("[funil] getEtapasComMsgs:", e);
  }
  return { etapas, msgs };
}

// Slug estável a partir do rótulo ("Proposta enviada" -> "proposta_enviada").
function slugDe(label: string, existentes: string[]): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "etapa";
  let key = base;
  let n = 2;
  while (existentes.includes(key)) key = `${base}_${n++}`;
  return key;
}

export async function criarEtapa(
  label: string,
  color: string,
): Promise<{ ok: boolean; error?: string; key?: string }> {
  const nome = String(label ?? "").trim().slice(0, 30);
  if (!nome) return { ok: false, error: "Dê um nome à etapa." };
  if (!PALETA_ETAPAS.includes(color)) return { ok: false, error: "Cor inválida." };
  try {
    const etapas = await getEtapas();
    if (etapas.length >= MAX_ETAPAS) {
      return { ok: false, error: `Máximo de ${MAX_ETAPAS} etapas.` };
    }
    const key = slugDe(nome, etapas.map((e) => e.key));
    const position = Math.max(...etapas.map((e) => e.position), 0) + 1;
    const res = await getClient().from("funil_etapas").insert({
      key,
      label: nome,
      color,
      position,
      rank: 2, // etapa nova conta como "meio do funil" nas ordenações
      sistema: false,
    });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, key };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar a etapa." };
  }
}

export async function atualizarEtapa(
  key: string,
  patch: { label?: string; color?: string },
): Promise<{ ok: boolean; error?: string }> {
  const upd: Record<string, string> = {};
  if (patch.label !== undefined) {
    const nome = String(patch.label).trim().slice(0, 30);
    if (!nome) return { ok: false, error: "Dê um nome à etapa." };
    upd.label = nome;
  }
  if (patch.color !== undefined) {
    if (!PALETA_ETAPAS.includes(patch.color)) return { ok: false, error: "Cor inválida." };
    upd.color = patch.color;
  }
  if (!Object.keys(upd).length) return { ok: true };
  try {
    const res = await getClient().from("funil_etapas").update(upd).eq("key", key).select("key");
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data?.length) return { ok: false, error: "Etapa não encontrada." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function reordenarEtapas(
  keys: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const etapas = await getEtapas();
    const atuais = etapas.map((e) => e.key);
    if (
      keys.length !== atuais.length ||
      new Set(keys).size !== keys.length ||
      !keys.every((k) => atuais.includes(k))
    ) {
      return { ok: false, error: "Lista de etapas inválida — recarregue a página." };
    }
    const supabase = getClient();
    for (let i = 0; i < keys.length; i++) {
      const res = await supabase
        .from("funil_etapas")
        .update({ position: i + 1 })
        .eq("key", keys[i]);
      if (res.error) return { ok: false, error: res.error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao reordenar." };
  }
}

/** Exclui etapa PERSONALIZADA, movendo os leads dela para outra etapa. */
export async function excluirEtapa(
  key: string,
  moverPara: string,
): Promise<{ ok: boolean; error?: string }> {
  if (key === moverPara) return { ok: false, error: "Escolha outra etapa de destino." };
  try {
    const etapas = await getEtapas();
    const alvo = etapas.find((e) => e.key === key);
    const destino = etapas.find((e) => e.key === moverPara);
    if (!alvo) return { ok: false, error: "Etapa não encontrada." };
    if (alvo.sistema) {
      return { ok: false, error: "Etapas do sistema não podem ser excluídas (o robô usa elas)." };
    }
    if (!destino) return { ok: false, error: "Etapa de destino não encontrada." };

    const supabase = getClient();
    // Move os leads (e o rank correspondente) antes de apagar.
    const mv = await supabase
      .from("ff_contatos")
      .update({ funnel_stage: destino.key, funnel_rank: destino.rank })
      .eq("funnel_stage", key);
    if (mv.error) return { ok: false, error: mv.error.message };
    // Cancela envios pendentes que apontavam pra etapa que morreu.
    await supabase
      .from("funil_envios")
      .update({ status: "cancelado", motivo: "etapa excluída" })
      .eq("etapa_key", key)
      .eq("status", "pendente");
    // Apaga (cascade leva as mensagens da sequência junto).
    const del = await supabase.from("funil_etapas").delete().eq("key", key);
    if (del.error) return { ok: false, error: del.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao excluir." };
  }
}

/** Substitui a sequência de uma etapa (lista completa, na ordem). A troca
 *  roda numa TRANSAÇÃO no Postgres (RPC funil_salvar_msgs): falha no meio não
 *  apaga a sequência antiga. */
export async function salvarMsgs(
  etapaKey: string,
  msgs: { atraso_min: number; texto: string }[],
): Promise<{ ok: boolean; error?: string }> {
  const limpos = msgs
    .map((m) => ({
      atraso_min: Math.max(0, Math.min(20160, Math.round(Number(m.atraso_min) || 0))),
      texto: String(m.texto ?? "").trim().slice(0, 2000),
    }))
    .filter((m) => m.texto);
  if (limpos.length > MAX_MSGS_POR_ETAPA) {
    return { ok: false, error: `Máximo de ${MAX_MSGS_POR_ETAPA} mensagens por etapa.` };
  }
  try {
    const res = await getClient().rpc("funil_salvar_msgs", {
      p_etapa: etapaKey,
      p_msgs: limpos,
    });
    if (res.error) {
      const msg = res.error.message.includes("Etapa não encontrada")
        ? "Etapa não encontrada."
        : res.error.message;
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar a sequência." };
  }
}

/**
 * Enfileira a sequência da etapa para um lead que acabou de ser movido PELO
 * PAINEL. Sempre cancela o que ainda estava pendente pro lead (a régua da
 * etapa anterior morre no movimento novo). Cancel+insert rodam numa TRANSAÇÃO
 * serializada por lead (RPC funil_enfileirar com advisory lock): dois
 * movimentos quase simultâneos nunca duplicam a sequência nem zeram as duas.
 * Best-effort: nunca lança.
 */
export async function enfileirarSequencia(
  telefone: string,
  etapaKey: string,
): Promise<{ enfileiradas: number }> {
  try {
    const supabase = getClient();
    const variantes = variantesTelefone(telefone);

    // O telefone da fila é o MESMO gravado em ff_contatos (o cron faz join).
    const contatoRes = await supabase
      .from("ff_contatos")
      .select("telefone")
      .in("telefone", variantes)
      .limit(1);
    const alvo =
      (contatoRes.data?.[0] as { telefone?: string } | undefined)?.telefone ?? telefone;

    const res = await supabase.rpc("funil_enfileirar", {
      p_tels: variantes,
      p_alvo: alvo,
      p_etapa: etapaKey,
    });
    if (res.error) throw new Error(res.error.message);
    return { enfileiradas: Number(res.data) || 0 };
  } catch (e) {
    console.error("[funil] enfileirarSequencia:", e);
    return { enfileiradas: 0 };
  }
}
