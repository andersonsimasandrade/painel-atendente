// CHECK-IN SEMANAL dos exercícios: uma vez por semana o sistema pergunta ao paciente como foram os exercícios e leva ao link do plano
// (onde ele responde dias feitos, dor e um recado). Regras:
//   • só planos ATIVOS que o Anderson já ENVIOU pelo WhatsApp;
//   • primeiro lembrete 7 dias depois do envio; depois a cada 7 dias contados do último contato (envio, lembrete ou resposta);
//   • no máximo 3 lembretes por plano, sem insistir se o paciente nunca responde;
//   • só entre 08:00 e 20:00 (janela fixa), nunca para o próprio Anderson nem para números de teste;
//   • no máximo 5 envios por rodada. Server-only.
import { getClient } from "./db";
import { dentroDaJanelaDeEnvio } from "./janela-envio";
import { enviarTextoInstancia } from "./evolution";
import { ehNumeroInterno } from "./numeros-internos";
import { SITE_URL } from "./site";

const SEMANA_MS = 7 * 86400000;
const MAX_LEMBRETES = 3;
const MAX_POR_RODADA = 5;

function texto(nome: string | null, n: number, link: string): string {
  const oi = nome ? `Oi, ${nome}!` : "Oi!";
  if (n <= 1) return `${oi} Tudo bem? Passando para saber como foi a semana com os exercícios. Conta pra mim rapidinho (leva 1 minuto): ${link}`;
  if (n === 2) return `${oi} Só lembrando de contar como estão os exercícios e a dor. Leva 1 minuto: ${link}\nSe estiver com alguma dificuldade, é só me avisar por aqui. 🙂`;
  return `${oi} Esse é o último lembrete dos exercícios: ${link}\nSe preferir, me conte por aqui como está indo. Fico à disposição!`;
}

export async function rodarCheckinExercicios(): Promise<{ enviados: number; motivo?: string }> {
  const agora = new Date();
  if (!dentroDaJanelaDeEnvio(agora)) return { enviados: 0, motivo: "fora da janela 08–20h" };
  const sb = getClient();
  const r = await sb
    .from("prescricoes")
    .select("id, telefone, codigo, enviado_em, lembretes, lembrete_em")
    .eq("ativa", true)
    .not("enviado_em", "is", null)
    .lt("lembretes", MAX_LEMBRETES)
    .limit(100);
  const planos = (r.data ?? []) as { id: string; telefone: string; codigo: string; enviado_em: string; lembretes: number; lembrete_em: string | null }[];
  if (!planos.length) return { enviados: 0 };

  const ck = await sb.from("prescricao_checkins").select("prescricao_id, criado_em").in("prescricao_id", planos.map((p) => p.id)).order("criado_em", { ascending: false });
  const ultimoCheckin = new Map<string, number>();
  for (const c of (ck.data ?? []) as { prescricao_id: string; criado_em: string }[]) {
    if (!ultimoCheckin.has(c.prescricao_id)) ultimoCheckin.set(c.prescricao_id, new Date(c.criado_em).getTime());
  }

  let enviados = 0;
  for (const p of planos) {
    if (enviados >= MAX_POR_RODADA) break;
    if (ehNumeroInterno(p.telefone)) continue;
    const ref = Math.max(new Date(p.enviado_em).getTime(), p.lembrete_em ? new Date(p.lembrete_em).getTime() : 0, ultimoCheckin.get(p.id) ?? 0);
    if (agora.getTime() - ref < SEMANA_MS) continue;

    const c = await sb.from("ff_contatos").select("nome, ultima_instancia, resultado").eq("telefone", p.telefone).limit(1);
    const ct = c.data?.[0] as { nome: string | null; ultima_instancia: string | null; resultado: string | null } | undefined;
    if (!ct || ct.resultado === "perdido") continue;
    const instancia = ct.ultima_instancia || (process.env.EVOLUTION_INSTANCE ?? "").trim();
    if (!instancia) continue;

    // "Reivindica" o lembrete no banco antes de enviar: se houver mais de uma cópia do painel rodando, só uma envia.
    const claim = await sb
      .from("prescricoes")
      .update({ lembretes: p.lembretes + 1, lembrete_em: agora.toISOString() })
      .eq("id", p.id)
      .eq("lembretes", p.lembretes)
      .select("id");
    if (claim.error || !claim.data?.length) continue;

    const primeiro = (ct.nome ?? "").trim().split(/\s+/)[0] || null;
    const msg = texto(primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : null, p.lembretes + 1, `${SITE_URL}/exercicios/${p.codigo}`);
    const env = await enviarTextoInstancia(instancia, p.telefone, msg);
    if (!env.ok) {
      // não saiu: devolve o lembrete para tentar na próxima rodada
      await sb.from("prescricoes").update({ lembretes: p.lembretes, lembrete_em: p.lembrete_em }).eq("id", p.id);
      console.error("[checkin-exercicios] envio falhou:", env.error);
      continue;
    }
    enviados++;
    // memória da conversa (o robô sabe que a pergunta foi feita)
    await sb
      .from("n8n_chat_histories")
      .insert({
        session_id: p.telefone,
        message: { type: "ai", content: msg, tool_calls: [], additional_kwargs: { via: "checkin-exercicios" }, response_metadata: {}, invalid_tool_calls: [] },
      })
      .then(undefined, () => undefined);
  }
  if (enviados) {
    await sb.from("cron_log").insert({ rota: "checkin-exercicios", resumo: `enviados=${enviados}` }).then(undefined, () => undefined);
  }
  return { enviados };
}

const g = globalThis as unknown as { __checkinExRelogio?: boolean };

/** Relógio interno: confere a cada 30 minutos (só envia entre 08h e 20h). */
export function iniciarRelogioCheckinExercicios() {
  if (g.__checkinExRelogio) return;
  g.__checkinExRelogio = true;
  const volta = async () => {
    try {
      const r = await rodarCheckinExercicios();
      if (r.enviados) console.log(`[checkin-exercicios] enviados: ${r.enviados}`);
    } catch (e) {
      console.error("[checkin-exercicios]", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(volta, 6 * 60 * 1000);
  setInterval(volta, 30 * 60 * 1000);
}
