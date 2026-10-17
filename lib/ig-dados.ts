import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { getClient } from "@/lib/db";

export interface ContatoIG {
  ig_id: string;
  username: string | null;
  nome: string | null;
  estado: "robo" | "humano";
  humano_ate: string | null;
  telefone: string | null;
  origem: string;
  obs: string | null;
  estagio: string | null;
  ultima_interacao: string;
  ultimo?: { papel: string; texto: string; criado_em: string } | null;
}

export interface MensagemIG {
  id: number;
  papel: "user" | "assistant" | "humano";
  tipo: string | null;
  texto: string;
  criado_em: string;
}

/** Barra quem não tem sessão do painel (mesmo cookie do restante do painel). Retorna null se pode seguir. */
export async function barrarSemSessao(): Promise<NextResponse | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!(await verifyToken(token))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  return null;
}

const CAMPOS = "ig_id, username, nome, estado, humano_ate, telefone, origem, obs, estagio, ultima_interacao";

export async function listarContatosIG(limite = 100): Promise<ContatoIG[]> {
  const sb = getClient();
  const r = await sb.from("ig_contatos").select(CAMPOS).order("ultima_interacao", { ascending: false }).limit(limite);
  const contatos = (r.data ?? []) as ContatoIG[];
  if (!contatos.length) return [];
  const ids = contatos.map((c) => c.ig_id);
  const m = await sb
    .from("ig_mensagens")
    .select("ig_id, papel, texto, criado_em")
    .in("ig_id", ids)
    .order("id", { ascending: false })
    .limit(Math.max(300, ids.length * 6));
  const ultimo = new Map<string, { papel: string; texto: string; criado_em: string }>();
  for (const x of (m.data ?? []) as { ig_id: string; papel: string; texto: string; criado_em: string }[]) {
    if (!ultimo.has(x.ig_id)) ultimo.set(x.ig_id, { papel: x.papel, texto: x.texto, criado_em: x.criado_em });
  }
  return contatos.map((c) => ({ ...c, ultimo: ultimo.get(c.ig_id) ?? null }));
}

export async function conversaIG(igId: string, limite = 200): Promise<{ contato: ContatoIG | null; mensagens: MensagemIG[] }> {
  const sb = getClient();
  const c = await sb.from("ig_contatos").select(CAMPOS).eq("ig_id", igId).limit(1);
  const m = await sb
    .from("ig_mensagens")
    .select("id, papel, tipo, texto, criado_em")
    .eq("ig_id", igId)
    .order("id", { ascending: false })
    .limit(limite);
  return {
    contato: ((c.data ?? [])[0] ?? null) as ContatoIG | null,
    mensagens: ((m.data ?? []) as MensagemIG[]).reverse(),
  };
}

/** Conversa do Instagram ligada a um cadastro do WhatsApp (ou null se a pessoa nunca foi ligada). */
export async function instagramDoLead(telefone: string): Promise<{ contato: ContatoIG; mensagens: MensagemIG[] } | null> {
  const sb = getClient();
  const l = await sb.from("ff_contatos").select("ig_id").eq("telefone", telefone).limit(1);
  const igId = ((l.data ?? [])[0] as { ig_id: string | null } | undefined)?.ig_id;
  if (!igId) return null;
  const r = await conversaIG(igId, 14);
  return r.contato ? { contato: r.contato, mensagens: r.mensagens } : null;
}
