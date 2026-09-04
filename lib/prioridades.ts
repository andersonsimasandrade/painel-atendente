// Atualização das análises de IA dos leads (resumo/temperatura/próxima ação) +
// plano de ação consolidado. Usada pelo botão manual (/api/prioridades/atualizar)
// e pelo cron automático (/api/cron/prioridades). Server-only.
import {
  getConversa,
  getLeadsParaAnalise,
  getPlanoAcao,
  getPrioridades,
  setPlanoAcao,
  setResumoLead,
} from "./db";
import { gerarPlanoAcao, gerarResumoLead } from "./resumo";

const LOTE = 25; // teto de leads por rodada (evita estourar o timeout da função)
const CONCORRENCIA = 3; // lotes menores aliviam o burst de rate-limit do Groq

// Rotula quem falou. Distinguir o consultor do bot importa: uma promessa feita
// por gente ("te ligo amanhã") pesa diferente de uma frase gerada pela IA.
function quemFalou(m: { role: "human" | "ai"; origem?: "painel" | "celular" | "bot" | null }) {
  if (m.role === "human") return "Lead";
  return m.origem === "painel" || m.origem === "celular" ? "Consultor (humano)" : "Consultor (bot)";
}

function montarTranscript(
  msgs: { role: "human" | "ai"; text: string; origem?: "painel" | "celular" | "bot" | null }[],
): string {
  const linhas = msgs.map((m) => `${quemFalou(m)}: ${m.text}`);
  let t = linhas.join("\n");
  if (t.length > 8000) t = "[...conversa anterior omitida...]\n" + t.slice(-8000);
  return t;
}

export interface ResultadoAnalises {
  analisados: number;
  pendentes: number;
  plano: string | null;
}

/**
 * Analisa os leads que mudaram (ou nunca analisados) e regera o PLANO do escopo
 * pedido. `dono` vazio = plano global (admin); um slug de consultor = plano do
 * consultor, montado só com os leads dele.
 *
 * A ANÁLISE por lead (resumo/temperatura) é global de propósito: ela é uma
 * propriedade do lead e só aparece pra quem pode ver aquele lead. O que vazava
 * era o PLANO — texto que citava nome e resumo de leads alheios.
 */
export async function atualizarAnalises(dono = ""): Promise<ResultadoAnalises> {
  const pendentes = await getLeadsParaAnalise(LOTE);

  let analisados = 0;
  for (let i = 0; i < pendentes.length; i += CONCORRENCIA) {
    const chunk = pendentes.slice(i, i + CONCORRENCIA);
    await Promise.all(
      chunk.map(async (l) => {
        const conversa = await getConversa(l.telefone);
        if (!conversa.length) return;
        const r = await gerarResumoLead(montarTranscript(conversa));
        if (!r) return;
        const saved = await setResumoLead(l.telefone, r);
        if (saved.ok) analisados++;
      }),
    );
  }

  // O plano só enxerga os leads do escopo (dono vazio = todos, p/ o admin).
  const prioridades = await getPrioridades(dono || undefined);
  const analisadosLista = prioridades
    .filter((p) => p.resumo && p.temperatura)
    .slice(0, 20)
    .map((p) => ({
      nome: p.nome ?? "Lead",
      temperatura: p.temperatura ?? "morno",
      resumo: p.resumo ?? "",
      proxima_acao: p.proxima_acao ?? "",
    }));

  // Só regenera o plano se algo mudou (analisados > 0) OU se ainda não há cache.
  let plano: string | null = null;
  if (analisadosLista.length) {
    const cache = await getPlanoAcao(dono);
    if (analisados > 0 || !cache.plano) {
      plano = await gerarPlanoAcao(analisadosLista);
      if (plano) await setPlanoAcao(plano, analisadosLista.length, dono);
    } else {
      plano = cache.plano;
    }
  }

  return { analisados, pendentes: pendentes.length, plano };
}
