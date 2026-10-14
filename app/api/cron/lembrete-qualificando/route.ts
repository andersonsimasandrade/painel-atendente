import { NextResponse } from "next/server";
import { getClient, getPainelConfig } from "@/lib/db";
import { enviarTextoInstancia } from "@/lib/evolution";
import { lerPausaWebhook } from "@/lib/painel-pausa";
import { variantesTelefone } from "@/lib/telefone";
import type { HorarioBot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// LEMBRETE ÚNICO de 4h para quem começou a conversa e parou no meio
// (etapa "qualificando": o robô ainda não repassou o paciente).
//
// Chamado a cada 15 min por um workflow do n8n (Bearer CRON_SECRET), como as
// outras rotinas. Regras — o lembrete só sai se TUDO for verdadeiro:
//   • lead em "qualificando", não fechado, sem resultado marcado
//   • nunca recebeu lembrete (followup_count = 0): é UM só, nunca insiste
//   • a ÚLTIMA mensagem da conversa é do robô e o paciente não escreve há ≥ 4h
//   • passaram no máximo 36h (depois disso o assunto esfriou, não incomoda)
//   • ninguém da equipe falou pelo painel/celular; conversa não está pausada
//   • estamos dentro do expediente (se não, espera abrir — não manda de madrugada)
// Máximo 3 envios por execução, com pausa entre eles.

const HORAS_MIN = 4;
const HORAS_MAX = 36;

const TEXTO =
  "Oi{nome}! Passando para ver se ficou alguma dúvida 🙂\n\n" +
  "Se quiser agendar a sua avaliação, é só me dizer quais dias e horários ficam melhores para você " +
  "(e, se puder, uma segunda opção). Aí eu passo para o Anderson confirmar com você.";

const NOME_LIXO = new Set([
  "desconhecido", "desconhecida", "unknown", "sem", "nao", "cliente", "lead", "contato", "anonimo", "anonima",
]);
function primeiroNome(nome: string | null): string {
  const n = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!n) return "";
  const chave = n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (NOME_LIXO.has(chave)) return "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

// Dentro do expediente do robô? (SP = UTC-3 fixo.)
function dentroDoExpediente(hb: HorarioBot | null, agora: Date): boolean {
  if (!hb?.ativo || !hb.dias.length) return true; // sem config: não bloqueia (igual ao robô)
  const sp = new Date(agora.getTime() - 3 * 3600 * 1000);
  const [hi, mi] = hb.inicio.split(":").map((x) => Number(x) || 0);
  const [hf, mf] = hb.fim.split(":").map((x) => Number(x) || 0);
  const min = sp.getUTCHours() * 60 + sp.getUTCMinutes();
  return hb.dias.includes(sp.getUTCDay()) && min >= hi * 60 + mi && min < hf * 60 + mf;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Diário da rotina (tabela cron_log): uma linha por execução, para saber o que ela decidiu.
async function diario(resumo: Record<string, unknown>) {
  try {
    const supabase = getClient();
    await supabase.from("cron_log").insert({ rota: "lembrete-qualificando", resumo });
    await supabase
      .from("cron_log")
      .delete()
      .eq("rota", "lembrete-qualificando")
      .lt("criado_em", new Date(Date.now() - 7 * 86400000).toISOString());
  } catch (e) {
    console.error("[cron/lembrete-qualificando] cron_log:", e);
  }
}

type Msg = { type: string | null; sent_by: string | null; created_at: string };

async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getClient();
  const agora = new Date();
  const config = await getPainelConfig();
  if (!dentroDoExpediente(config.horario_bot, agora)) {
    await diario({ enviados: 0, motivo: "fora do expediente" });
    return NextResponse.json({ ok: true, enviados: 0, motivo: "fora do expediente" });
  }

  const desde = new Date(agora.getTime() - HORAS_MAX * 3600 * 1000).toISOString();
  const ate = new Date(agora.getTime() - HORAS_MIN * 3600 * 1000).toISOString();
  const cRes = await supabase
    .from("ff_contatos")
    .select("telefone, nome, ultima_instancia, vendedor_slug, followup_count")
    .eq("funnel_stage", "qualificando")
    .eq("fechado", false)
    .is("resultado", null)
    .or("followup_count.is.null,followup_count.eq.0")
    .gte("ultima_interacao", desde)
    .lte("ultima_interacao", ate)
    .order("ultima_interacao", { ascending: true })
    .limit(15);
  if (cRes.error) {
    await diario({ erro: cRes.error.message });
    return NextResponse.json({ ok: false, error: cRes.error.message }, { status: 500 });
  }
  const candidatos = (cRes.data ?? []) as {
    telefone: string;
    nome: string | null;
    ultima_instancia: string | null;
    vendedor_slug: string | null;
  }[];

  let enviados = 0;
  const motivos: Record<string, number> = {};
  const pula = (m: string) => (motivos[m] = (motivos[m] ?? 0) + 1);

  for (const c of candidatos) {
    if (enviados >= 3) break;
    const variantes = variantesTelefone(c.telefone);

    // Última mensagem da conversa e quem a escreveu.
    const hRes = await supabase
      .from("n8n_chat_histories")
      .select("session_id, created_at, type:message->>type, sent_by:message->additional_kwargs->>sent_by")
      .in("session_id", variantes)
      .order("id", { ascending: false })
      .limit(12);
    const msgs = (hRes.data ?? []) as unknown as (Msg & { session_id: string })[];
    if (!msgs.length) { pula("sem histórico"); continue; }
    const ultima = msgs[0];
    if (ultima.type !== "ai") { pula("paciente falou por último"); continue; }
    if (msgs.some((m) => m.type === "ai" && (m.sent_by === "painel" || m.sent_by === "celular"))) {
      pula("equipe já falou"); continue;
    }
    const ult = new Date(ultima.created_at).getTime();
    if (agora.getTime() - ult < HORAS_MIN * 3600 * 1000) { pula("ainda cedo"); continue; }

    const pausa = await lerPausaWebhook(c.telefone);
    if (pausa.pausado !== false) { pula(pausa.pausado ? "conversa pausada" : "estado da pausa desconhecido"); continue; }

    // Reivindica ANTES de enviar (dois ticks seguidos nunca mandam em dobro).
    const claim = await supabase
      .from("ff_contatos")
      .update({ followup_count: 1, last_followup: agora.toISOString() })
      .eq("telefone", c.telefone)
      .or("followup_count.is.null,followup_count.eq.0")
      .select("telefone");
    if (claim.error || !claim.data?.length) { pula("já reivindicado"); continue; }

    const nome = primeiroNome(c.nome);
    const texto = TEXTO.replace("{nome}", nome ? ` ${nome}` : "");
    const instancia = (c.ultima_instancia || process.env.EVOLUTION_INSTANCE || "").trim();
    const env = await enviarTextoInstancia(instancia, c.telefone, texto);
    if (!env.ok) {
      // Não conseguiu enviar: devolve a vez (tenta no próximo tique).
      await supabase.from("ff_contatos").update({ followup_count: 0, last_followup: null }).eq("telefone", c.telefone);
      pula(`falha no envio: ${(env.error ?? "sem detalhe").slice(0, 120)}`);
      continue;
    }
    enviados++;
    try {
      await supabase.from("n8n_chat_histories").insert({
        session_id: ultima.session_id,
        message: {
          type: "ai",
          content: texto,
          tool_calls: [],
          additional_kwargs: { via: "lembrete_4h" },
          response_metadata: {},
          invalid_tool_calls: [],
        },
      });
    } catch (e) {
      console.error("[cron/lembrete-qualificando] log:", e);
    }
    if (enviados < 3) await sleep(1500);
  }

  await diario({ enviados, candidatos: candidatos.length, motivos });
  return NextResponse.json({ ok: true, enviados, candidatos: candidatos.length, motivos });
}

export const POST = handler;
export const GET = handler;
