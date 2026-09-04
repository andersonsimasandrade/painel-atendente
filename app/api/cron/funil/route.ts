import { NextResponse } from "next/server";
import { getClient, getPainelConfig, inserirMensagemPainel } from "@/lib/db";
import { enviarTextoInstancia } from "@/lib/evolution";
import { canalDaConversa } from "@/lib/consultores";
import { chamarPausaWebhook, lerPausaWebhook } from "@/lib/painel-pausa";
import { variantesTelefone } from "@/lib/telefone";
import type { HorarioBot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Primeiro nome apresentável ("MARIA CLARA" -> "Maria"); vazio se não houver.
// Um valor genérico gravado por engano NÃO é nome: sem esta lista, o robô
// cumprimenta o cliente com "Oi Desconhecido!".
const NOME_LIXO = new Set([
  "desconhecido", "desconhecida", "unknown", "sem", "nao", "cliente",
  "lead", "contato", "anonimo", "anonima",
]);
function primeiroNome(nome: string | null): string {
  const n = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!n) return "";
  const chave = n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (NOME_LIXO.has(chave)) return "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

// Aplica {nome} (via função — $&/$' no nome não corrompem); sem nome, remove o
// placeholder e conserta a pontuação, preservando quebras de linha.
function render(template: string, nome: string | null): string {
  const p = primeiroNome(nome);
  let t = p
    ? template.replaceAll("{nome}", () => p)
    : template.replace(/[,;]?[ \t]*\{nome\}[ \t]*[,;]?/g, "");
  t = t
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([!?.,;:])/g, "$1")
    .replace(/^[ \t,;:.!?]+/, "")
    .trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// Dentro do horário comercial do bot? null = pode enviar agora; senão devolve
// a PRÓXIMA abertura (as sequências respeitam o mesmo expediente do robô).
// Brasil não tem horário de verão desde 2019 — SP é UTC-3 fixo.
function proximaAbertura(hb: HorarioBot | null, agora: Date): Date | null {
  if (!hb?.ativo || !hb.dias.length) return null;
  const SP_OFF = 3 * 60 * 60 * 1000;
  const sp = new Date(agora.getTime() - SP_OFF);
  const [hi, mi] = hb.inicio.split(":").map((x) => Number(x) || 0);
  const [hf, mf] = hb.fim.split(":").map((x) => Number(x) || 0);
  const minAgora = sp.getUTCHours() * 60 + sp.getUTCMinutes();
  if (hb.dias.includes(sp.getUTCDay()) && minAgora >= hi * 60 + mi && minAgora < hf * 60 + mf) {
    return null;
  }
  for (let d = 0; d < 8; d++) {
    const cand = new Date(sp.getTime() + d * 86400000);
    if (!hb.dias.includes(cand.getUTCDay())) continue;
    const abre =
      Date.UTC(cand.getUTCFullYear(), cand.getUTCMonth(), cand.getUTCDate(), hi, mi) + SP_OFF;
    if (abre > agora.getTime()) return new Date(abre);
  }
  return null; // config sem dia válido: não adia (fail-open, igual ao bot)
}

// Processa a fila de sequências do funil (funil_envios). Chamado a cada minuto
// por um workflow n8n (Schedule → HTTP POST) com Bearer <CRON_SECRET> — mesmo
// contrato do /api/cron/lembretes. No máximo 3 envios por tique, com pausa
// entre eles (anti-rajada).
//
// Concorrência: cada linha é REIVINDICADA (pendente→processando) antes do
// envio — o row lock do Postgres garante que só um tique vence; linhas
// 'processando' encontradas no INÍCIO de um tique são de execução morta e
// viram 'falhou' (preferimos perder um envio a mandar em dobro).
//
// Cancelamentos na hora do envio: lead saiu da etapa (inclusive movido pelo
// bot), lead respondeu, consultor assumiu (mandou mensagem pelo painel ou
// celular), conversa pausada. Fora do horário comercial do bot, os envios
// devidos são ADIADOS para a próxima abertura.
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getClient();
  const agora = new Date();
  const inicioTique = Date.now(); // orçamento: não reivindicar perto do kill

  // Órfãos de tiques mortos (função derrubada entre enviar e marcar).
  await supabase
    .from("funil_envios")
    .update({ status: "falhou", motivo: "interrompido (tique anterior morreu)" })
    .eq("status", "processando");
  await supabase
    .from("msgs_agendadas")
    .update({ status: "falhou", motivo: "interrompido (tique anterior morreu)" })
    .eq("status", "processando");

  const config = await getPainelConfig();

  // Fora do expediente do bot? SEQUÊNCIAS são adiadas pra abertura; mensagens
  // AGENDADAS não — o horário delas foi escolhido por uma pessoa.
  const abertura = proximaAbertura(config.horario_bot, agora);
  let seqAdiadas = 0;
  if (abertura) {
    const adiou = await supabase
      .from("funil_envios")
      .update({ enviar_em: abertura.toISOString() })
      .eq("status", "pendente")
      .lte("enviar_em", agora.toISOString())
      .select("id");
    seqAdiadas = adiou.data?.length ?? 0;
  }

  const dueRes = abertura
    ? { data: [], error: null as { message: string } | null }
    : await supabase
    .from("funil_envios")
    .select("id, telefone, etapa_key, texto, criado_em")
    .eq("status", "pendente")
    .lte("enviar_em", agora.toISOString())
    .order("enviar_em", { ascending: true })
    .order("id", { ascending: true })
    .limit(3);
  if (dueRes.error) {
    return NextResponse.json({ ok: false, error: dueRes.error.message }, { status: 500 });
  }
  const due = (dueRes.data ?? []) as {
    id: number;
    telefone: string;
    etapa_key: string;
    texto: string;
    criado_em: string;
  }[];

  // Instância do consultor dono do lead (cache por slug dentro do tique).
  const instanciaPorSlug = new Map<string, string>();
  async function instanciaDe(slug: string | null): Promise<string> {
    const fallback = (process.env.EVOLUTION_INSTANCE ?? "").trim();
    if (!slug) return fallback;
    if (instanciaPorSlug.has(slug)) return instanciaPorSlug.get(slug)!;
    const res = await supabase
      .from("vendedores")
      .select("instancia_whatsapp")
      .eq("slug", slug)
      .limit(1);
    const inst =
      (res.data?.[0] as { instancia_whatsapp?: string } | undefined)?.instancia_whatsapp ||
      fallback;
    instanciaPorSlug.set(slug, inst);
    return inst;
  }

  // Só linhas 'processando' (reivindicadas por ESTE tique) podem mudar aqui.
  async function marcar(id: number, status: string, motivo?: string) {
    const res = await supabase
      .from("funil_envios")
      .update({
        status,
        motivo: motivo ?? null,
        enviado_em: status === "enviado" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .eq("status", "processando");
    if (res.error) console.error("[cron/funil] marcar falhou:", id, status, res.error.message);
  }

  let enviados = 0;
  let cancelados = 0;
  let falhas = 0;

  for (let i = 0; i < due.length; i++) {
    const r = due[i];

    // Reivindica a linha; se outro tique venceu, pula sem enviar.
    const claim = await supabase
      .from("funil_envios")
      .update({ status: "processando" })
      .eq("id", r.id)
      .eq("status", "pendente")
      .select("id");
    if (claim.error || !claim.data?.length) continue;

    const variantes = variantesTelefone(r.telefone);

    const cRes = await supabase
      .from("ff_contatos")
      .select("telefone, nome, funnel_stage, vendedor_slug")
      .in("telefone", variantes)
      .limit(1);
    const c = (cRes.data?.[0] ?? null) as {
      telefone: string;
      nome: string | null;
      funnel_stage: string | null;
      vendedor_slug: string | null;
    } | null;

    if (!c) {
      await marcar(r.id, "falhou", "lead não encontrado");
      falhas++;
      continue;
    }
    if ((c.funnel_stage ?? "") !== r.etapa_key) {
      await marcar(r.id, "cancelado", "lead saiu da etapa");
      cancelados++;
      continue;
    }

    // "Lead respondeu?" — mensagens DO LEAD (type human) depois do movimento.
    // ff_contatos.ultima_interacao NÃO serve: ela também sobe com saídas do
    // bot/consultor (verificado no banco) e cancelaria a sequência à toa.
    const respRes = await supabase
      .from("n8n_chat_histories")
      .select("id")
      .in("session_id", variantes)
      .eq("message->>type", "human")
      .gt("created_at", r.criado_em)
      .limit(1);
    if ((respRes.data ?? []).length > 0) {
      await marcar(r.id, "cancelado", "lead respondeu");
      cancelados++;
      continue;
    }

    // "Consultor assumiu?" — saída HUMANA (painel/celular) depois do movimento.
    const humRes = await supabase
      .from("n8n_chat_histories")
      .select("id")
      .in("session_id", variantes)
      .eq("message->>type", "ai")
      .in("message->additional_kwargs->>sent_by", ["painel", "celular"])
      .gt("created_at", r.criado_em)
      .limit(1);
    if ((humRes.data ?? []).length > 0) {
      await marcar(r.id, "cancelado", "consultor assumiu a conversa");
      cancelados++;
      continue;
    }

    // Conversa pausada (humano no comando) — não atropela com automação.
    const pausa = await lerPausaWebhook(c.telefone);
    if (pausa.pausado === true) {
      await marcar(r.id, "cancelado", "conversa pausada (atendimento humano)");
      cancelados++;
      continue;
    }

    const texto = render(r.texto, c.nome);
    if (!texto) {
      await marcar(r.id, "cancelado", "mensagem vazia após placeholders");
      cancelados++;
      continue;
    }

    const instancia = await instanciaDe(c.vendedor_slug);
    const env = await enviarTextoInstancia(instancia, c.telefone, texto);
    if (env.ok) {
      await marcar(r.id, "enviado");
      enviados++;
      // Espelha na conversa do painel (e na memória do bot) como saída
      // automática — sem sent_by: nas métricas de atendimento NÃO conta
      // como resposta humana, de propósito.
      try {
        const sessRes = await supabase
          .from("n8n_chat_histories")
          .select("session_id")
          .in("session_id", variantes)
          .limit(1);
        const sessao =
          (sessRes.data?.[0] as { session_id?: string } | undefined)?.session_id ?? c.telefone;
        await supabase.from("n8n_chat_histories").insert({
          session_id: sessao,
          message: {
            type: "ai",
            content: texto,
            tool_calls: [],
            additional_kwargs: { via: "sequencia_funil", etapa: r.etapa_key },
            response_metadata: {},
            invalid_tool_calls: [],
          },
        });
      } catch (e) {
        console.error("[cron/funil] log painel:", e);
      }
    } else {
      await marcar(r.id, "falhou", (env.error ?? "envio falhou").slice(0, 200));
      falhas++;
    }

    if (i < due.length - 1) await sleep(1500); // anti-rajada entre envios
  }

  // ── Mensagens AGENDADAS pelo consultor (msgs_agendadas) ──────────────────
  // Espelham o /enviar manual: pausa o bot, envia pelo número da conversa com
  // assinatura, registra como sent_by 'painel' (aparece como "Você" e conta
  // como resposta humana — a pessoa escreveu). Sem cancelamento automático:
  // horário e conteúdo foram escolhidos por gente.
  let agEnviadas = 0;
  let agFalhas = 0;
  const agRes = await supabase
    .from("msgs_agendadas")
    .select("id, telefone, texto, criado_por")
    .eq("status", "pendente")
    .lte("enviar_em", agora.toISOString())
    .order("enviar_em", { ascending: true })
    .order("id", { ascending: true })
    .limit(40);
  const agTodas = (agRes.data ?? []) as {
    id: number;
    telefone: string;
    texto: string;
    criado_por: string | null;
  }[];
  // Round-robin por quem agendou: um consultor com fila grande não atrasa o
  // agendamento pontual do outro. 2 envios por tique, como antes.
  const agDue: typeof agTodas = [];
  const vistos = new Set<string>();
  for (const r of agTodas) {
    if (agDue.length >= 2) break;
    const quem = r.criado_por ?? "";
    if (!vistos.has(quem)) {
      vistos.add(quem);
      agDue.push(r);
    }
  }
  for (const r of agTodas) {
    if (agDue.length >= 2) break;
    if (!agDue.includes(r)) agDue.push(r);
  }

  async function marcarAg(id: number, status: string, motivo?: string) {
    const res = await supabase
      .from("msgs_agendadas")
      .update({
        status,
        motivo: motivo ?? null,
        enviado_em: status === "enviada" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .eq("status", "processando");
    if (res.error) console.error("[cron/funil] marcarAg falhou:", id, status, res.error.message);
  }

  for (let i = 0; i < agDue.length; i++) {
    const r = agDue[i];
    // Orçamento de tempo: perto do maxDuration NÃO reivindica — a linha segue
    // 'pendente' e o próximo tique (1 min) envia. Melhor atrasar 1 min do que
    // ser morto entre o claim e o envio e perder a mensagem.
    if (Date.now() - inicioTique > 30_000) break;
    if (enviados + agEnviadas > 0) await sleep(1500);

    const claim = await supabase
      .from("msgs_agendadas")
      .update({ status: "processando" })
      .eq("id", r.id)
      .eq("status", "pendente")
      .select("id");
    if (claim.error || !claim.data?.length) continue;

    const cRes = await supabase
      .from("ff_contatos")
      .select("nome")
      .in("telefone", variantesTelefone(r.telefone))
      .limit(1);
    const nomeLead = (cRes.data?.[0] as { nome?: string | null } | undefined)?.nome ?? null;

    // Texto HUMANO, vai verbatim — só o {nome} é substituído (via função:
    // $& / $' num nome não corrompem). Nada do pipeline de limpeza de template.
    const p = primeiroNome(nomeLead);
    const texto = r.texto.replaceAll("{nome}", () => p).trim();
    if (!texto) {
      await marcarAg(r.id, "falhou", "mensagem vazia após placeholders");
      agFalhas++;
      continue;
    }

    // Mesma sequência do /enviar: pausa ANTES (a resposta do lead é pro humano).
    await chamarPausaWebhook(r.telefone, "pause");
    const canal = await canalDaConversa(r.telefone);
    const assinatura = (config.atendente_nome ?? "").trim() || canal.nome;
    const textoEnvio = config.assinar && assinatura ? `*${assinatura}:*\n${texto}` : texto;

    const env = await enviarTextoInstancia(canal.instancia, r.telefone, textoEnvio);
    if (env.ok) {
      await marcarAg(r.id, "enviada");
      agEnviadas++;
      // Registro na conversa: retry único; se ainda falhar, deixa auditado no
      // motivo (a mensagem SAIU — o pior seria o consultor reenviar à mão).
      let rec = await inserirMensagemPainel(r.telefone, texto);
      if (!rec.ok) rec = await inserirMensagemPainel(r.telefone, texto);
      if (!rec.ok) {
        console.error("[cron/funil] log agendada:", rec.error);
        await supabase
          .from("msgs_agendadas")
          .update({ motivo: "enviada, mas não registrada na conversa do painel" })
          .eq("id", r.id)
          .eq("status", "enviada");
      }
    } else {
      await marcarAg(r.id, "falhou", (env.error ?? "envio falhou").slice(0, 200));
      agFalhas++;
    }
  }

  return NextResponse.json({
    ok: true,
    enviados,
    cancelados,
    falhas,
    devidos: due.length,
    seqAdiadas,
    agendadas: { enviadas: agEnviadas, falhas: agFalhas, devidas: agDue.length },
  });
}

export const POST = handler;
export const GET = handler;
