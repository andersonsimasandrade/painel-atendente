import { getClient, getPainelConfig } from "@/lib/db";
import { destinatariosAlerta } from "@/lib/config";
import { enviarTextoInstancia } from "@/lib/evolution";
import { PROMPT_IG } from "@/lib/ig-prompt";
import { ligarInstagramAoWhatsApp } from "@/lib/ig-ligacao";
import { enviarDM, perfilDe, respostaPrivada, responderComentario, type EventoIG } from "@/lib/instagram";
import type { HorarioBot } from "@/lib/types";

// Robô do Instagram: atende o direct e os comentários do perfil, com as mesmas regras do robô do WhatsApp.
// Chamado pelo webhook (app/api/instagram/webhook). Nunca lança erro para fora: falha = registro no log.
// INSTAGRAM_ROBO=desligado  → só registra as conversas, não responde nada.

const HUMANO_HORAS = 48; // depois de uma transferência ou de o Anderson responder, o robô fica quieto por 48 h
const LIMITE_RESPOSTAS_POR_HORA = 12;
const FORA_DO_HORARIO =
  "Olá! Obrigado pelo contato 😊 O consultório atende de segunda a sexta, das 8h às 19h. Assim que abrir, a gente te responde por aqui.";

const RESPOSTAS_PUBLICAS = [
  "Obrigado pelo comentário! 😊 Te mandei uma mensagem no direct.",
  "Que bom ter você por aqui! Te chamei no direct para ajudar.",
  "Obrigado! Enviei os detalhes no direct 🙂",
];
const BOAS_VINDAS_COMENTARIO =
  "Olá! Aqui é o assistente virtual do consultório do Anderson Andrade (fisioterapia e terapia manual, em Florianópolis). Vi o seu comentário e posso ajudar com informações e agendamento. Como posso ajudar você?";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const agoraMais = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

// ── fila por contato: dois eventos da mesma pessoa nunca rodam ao mesmo tempo ──
const filas = new Map<string, Promise<void>>();
function emFila(id: string, fn: () => Promise<void>): Promise<void> {
  const anterior = filas.get(id) ?? Promise.resolve();
  const proxima = anterior.then(fn, fn).catch((e) => console.error("[ig-robo]", e instanceof Error ? e.message : e));
  filas.set(id, proxima);
  void proxima.finally(() => {
    if (filas.get(id) === proxima) filas.delete(id);
  });
  return proxima;
}

// Dentro do expediente do robô? (SP = UTC-3 fixo.) Igual ao lembrete de 4h.
export function dentroDoExpediente(hb: HorarioBot | null, agora: Date): boolean {
  if (!hb?.ativo || !hb.dias.length) return true;
  const sp = new Date(agora.getTime() - 3 * 3600 * 1000);
  const [hi, mi] = hb.inicio.split(":").map((x) => Number(x) || 0);
  const [hf, mf] = hb.fim.split(":").map((x) => Number(x) || 0);
  const min = sp.getUTCHours() * 60 + sp.getUTCMinutes();
  return hb.dias.includes(sp.getUTCDay()) && min >= hi * 60 + mi && min < hf * 60 + mf;
}

interface Tags {
  texto: string;
  transferir: boolean;
  nome?: string;
  obs?: string;
  estagio?: string;
  cidade?: string;
  whatsapp?: string;
}

export function separarTags(bruto: string): Tags {
  const t: Tags = { texto: bruto, transferir: false };
  t.transferir = /\[TRANSFERIR\]/i.test(bruto);
  for (const m of bruto.matchAll(/\[(NOME|OBS|ESTAGIO|CIDADE|UF|WHATSAPP):\s*([^\]]*)\]/gi)) {
    const v = m[2].trim();
    if (!v) continue;
    const k = m[1].toUpperCase();
    if (k === "NOME") t.nome = v.slice(0, 80);
    else if (k === "OBS") t.obs = v.slice(0, 200);
    else if (k === "ESTAGIO") t.estagio = v.slice(0, 120);
    else if (k === "CIDADE") t.cidade = v.slice(0, 80);
    else if (k === "WHATSAPP") {
      const d = v.replace(/\D/g, "");
      if (d.length >= 10 && d.length <= 13) t.whatsapp = d;
    }
  }
  t.texto = bruto
    .replace(/\[(TRANSFERIR|NOME|OBS|ESTAGIO|CIDADE|UF|WHATSAPP)[^\]]*\]/gi, "")
    .replace(/^\s*CANAL:\s*\w+\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1000);
  return t;
}

function modelosGroq(): string[] {
  const extra = (process.env.GROQ_MODEL ?? "").trim();
  const base = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];
  return extra ? [extra, ...base.filter((m) => m !== extra)] : base;
}

async function pedirAoModelo(sistema: string, historico: { role: "user" | "assistant"; content: string }[]): Promise<string | null> {
  const key = (process.env.GROQ_API_KEY ?? "").trim();
  if (!key) return null;
  for (const model of modelosGroq()) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 500,
          messages: [{ role: "system", content: sistema }, ...historico],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) {
        console.error(`[ig-robo] modelo ${model}: ${r.status}`);
        continue;
      }
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      const c = j.choices?.[0]?.message?.content?.trim();
      if (c) return c;
    } catch (e) {
      console.error(`[ig-robo] modelo ${model}:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

async function avisarDono(texto: string) {
  const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  if (!instancia) return;
  for (const d of destinatariosAlerta()) {
    if (d.whatsapp) await enviarTextoInstancia(instancia, d.whatsapp, texto);
  }
}

interface Contato {
  ig_id: string;
  username: string | null;
  nome: string | null;
  estado: "robo" | "humano";
  humano_ate: string | null;
  aviso_fora_em: string | null;
  comentario_publico_em: string | null;
}

async function garantirContato(id: string, origem: "direct" | "comentario", username: string | null): Promise<Contato> {
  const sb = getClient();
  const r = await sb.from("ig_contatos").select("*").eq("ig_id", id).limit(1);
  const atual = (r.data?.[0] ?? null) as Contato | null;
  if (atual) {
    const upd: Record<string, unknown> = { ultima_interacao: new Date().toISOString() };
    if (!atual.username && username) upd.username = username;
    await sb.from("ig_contatos").update(upd).eq("ig_id", id);
    return { ...atual, username: atual.username ?? username };
  }
  await sb.from("ig_contatos").insert({ ig_id: id, username, origem });
  return { ig_id: id, username, nome: null, estado: "robo", humano_ate: null, aviso_fora_em: null, comentario_publico_em: null };
}

async function marcarEvento(e: EventoIG, status: string, erro?: string) {
  const sb = getClient();
  const q = sb.from("ig_eventos").update({ status, erro: erro?.slice(0, 300) ?? null });
  await (e.mid ? q.eq("mid", e.mid) : q.eq("comentario_id", e.comentario_id ?? "_"));
}

// ── eco: o próprio Anderson respondeu pelo app do Instagram → o robô cala ──
async function tratarEco(e: EventoIG) {
  const sb = getClient();
  if (e.mid) {
    const ja = await sb.from("ig_mensagens").select("id").eq("mid", e.mid).limit(1);
    if (ja.data?.length) return; // foi o próprio robô que enviou
  }
  await garantirContato(e.remetente_id, "direct", null);
  await sb
    .from("ig_contatos")
    .update({ estado: "humano", humano_ate: agoraMais(HUMANO_HORAS) })
    .eq("ig_id", e.remetente_id);
  if (e.texto) {
    await sb.from("ig_mensagens").upsert({ ig_id: e.remetente_id, papel: "humano", texto: e.texto.slice(0, 2000), mid: e.mid }, { onConflict: "mid", ignoreDuplicates: true });
  }
  await marcarEvento(e, "eco");
}

// ── mensagem no direct ──
async function tratarMensagem(e: EventoIG) {
  const sb = getClient();
  const id = e.remetente_id;
  const contato = await garantirContato(id, "direct", null);
  const texto = (e.texto ?? "").trim() || "(a pessoa enviou uma mídia sem texto: foto, vídeo, áudio ou figurinha)";

  const ins = await sb
    .from("ig_mensagens")
    .upsert({ ig_id: id, papel: "user", texto: texto.slice(0, 2000), mid: e.mid }, { onConflict: "mid", ignoreDuplicates: true })
    .select("id");
  if (ins.error || !ins.data?.length) return; // repetida
  const meuId = Number(ins.data[0].id);

  if ((process.env.INSTAGRAM_ROBO ?? "").trim().toLowerCase() === "desligado") return void (await marcarEvento(e, "robo_desligado"));

  // nome e @ (uma vez só, sem travar o atendimento)
  if (!contato.username || !contato.nome) {
    const p = await perfilDe(id);
    if (p.username || p.nome) {
      await sb.from("ig_contatos").update({ username: contato.username ?? p.username, nome: contato.nome ?? p.nome }).eq("ig_id", id);
      contato.username = contato.username ?? p.username;
      contato.nome = contato.nome ?? p.nome;
    }
  }

  if (contato.estado === "humano") {
    if (contato.humano_ate && new Date(contato.humano_ate).getTime() > Date.now()) return void (await marcarEvento(e, "humano"));
    await sb.from("ig_contatos").update({ estado: "robo", humano_ate: null }).eq("ig_id", id);
  }

  // fora do expediente: um aviso por 12 h e mais nada
  const cfg = await getPainelConfig();
  if (!dentroDoExpediente(cfg.horario_bot, new Date())) {
    const ultimo = contato.aviso_fora_em ? new Date(contato.aviso_fora_em).getTime() : 0;
    if (Date.now() - ultimo > 12 * 3600 * 1000) {
      const r = await enviarDM(id, FORA_DO_HORARIO);
      if (r.ok) {
        await sb.from("ig_contatos").update({ aviso_fora_em: new Date().toISOString() }).eq("ig_id", id);
        await sb.from("ig_mensagens").insert({ ig_id: id, papel: "assistant", texto: FORA_DO_HORARIO, mid: r.id ?? null, tipo: "aviso_fora" });
      }
      await marcarEvento(e, r.ok ? "fora_do_horario" : "erro_envio", r.erro);
    } else await marcarEvento(e, "fora_do_horario");
    return;
  }

  // junta mensagens em sequência: espera um pouco e só o último evento responde
  await sleep(3500);
  const nova = await sb.from("ig_mensagens").select("id").eq("ig_id", id).eq("papel", "user").gt("id", meuId).limit(1);
  if (nova.data?.length) return void (await marcarEvento(e, "agrupada"));

  const hora = new Date(Date.now() - 3600 * 1000).toISOString();
  const recentes = await sb.from("ig_mensagens").select("id", { count: "exact", head: true }).eq("ig_id", id).eq("papel", "assistant").gte("criado_em", hora);
  if ((recentes.count ?? 0) >= LIMITE_RESPOSTAS_POR_HORA) return void (await marcarEvento(e, "limite"));

  const h = await sb.from("ig_mensagens").select("papel, texto").eq("ig_id", id).order("id", { ascending: false }).limit(14);
  const historico = ((h.data ?? []) as { papel: string; texto: string }[])
    .reverse()
    .map((m) => ({ role: (m.papel === "user" ? "user" : "assistant") as "user" | "assistant", content: m.texto }));

  const sistema = PROMPT_IG.replace("__NOME__", contato.nome?.split(" ")[0] || "DESCONHECIDO");
  const bruto = await pedirAoModelo(sistema, historico);
  if (!bruto) {
    await marcarEvento(e, "erro_modelo");
    await avisarDono(`⚠️ Instagram: não consegui responder ${contato.username ? "@" + contato.username : "uma pessoa"} (falha do modelo). Última mensagem: "${texto.slice(0, 160)}". Responda pelo Instagram.`);
    return;
  }
  const tags = separarTags(bruto);
  if (!tags.texto) return void (await marcarEvento(e, "vazio"));

  const env = await enviarDM(id, tags.texto);
  if (!env.ok) {
    await marcarEvento(e, "erro_envio", env.erro);
    await avisarDono(`⚠️ Instagram: a resposta para ${contato.username ? "@" + contato.username : "uma pessoa"} não saiu (${(env.erro ?? "erro").slice(0, 120)}). Responda pelo Instagram.`);
    return;
  }
  await sb.from("ig_mensagens").insert({ ig_id: id, papel: "assistant", texto: tags.texto, mid: env.id ?? null });
  await marcarEvento(e, "respondido");

  const upd: Record<string, unknown> = {};
  if (tags.nome) upd.nome = tags.nome;
  if (tags.obs) upd.obs = tags.obs;
  if (tags.estagio) upd.estagio = tags.estagio;
  if (tags.cidade) upd.cidade = tags.cidade;
  if (tags.whatsapp) upd.whatsapp = tags.whatsapp;
  if (tags.transferir) {
    upd.estado = "humano";
    upd.humano_ate = agoraMais(HUMANO_HORAS);
  }
  if (Object.keys(upd).length) await sb.from("ig_contatos").update(upd).eq("ig_id", id);
  // A pessoa passou o WhatsApp: liga as duas conversas (o cadastro do WhatsApp passa a mostrar o Instagram).
  if (tags.whatsapp) {
    const lig = await ligarInstagramAoWhatsApp(id, tags.whatsapp).catch(() => null);
    if (lig && !lig.ok) console.error("[ig-robo] ligação com o WhatsApp:", lig.erro);
  }

  if (tags.transferir) {
    const quem = contato.username ? `@${contato.username}` : `código ${id}`;
    const linhas = [
      `📩 Instagram: ${tags.nome || contato.nome || quem} quer falar com você.`,
      tags.obs ? `Resumo: ${tags.obs}` : "",
      tags.estagio ? `Situação: ${tags.estagio}` : "",
      tags.whatsapp ? `WhatsApp informado: ${tags.whatsapp}` : "",
      contato.username ? `Perfil: https://instagram.com/${contato.username}` : "",
      "O robô parou de responder essa conversa. Responda pelo direct do Instagram.",
    ].filter(Boolean);
    await avisarDono(linhas.join("\n"));
  }
}

// ── comentário numa publicação ──
function comentarioMerece(texto: string | null): boolean {
  if (!texto) return false;
  const limpo = texto.replace(/@\w[\w.]*/g, " ").trim();
  if (!/\p{L}{3,}/u.test(limpo)) return false; // só emoji, marcação ou "kkk"
  if (/https?:|www\.|\.com\b|\.br\b|ganhe|sorteio|seguidores|renda extra|chama no (dm|pv)/i.test(texto)) return false; // spam
  return true;
}

async function tratarComentario(e: EventoIG) {
  const sb = getClient();
  if ((process.env.INSTAGRAM_ROBO ?? "").trim().toLowerCase() === "desligado") return void (await marcarEvento(e, "robo_desligado"));
  if (!e.comentario_id || !comentarioMerece(e.texto)) return void (await marcarEvento(e, "ignorado"));

  const contato = await garantirContato(e.remetente_id, "comentario", e.remetente_user);
  const ultimo = contato.comentario_publico_em ? new Date(contato.comentario_publico_em).getTime() : 0;
  if (Date.now() - ultimo < 24 * 3600 * 1000) return void (await marcarEvento(e, "ignorado"));
  if (contato.estado === "humano" && contato.humano_ate && new Date(contato.humano_ate).getTime() > Date.now()) {
    return void (await marcarEvento(e, "humano"));
  }

  // primeiro a mensagem privada (é ela que abre o direct); só então a resposta pública prometendo "te chamei no direct"
  const priv = await respostaPrivada(e.comentario_id, BOAS_VINDAS_COMENTARIO);
  if (!priv.ok) return void (await marcarEvento(e, "erro_envio", priv.erro));
  await sb.from("ig_mensagens").insert({ ig_id: e.remetente_id, papel: "assistant", texto: BOAS_VINDAS_COMENTARIO, mid: priv.id ?? null, tipo: "boas_vindas" });
  const n = [...e.comentario_id].reduce((a, c) => a + c.charCodeAt(0), 0) % RESPOSTAS_PUBLICAS.length;
  const pub = await responderComentario(e.comentario_id, RESPOSTAS_PUBLICAS[n]);
  await sb.from("ig_contatos").update({ comentario_publico_em: new Date().toISOString() }).eq("ig_id", e.remetente_id);
  await marcarEvento(e, pub.ok ? "respondido" : "respondido_sem_publica", pub.erro);
}

/** Ponto de entrada: processa os eventos novos (cada pessoa em fila própria). Nunca lança erro. */
export async function processarEventos(eventos: EventoIG[]): Promise<void> {
  await Promise.all(
    eventos.map((e) =>
      emFila(e.remetente_id || "sem-id", async () => {
        try {
          if (e.tipo === "eco") await tratarEco(e);
          else if (e.tipo === "mensagem") await tratarMensagem(e);
          else if (e.tipo === "comentario") await tratarComentario(e);
        } catch (err) {
          console.error("[ig-robo] evento:", err instanceof Error ? err.message : err);
          await marcarEvento(e, "erro", err instanceof Error ? err.message : "erro").catch(() => undefined);
        }
      }),
    ),
  );
}
