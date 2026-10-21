import { getClient, getPainelConfig } from "@/lib/db";
import { enviarDM } from "@/lib/instagram";
import { dentroDoExpediente } from "@/lib/ig-robo";

// LEMBRETE ÚNICO de 4h no Instagram para quem começou a conversa e parou no meio (igual ao do WhatsApp).
// Chamado a cada 15 min pelo relógio interno do painel (lib/ig-relogio.ts) ou pela rota /api/cron/lembrete-instagram. O lembrete só sai se TUDO for verdadeiro:
//   • a pessoa já escreveu e o robô respondeu (a última mensagem da conversa é uma resposta do robô, não um aviso automático)
//   • nunca recebeu lembrete (lembrete_em vazio): é UM só
//   • a pessoa não escreve há ≥ 4 h e, no máximo, 22 h (a Meta só permite responder em até 24 h)
//   • o robô não está pausado (conversa não foi passada ao Anderson, nem ele respondeu pelo app)
//   • estamos dentro do expediente
// Máximo 3 envios por execução.

const HORAS_MIN = 4;
const HORAS_MAX = 22;
const TEXTO =
  "Oi{nome}! Passando para ver se ficou alguma dúvida 🙂\n\n" +
  "Se quiser agendar a sua consulta, é só me dizer quais dias e horários ficam melhores para você " +
  "(e, se puder, uma segunda opção). Aí eu passo para o Anderson confirmar com você.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function diario(resumo: Record<string, unknown>) {
  try {
    const sb = getClient();
    await sb.from("cron_log").insert({ rota: "lembrete-instagram", resumo });
  } catch (e) {
    console.error("[cron/lembrete-instagram] cron_log:", e);
  }
}


export interface ResultadoLembreteIG {
  ok: boolean;
  enviados?: number;
  candidatos?: number;
  motivo?: string;
  motivos?: Record<string, number>;
  erro?: string;
}

export async function rodarLembreteInstagram(): Promise<ResultadoLembreteIG> {
  if ((process.env.INSTAGRAM_ROBO ?? "").trim().toLowerCase() === "desligado") {
    return { ok: true, enviados: 0, motivo: "robô do Instagram desligado" };
  }
  const agora = new Date();
  const cfg = await getPainelConfig();
  if (!dentroDoExpediente(cfg.horario_bot, agora)) {
    await diario({ enviados: 0, motivo: "fora do expediente" });
    return { ok: true, enviados: 0, motivo: "fora do expediente" };
  }

  const sb = getClient();
  const desde = new Date(agora.getTime() - HORAS_MAX * 3600 * 1000).toISOString();
  const ate = new Date(agora.getTime() - HORAS_MIN * 3600 * 1000).toISOString();
  const c = await sb
    .from("ig_contatos")
    .select("ig_id, nome, username, estado, humano_ate")
    .is("lembrete_em", null)
    .gte("ultima_interacao", desde)
    .lte("ultima_interacao", ate)
    .order("ultima_interacao", { ascending: true })
    .limit(15);
  if (c.error) {
    await diario({ erro: c.error.message });
    return { ok: false, erro: c.error.message };
  }

  let enviados = 0;
  const motivos: Record<string, number> = {};
  const pula = (m: string) => (motivos[m] = (motivos[m] ?? 0) + 1);
  const candidatos = (c.data ?? []) as { ig_id: string; nome: string | null; username: string | null; estado: string; humano_ate: string | null }[];

  for (const ct of candidatos) {
    if (enviados >= 3) break;
    if (ct.estado === "humano" && ct.humano_ate && new Date(ct.humano_ate).getTime() > agora.getTime()) {
      pula("conversa com o Anderson");
      continue;
    }
    const h = await sb
      .from("ig_mensagens")
      .select("papel, tipo, criado_em")
      .eq("ig_id", ct.ig_id)
      .order("id", { ascending: false })
      .limit(10);
    const msgs = (h.data ?? []) as { papel: string; tipo: string | null; criado_em: string }[];
    if (!msgs.length) {
      pula("sem histórico");
      continue;
    }
    const ultima = msgs[0];
    if (ultima.papel !== "assistant" || ultima.tipo) {
      pula(ultima.papel !== "assistant" ? "pessoa falou por último" : "só aviso automático");
      continue;
    }
    if (msgs.some((m) => m.papel === "humano")) {
      pula("Anderson já respondeu");
      continue;
    }
    const ultimaDela = msgs.find((m) => m.papel === "user");
    if (!ultimaDela) {
      pula("pessoa nunca escreveu");
      continue;
    }
    const t = new Date(ultimaDela.criado_em).getTime();
    if (agora.getTime() - t > HORAS_MAX * 3600 * 1000) {
      pula("janela de 24 h perto de fechar");
      continue;
    }
    if (agora.getTime() - new Date(ultima.criado_em).getTime() < HORAS_MIN * 3600 * 1000) {
      pula("ainda cedo");
      continue;
    }

    // Reivindica ANTES de enviar (dois ticks seguidos nunca mandam em dobro).
    const claim = await sb
      .from("ig_contatos")
      .update({ lembrete_em: agora.toISOString() })
      .eq("ig_id", ct.ig_id)
      .is("lembrete_em", null)
      .select("ig_id");
    if (claim.error || !claim.data?.length) {
      pula("já reivindicado");
      continue;
    }

    const primeiro = (ct.nome ?? "").trim().split(/\s+/)[0] ?? "";
    const texto = TEXTO.replace("{nome}", primeiro ? ` ${primeiro}` : "");
    const env = await enviarDM(ct.ig_id, texto);
    if (!env.ok) {
      await sb.from("ig_contatos").update({ lembrete_em: null }).eq("ig_id", ct.ig_id); // devolve a vez
      pula(`falha no envio: ${(env.erro ?? "sem detalhe").slice(0, 120)}`);
      continue;
    }
    enviados++;
    await sb.from("ig_mensagens").insert({ ig_id: ct.ig_id, papel: "assistant", texto, mid: env.id ?? null, tipo: "lembrete" });
    if (enviados < 3) await sleep(1500);
  }

  await diario({ enviados, candidatos: candidatos.length, motivos });
  return { ok: true, enviados, candidatos: candidatos.length, motivos };
}
