// Utilitários de formatação (PT-BR). Puros — sem dependências de servidor.

const nf = new Intl.NumberFormat("pt-BR");

export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  return nf.format(n);
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "0%";
  const v = n.toFixed(digits);
  // remove ".0" redundante
  return `${v.replace(/\.0+$/, "")}%`.replace(".", ",");
}

/**
 * Telefone COMPLETO e legível — o painel é interno, com login e escopo por
 * consultor, e quem atende precisa do número inteiro pra ligar/salvar.
 *   "5511999998888" -> "+55 51 99240-8820"
 *   "551199998888"  -> "+55 51 9240-8820"   (forma sem o nono dígito)
 *   "351912345678"  -> "+351 912345678"     (internacional: não inventa formato)
 */
export function formatPhone(raw: string | null | undefined): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "—";
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const local = d.slice(4);
    const corte = local.length === 9 ? 5 : 4;
    return `+55 ${ddd} ${local.slice(0, corte)}-${local.slice(corte)}`;
  }
  return `+${d}`;
}

/**
 * Máscara leve de telefone para privacidade. Mantém país + DDD + os
 * 3 últimos dígitos; oculta o miolo.
 *   "551188887777" -> "55 51 8****584"
 * (Mantida para telas públicas/compartilháveis; o painel usa formatPhone.)
 */
export function maskPhone(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length < 8) return raw?.trim() || "—";
  const suffix = d.slice(-3);
  const country = d.slice(0, 2);
  const ddd = d.slice(2, 4);
  const firstOfNumber = d.slice(4, 5);
  const midLen = Math.max(2, d.length - 8);
  const mid = "*".repeat(midLen);
  return `${country} ${ddd} ${firstOfNumber}${mid}${suffix}`;
}

/** Tempo relativo compacto em PT-BR a partir de uma data ISO. */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = now - t;
  const abs = Math.abs(diff);
  const future = diff < 0;

  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;

  let out: string;
  if (abs < 45_000) out = "agora";
  else if (abs < hour) out = `${Math.round(abs / min)} min`;
  else if (abs < day) out = `${Math.round(abs / hour)} h`;
  else if (abs < 7 * day) out = `${Math.round(abs / day)} d`;
  else {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  }
  if (out === "agora") return out;
  return future ? `em ${out}` : `há ${out}`;
}

/** Data/hora absoluta legível (para tooltips/últ. atualização). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rótulo curto de dia (ex.: "31/07"). */
export function shortDay(iso: string): string {
  const t = new Date(iso + "T00:00:00");
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Divide a string de materiais em tokens limpos. */
export function parseMateriais(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normaliza um telefone para só-dígitos com DDI 55 (o Brasil manda com/sem o 55
 * e o 9). Compartilhado entre /api/agendar e /api/agenda/convite (mesma regra
 * nos dois lados). ≥12 dígitos = já tem DDI; 10–11 = DDD + número → prefixa 55.
 */
export function soDigitos(s: string | null | undefined): string {
  const d = String(s || "").replace(/\D/g, "");
  if (d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

/** Só os dígitos (sem heurística de país). Os formulários já compõem o número
 *  completo com o DDI do seletor de país, então aqui não prefixamos nada. */
export function apenasDigitos(s: string | null | undefined): string {
  return String(s || "").replace(/\D/g, "");
}

export function initials(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

/** Valor monetário em BRL. Nulo/invalidado -> "—". */
export function formatBRL(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return brl.format(Number(n));
}

/**
 * Cor estável do chip de consultor (hash do nome → matiz HSL). O mesmo nome
 * pinta igual em qualquer tela e consultores diferentes ganham cores
 * diferentes, sem precisar cadastrar paleta por pessoa.
 *
 * O TEXTO é misturado com --c-ink (claro no tema escuro, escuro no tema claro).
 * Antes a luminosidade era fixa em 66%, calibrada só para o fundo escuro: no
 * tema claro o nome do consultor sumia do chip. O fundo tintado segue no matiz
 * vivo nos dois temas.
 */
function matizConsultor(nome: string): number {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % 360;
  return h;
}

export function consultorCor(nome: string): { color: string; background: string } {
  const h = matizConsultor(nome);
  return {
    color: `color-mix(in srgb, hsl(${h} 62% 66%) 62%, var(--c-ink))`,
    background: `hsl(${h} 62% 66% / 0.13)`,
  };
}

/**
 * Faz o parse de um valor monetário digitado em PT-BR para número.
 * Aceita "1500", "1500,50", "1.500", "1.500,50", "10.000", "1.234.567,89".
 * Regra: havendo vírgula, ela é o separador decimal e os pontos são de
 * milhar. Sem vírgula, pontos que agrupam exatamente 3 dígitos ("1.500",
 * "10.000", "1.234.567") são separador de milhar; do contrário o ponto é
 * tratado como decimal ("1.5" -> 1.5). Retorna NaN se vazio/ inválido.
 * Usado tanto no cliente (FecharLead) quanto no servidor (/api/fechar) para
 * garantir o MESMO resultado nos dois lados.
 */
export function parseValorBR(raw: string | null | undefined): number {
  const t = String(raw ?? "").trim();
  if (!t) return NaN;
  let normalized: string;
  if (t.includes(",")) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    normalized = t.replace(/\./g, "");
  } else {
    normalized = t;
  }
  return parseFloat(normalized);
}

// ── Limpeza das mensagens da conversa (n8n_chat_histories) ────────────────
// As respostas do bot carregam metadados de orquestração que NÃO devem
// aparecer na conversa: um cabeçalho "CANAL: TEXTO/AUDIO", a assinatura
// "*Nome:*" e tags entre colchetes ([AGENDAR], [PERFIL:...], etc.).

// Tags de orquestração entre colchetes. Removemos QUALQUER [conteúdo] numa
// linha — igual à varredura do nó "Canal e texto" do n8n que monta a mensagem
// enviada — pro painel nunca exibir tag interna, INDEPENDENTE da caixa
// (ex.: [Nome: X], [NOME: X], [nome: x] — o modelo às vezes não usa maiúscula).
const BRACKET_TAG = /\[[^\]\n]*\]/g;
const CANAL_LINE = /^\s*CANAL:\s*(?:TEXTO|AUDIO)\s*(?:\r?\n|$)/i;
// Assinatura do bot no início da mensagem. Genérica porque cada consultor tem
// a própria persona (cada número assina com o nome do seu consultor) — não
// dá pra fixar um nome.
const ASSINATURA = /^\s*\*[^*\n]{1,40}:\*\s*/;

function tidy(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, " ") // espaços duplicados
    .replace(/[ \t]+\n/g, "\n") // espaço no fim da linha
    .replace(/\n{3,}/g, "\n\n") // no máx. uma linha em branco
    .trim();
}

/** Limpa a resposta da IA (bot) para exibição humana. */
export function cleanAiMessage(raw: string | null | undefined): string {
  let s = String(raw ?? "");
  s = s.replace(CANAL_LINE, ""); // cabeçalho de canal (1ª linha)
  s = s.replace(ASSINATURA, ""); // assinatura do consultor (*Nome:*)
  s = s.replace(BRACKET_TAG, ""); // todas as tags de orquestração
  return tidy(s);
}

/**
 * Limpa uma saída ESCRITA POR UM HUMANO — pelo painel ou pelo celular do
 * consultor. Tira o cabeçalho de canal e a assinatura "*Nome:*" que o painel
 * prefixa, mas NÃO mexe em colchetes: "te mando o preço [amanhã]" é texto
 * legítimo de gente, não tag de orquestração do bot.
 */
export function cleanHumanOutMessage(raw: string | null | undefined): string {
  let s = String(raw ?? "");
  s = s.replace(CANAL_LINE, "");
  s = s.replace(ASSINATURA, "");
  return tidy(s);
}

/** Limpa a mensagem do humano: remove apenas o cabeçalho de canal. */
export function cleanHumanMessage(raw: string | null | undefined): string {
  let s = String(raw ?? "");
  s = s.replace(CANAL_LINE, "");
  return tidy(s);
}
