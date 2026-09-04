// Indicadores de atendimento HUMANO (/atendimento): tempo até a resposta do
// consultor, produção por consultor e resposta pós-transferência. Tudo vem de
// n8n_chat_histories (created_at + message.additional_kwargs.sent_by) — sem
// filtrar sent_by o número sai falso, porque TODA saída é type:'ai' (bot e
// humano). Server-only.
//
// Duas armadilhas que moldaram este arquivo (achadas em revisão adversarial):
//  • O PostgREST corta QUALQUER consulta no "Max Rows" da instância (1000 aqui)
//    sem erro — um .limit(20000) devolve 1000 linhas. Por isso TODA leitura
//    grande é paginada com .range() até vir página curta.
//  • A sessão do mesmo lead se parte em duas pelo nono dígito (ver telefone.ts)
//    — a varredura chaveia por telefoneCanonico, nunca pelos dígitos crus.

import { getClient } from "./db";
import { telefoneCanonico, variantesTelefone } from "./telefone";
import {
  AtendimentoResult,
  AtendimentoStats,
  ConsultorAtendimento,
} from "./types";

interface HistMetricRaw {
  id: number | string | null;
  session_id: string | null;
  created_at: string | null;
  tipo: string | null; // message->>type: 'human' | 'ai'
  sent_by: string | null; // message->additional_kwargs->>sent_by: painel|celular|null
}

const PAGINA = 1000; // páginas do tamanho do Max Rows: nunca corta em silêncio

const mediana = (arr: number[]): number | null => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const percentil90 = (arr: number[]): number | null => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)];
};

const emMin = (ms: number | null): number | null =>
  ms == null ? null : Math.round((ms / 60000) * 10) / 10;

// Busca paginada: monta a query de novo a cada página (builders do supabase-js
// são de uso único) e para quando a página vem curta. `maxPaginas` é teto de
// segurança, não critério de fim.
async function fetchTudo<T>(
  monta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  maxPaginas: number,
): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < maxPaginas; p++) {
    const de = p * PAGINA;
    const res = await monta(de, de + PAGINA - 1);
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGINA) return out;
  }
  console.warn(`[atendimento] fetchTudo bateu no teto de ${maxPaginas} páginas`);
  return out;
}

/**
 * Calcula as métricas da janela. `dono` (vendedor_slug) restringe tudo aos
 * leads daquele consultor — mesmo escopo das listas.
 *
 * Regra do par cliente→resposta: guarda o instante da PRIMEIRA mensagem do
 * cliente ainda sem resposta; qualquer saída zera a espera, mas só conta como
 * "resposta humana" quando sent_by é painel/celular. Se o bot respondeu antes,
 * o cliente não estava esperando humano — o par não entra na métrica.
 *
 * Borda da janela: o histórico é buscado com UMA JANELA EXTRA de margem antes
 * do início (2×dias no total), para que esperas abertas antes da janela fechem
 * no lugar certo; nos agregados só entram as RESPOSTAS dentro da janela.
 */
export async function getAtendimentoStats(
  dias: number,
  dono?: string,
): Promise<AtendimentoResult> {
  try {
    const supabase = getClient();
    const desdeMs = Date.now() - dias * 24 * 60 * 60 * 1000;
    const desdeIso = new Date(desdeMs).toISOString();
    const buscaIso = new Date(desdeMs - dias * 24 * 60 * 60 * 1000).toISOString();

    const [hist, contatos, eventos, vendRes] = await Promise.all([
      fetchTudo<HistMetricRaw>(
        (de, ate) =>
          supabase
            .from("n8n_chat_histories")
            .select(
              "id, session_id, created_at, tipo:message->>type, sent_by:message->additional_kwargs->>sent_by",
            )
            .gte("created_at", buscaIso)
            .order("id", { ascending: true })
            .range(de, ate),
        40, // 40k linhas de teto — hoje a tabela inteira tem ~7k
      ),
      fetchTudo<{ telefone: string | null; vendedor_slug: string | null }>(
        (de, ate) => {
          let q = supabase
            .from("ff_contatos")
            .select("telefone, vendedor_slug")
            .order("telefone", { ascending: true })
            .range(de, ate);
          if (dono) q = q.eq("vendedor_slug", dono);
          return q;
        },
        25,
      ),
      fetchTudo<{ telefone: string | null; created_at: string | null }>(
        (de, ate) =>
          supabase
            .from("ff_eventos")
            .select("telefone, created_at")
            .eq("stage", "transferido")
            .gte("created_at", desdeIso)
            .order("created_at", { ascending: true })
            .range(de, ate),
        5,
      ),
      supabase.from("vendedores").select("slug, nome").eq("ativo", true).order("nome"),
    ]);

    if (vendRes.error) throw new Error(vendRes.error.message);

    // telefone CANÔNICO → dono do lead (as variantes com/sem o 9 colapsam).
    const donoPorSessao = new Map<string, string>();
    for (const c of contatos) {
      if (!c.telefone) continue;
      donoPorSessao.set(telefoneCanonico(c.telefone), c.vendedor_slug ?? "");
    }

    // Varre o histórico em ordem cronológica (id asc), por sessão canônica.
    const pendente = new Map<string, number>(); // sessão → ts do cliente esperando
    const deltasGeral: number[] = [];
    const deltasPorSlug = new Map<string, number[]>();
    const respostasPorSlug = new Map<string, number>();
    const leadsPorSlug = new Map<string, Set<string>>();
    const humanTsPorSessao = new Map<string, number[]>(); // saídas HUMANAS (p/ pós-transferência)
    let respostasHumanas = 0;

    for (const r of hist) {
      const sess = telefoneCanonico(String(r.session_id ?? ""));
      if (!sess || !donoPorSessao.has(sess)) continue; // fora do escopo (ou sem contato)
      const ts = r.created_at ? Date.parse(r.created_at) : NaN;
      if (!Number.isFinite(ts)) continue;

      if (r.tipo === "human") {
        // primeira mensagem do cliente desde a última saída — não sobrescreve
        if (!pendente.has(sess)) pendente.set(sess, ts);
        continue;
      }
      if (r.tipo !== "ai") continue;

      const humano = r.sent_by === "painel" || r.sent_by === "celular";
      const esperaDesde = pendente.get(sess);
      pendente.delete(sess); // qualquer saída (bot ou humana) encerra a espera

      // A margem só serve pra fechar esperas no lugar certo: nos AGREGADOS
      // entra apenas o que aconteceu dentro da janela pedida.
      if (!humano || ts < desdeMs) continue;

      respostasHumanas++;
      const slug = donoPorSessao.get(sess) ?? "";
      respostasPorSlug.set(slug, (respostasPorSlug.get(slug) ?? 0) + 1);
      if (!leadsPorSlug.has(slug)) leadsPorSlug.set(slug, new Set());
      leadsPorSlug.get(slug)!.add(sess);
      if (!humanTsPorSessao.has(sess)) humanTsPorSessao.set(sess, []);
      humanTsPorSessao.get(sess)!.push(ts);

      if (esperaDesde != null && ts > esperaDesde) {
        const delta = ts - esperaDesde;
        deltasGeral.push(delta);
        if (!deltasPorSlug.has(slug)) deltasPorSlug.set(slug, []);
        deltasPorSlug.get(slug)!.push(delta);
      }
    }

    // Pós-transferência: evento 'transferido' → primeira saída humana depois.
    const deltasTransfer: number[] = [];
    let transferSemResposta = 0;
    for (const e of eventos) {
      const ts = e.created_at ? Date.parse(e.created_at) : NaN;
      if (!e.telefone || !Number.isFinite(ts)) continue;
      const k = telefoneCanonico(e.telefone);
      if (!donoPorSessao.has(k)) continue; // fora do escopo
      let primeira: number | null = null;
      for (const h of humanTsPorSessao.get(k) ?? []) {
        if (h > ts && (primeira == null || h < primeira)) primeira = h;
      }
      if (primeira != null) deltasTransfer.push(primeira - ts);
      else transferSemResposta++;
    }

    const vendedores = (vendRes.data ?? []) as { slug: string; nome: string }[];
    const porConsultor: ConsultorAtendimento[] = vendedores
      .filter((v) => !dono || v.slug === dono)
      .map((v) => ({
        slug: v.slug,
        nome: v.nome,
        respostas: respostasPorSlug.get(v.slug) ?? 0,
        leadsAtendidos: leadsPorSlug.get(v.slug)?.size ?? 0,
        medianaMin: emMin(mediana(deltasPorSlug.get(v.slug) ?? [])),
      }));

    const stats: AtendimentoStats = {
      dias,
      respostasHumanas,
      paresResposta: deltasGeral.length,
      medianaMin: emMin(mediana(deltasGeral)),
      p90Min: emMin(percentil90(deltasGeral)),
      // Cada evento em escopo cai em exatamente um dos dois baldes.
      transferidos: deltasTransfer.length + transferSemResposta,
      medianaPosTransferMin: emMin(mediana(deltasTransfer)),
      transferSemResposta,
      porConsultor,
    };

    return { ok: true, stats, generatedAt: new Date().toISOString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao calcular os indicadores",
    };
  }
}

/** "12 min", "2h 05", "menos de 1 min" — pra humano ler. Arredonda o TOTAL
 *  antes de decompor (senão 119,6 min viraria "1h 60"). */
export function formatMin(min: number | null): string {
  if (min == null) return "—";
  if (min < 1) return "< 1 min";
  const total = Math.round(min);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}`;
}
