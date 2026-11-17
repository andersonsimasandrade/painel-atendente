// Envio das mensagens de confirmação (duas mensagens em sequência) e registro na conversa do painel. Server-only.
import { getClient } from "./db";
import { enviarTextoInstancia } from "./evolution";
import { variantesTelefone } from "./telefone";

// Entre uma mensagem e a seguinte: 3 a 6 s (rajada de mensagens com link, sem pausa, é um dos sinais que o WhatsApp usa para punir números).
const espera = () => 3000 + Math.floor(Math.random() * 3000);

/** Pausa entre etapas diferentes (ex.: pedido de dados → confirmação), 6 a 10 s. */
export const pausaHumana = (): Promise<void> => new Promise((res) => setTimeout(res, 6000 + Math.floor(Math.random() * 4000)));

/** Envia as partes em ordem. Devolve as que realmente saíram (para registrar na conversa). */
export async function enviarPartes(instancia: string, telefone: string, partes: string[]): Promise<{ ok: boolean; enviadas: string[]; erro?: string }> {
  const enviadas: string[] = [];
  for (let i = 0; i < partes.length; i++) {
    const r = await enviarTextoInstancia(instancia, telefone, partes[i]);
    if (!r.ok) return { ok: false, enviadas, erro: r.error };
    enviadas.push(partes[i]);
    if (i < partes.length - 1) await new Promise((res) => setTimeout(res, espera()));
  }
  return { ok: true, enviadas };
}

/** Grava na conversa do painel o texto REAL enviado ao paciente (e deixa o robô ciente do que foi dito). */
export async function registrarNaConversa(telefone: string, textos: string[], via = "sistema"): Promise<void> {
  for (const t of textos) {
    await getClient()
      .from("n8n_chat_histories")
      .insert({ session_id: telefone, message: { type: "ai", content: t, tool_calls: [], additional_kwargs: { via }, response_metadata: {}, invalid_tool_calls: [] } })
      .then(undefined, () => undefined);
  }
}

/** Há conversa em andamento com o paciente (mensagem nas últimas 12 h)? Se sim, os avisos do sistema não cumprimentam nem se apresentam de novo. */
export async function conversaEmAndamento(telefone: string): Promise<boolean> {
  const r = await getClient().from("n8n_chat_histories").select("created_at").in("session_id", variantesTelefone(telefone)).order("id", { ascending: false }).limit(1);
  const t = (r.data?.[0] as { created_at?: string } | undefined)?.created_at;
  return !!t && Date.now() - new Date(t).getTime() < 12 * 3600 * 1000;
}
