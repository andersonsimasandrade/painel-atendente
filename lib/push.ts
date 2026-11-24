// AVISOS NO CELULAR (notificação do app): quando chega mensagem de paciente/lead/parceiro, e 1 hora antes de cada sessão.
// Usa Web Push com chaves VAPID geradas aqui mesmo e guardadas no banco (push_config), então não precisa configurar nada à mão.
// A notificação mostra só o NOME e "nova mensagem" (sem o texto), porque a tela de bloqueio do celular é visível a terceiros e a
// conversa é dado de saúde. Server-only.
import webpush from "web-push";
import { getClient } from "./db";
import { appBaseUrl } from "./http";
import { ehNumeroInterno } from "./numeros-internos";
import { variantesTelefone } from "./telefone";
import { pareceRespostaAutomatica } from "./prospeccao";
import { avisouRecentemente, marcarAviso } from "./ratelimit";
import { CONSULTORIOS } from "./site";

export interface Aviso {
  titulo: string;
  corpo: string;
  url: string; // caminho dentro do painel, ex.: /leads/5548...
  tag?: string; // mesma tag = a notificação nova substitui a anterior
}

// ── chaves ─────────────────────────────────────────────────────────────────
async function cfg(chave: string): Promise<string | null> {
  const r = await getClient().from("push_config").select("valor").eq("chave", chave).limit(1);
  return (r.data?.[0] as { valor: string | null } | undefined)?.valor ?? null;
}
async function setCfg(chave: string, valor: string): Promise<void> {
  await getClient().from("push_config").upsert({ chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
}

let chavesEmMemoria: { publica: string; privada: string } | null = null;

async function chaves(): Promise<{ publica: string; privada: string }> {
  if (chavesEmMemoria) return chavesEmMemoria;
  let publica = await cfg("vapid_public");
  let privada = await cfg("vapid_private");
  if (!publica || !privada) {
    const k = webpush.generateVAPIDKeys();
    // insere só se ainda não existir (duas execuções ao mesmo tempo não trocam as chaves uma da outra)
    await getClient().from("push_config").upsert([{ chave: "vapid_public", valor: k.publicKey }, { chave: "vapid_private", valor: k.privateKey }], { onConflict: "chave", ignoreDuplicates: true });
    publica = await cfg("vapid_public");
    privada = await cfg("vapid_private");
  }
  if (!publica || !privada) throw new Error("Não consegui preparar as chaves dos avisos.");
  chavesEmMemoria = { publica, privada };
  return chavesEmMemoria;
}

export async function chavePublica(): Promise<string> {
  return (await chaves()).publica;
}

async function preparar(): Promise<void> {
  const k = await chaves();
  let assunto = "mailto:contato@andersonandradefisio.com.br";
  try {
    assunto = appBaseUrl();
  } catch {
    /* usa o padrão */
  }
  webpush.setVapidDetails(assunto, k.publica, k.privada);
}

// ── aparelhos ──────────────────────────────────────────────────────────────
export interface Assinatura {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function salvarAssinatura(email: string, sub: Assinatura, aparelho: string | null): Promise<boolean> {
  const r = await getClient()
    .from("push_assinaturas")
    .upsert({ email, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, aparelho: aparelho?.slice(0, 200) ?? null }, { onConflict: "endpoint" });
  return !r.error;
}

export async function removerAssinatura(endpoint: string): Promise<void> {
  await getClient().from("push_assinaturas").delete().eq("endpoint", endpoint);
}

export async function contarAparelhos(email: string): Promise<number> {
  const r = await getClient().from("push_assinaturas").select("id", { count: "exact", head: true }).eq("email", email);
  return r.count ?? 0;
}

/** Manda o aviso para todos os aparelhos cadastrados (ou só os de um e-mail). Devolve quantos receberam. */
export async function enviarAviso(a: Aviso, soEmail?: string): Promise<number> {
  await preparar();
  let q = getClient().from("push_assinaturas").select("endpoint, p256dh, auth");
  if (soEmail) q = q.eq("email", soEmail);
  const r = await q;
  let enviados = 0;
  const payload = JSON.stringify(a);
  for (const s of (r.data ?? []) as { endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
      enviados++;
      await getClient().from("push_assinaturas").update({ ultimo_envio_em: new Date().toISOString() }).eq("endpoint", s.endpoint);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await removerAssinatura(s.endpoint); // aparelho desinstalou ou desligou os avisos
      else console.error("[push] envio falhou:", status ?? (e instanceof Error ? e.message : e));
    }
  }
  return enviados;
}

// ── o que dispara avisos ───────────────────────────────────────────────────
const dig = (t: string) => t.replace(/\D/g, "");
function numeroBonito(t: string): string {
  const d = dig(t);
  return d.startsWith("55") && d.length >= 12 ? `(${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}` : t;
}

async function haAparelhos(): Promise<boolean> {
  const r = await getClient().from("push_assinaturas").select("id", { count: "exact", head: true });
  return (r.count ?? 0) > 0;
}

/** Mensagens novas que chegaram (de paciente, lead ou parceiro) desde a última volta. */
async function varrerMensagens(): Promise<void> {
  const sb = getClient();
  const ult = await sb.from("n8n_chat_histories").select("id").order("id", { ascending: false }).limit(1);
  const maxId = Number((ult.data?.[0] as { id: number } | undefined)?.id ?? 0);
  const ultimo = await cfg("ultimo_msg_id");
  if (ultimo === null) {
    await setCfg("ultimo_msg_id", String(maxId)); // primeira vez: não avisa o histórico antigo
    return;
  }
  const desde = Number(ultimo);
  if (!(maxId > desde)) return;
  if (!(await haAparelhos())) {
    await setCfg("ultimo_msg_id", String(maxId));
    return;
  }
  const r = await sb
    .from("n8n_chat_histories")
    .select("id, session_id, tipo:message->>type, texto:message->>content")
    .gt("id", desde)
    .lte("id", maxId)
    .filter("message->>type", "eq", "human")
    .order("id")
    .limit(200);
  await setCfg("ultimo_msg_id", String(maxId));

  const porConversa = new Map<string, { n: number; textos: string[] }>();
  for (const m of (r.data ?? []) as { session_id: string; texto: string | null }[]) {
    const g = porConversa.get(m.session_id) ?? { n: 0, textos: [] };
    g.n++;
    g.textos.push(m.texto ?? "");
    porConversa.set(m.session_id, g);
  }
  let avisos = 0;
  for (const [tel, g] of Array.from(porConversa)) {
    if (avisos >= 8) break; // proteção contra enxurrada
    if (!/^\d{10,15}$/.test(tel) || ehNumeroInterno(tel)) continue; // conversas do Instagram e números internos ficam de fora
    const c = await sb.from("ff_contatos").select("nome, perfil").in("telefone", variantesTelefone(tel)).limit(1);
    const ct = c.data?.[0] as { nome: string | null; perfil: string | null } | undefined;
    // Menus e boas-vindas automáticos de WhatsApp Business de parceiros não são pessoas escrevendo.
    if (ct?.perfil === "parceiro" && g.textos.every((t) => pareceRespostaAutomatica(t))) continue;
    const nome = ct?.nome?.trim() || numeroBonito(tel);
    const parceiro = ct?.perfil === "parceiro";
    await enviarAviso({
      titulo: `${parceiro ? "🤝" : "💬"} ${nome}`,
      corpo: g.n > 1 ? `${g.n} novas mensagens` : "Nova mensagem",
      url: `/leads/${tel}#conversa`,
      tag: `msg-${tel}`,
    });
    avisos++;
  }
}

/** Avisa 1 hora antes de cada sessão (uma vez por sessão). A janela de 20 min cobre as voltas do relógio; sessão marcada em cima da hora (menos de 50 min) não recebe este aviso. */
async function varrerSessoes(): Promise<void> {
  const agora = Date.now();
  const r = await getClient()
    .from("agendamentos")
    .select("id, telefone_lead, nome_lead, data_hora, local, status")
    .in("status", ["agendado", "confirmado"])
    .gte("data_hora", new Date(agora + 50 * 60000).toISOString())
    .lte("data_hora", new Date(agora + 70 * 60000).toISOString());
  for (const a of (r.data ?? []) as { id: string; telefone_lead: string; nome_lead: string | null; data_hora: string; local: string | null }[]) {
    const bucket = `pushsessao:${a.id}`;
    if (await avisouRecentemente(bucket, 3 * 3600)) continue;
    await marcarAviso(bucket);
    const c = await getClient().from("ff_contatos").select("nome").in("telefone", variantesTelefone(a.telefone_lead)).limit(1);
    const nome = ((c.data?.[0] as { nome?: string | null } | undefined)?.nome ?? a.nome_lead ?? "").trim() || numeroBonito(a.telefone_lead);
    const sp = new Date(new Date(a.data_hora).getTime() - 3 * 3600 * 1000);
    const hora = `${String(sp.getUTCHours()).padStart(2, "0")}:${String(sp.getUTCMinutes()).padStart(2, "0")}`;
    const onde = a.local === "capoeiras" || a.local === "centro" ? CONSULTORIOS[a.local].bairro : "";
    await enviarAviso({ titulo: `🕑 Sessão às ${hora}`, corpo: `${nome}${onde ? ` · ${onde}` : ""}`, url: `/leads/${a.telefone_lead}`, tag: `sessao-${a.id}` });
  }
}

// ── relógio ────────────────────────────────────────────────────────────────
const g = globalThis as unknown as { __pushRelogio?: boolean };

export function iniciarRelogioPush() {
  if (g.__pushRelogio) return;
  g.__pushRelogio = true;
  let rodando = false;
  let volta = 0;
  setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      await varrerMensagens();
      if (volta++ % 3 === 0) await varrerSessoes(); // a cada ~1 minuto
    } catch (e) {
      console.error("[push]", e instanceof Error ? e.message : e);
    } finally {
      rodando = false;
    }
  }, 20 * 1000);
}
