// Filtro de período (URL-driven) → janela {desde, ate} em datas YYYY-MM-DD no
// fuso America/Sao_Paulo (UTC-3, sem horário de verão desde 2019). Este módulo
// roda apenas em runtime da aplicação (Server Components / route handlers), então
// Date.now()/new Date() são usados normalmente para resolver "hoje".
//
// TIMEZONE: o Brasil (SP) é UTC-3 fixo. Convertemos qualquer instante para a
// hora-parede de SP subtraindo 3h do epoch e lendo os campos UTC — assim a data
// e a hora batem com o que o usuário vê no WhatsApp, independentemente do fuso
// do servidor (na Vercel o processo roda em UTC).

// Data em que a operação começou (AAAA-MM-DD). É o piso da janela "Desde o
// início": antes dela não existe conversa nem investimento para somar.
// Configure em INICIO_PROJETO; sem isso, o painel assume os últimos 90 dias.
export function inicioProjeto(): string {
  const env = (process.env.INICIO_PROJETO ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  return minusDays(spYmd(Date.now()), 90);
}

const SP_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3
const DAY_MS = 24 * 60 * 60 * 1000;

export type PeriodoPreset = "hoje" | "7d" | "30d" | "mes" | "inicio" | "custom";

const PRESETS: PeriodoPreset[] = ["hoje", "7d", "30d", "mes", "inicio", "custom"];

export const PERIODO_LABEL: Record<PeriodoPreset, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Este mês",
  inicio: "Desde o início",
  custom: "Personalizado",
};

export interface PeriodoResolved {
  preset: PeriodoPreset;
  desde: string; // YYYY-MM-DD (início, inclusivo)
  ate: string; // YYYY-MM-DD (fim, inclusivo — normalmente hoje)
  de: string; // valor cru do input custom "de" (eco; pode ser "")
  ateInput: string; // valor cru do input custom "ate" (eco; pode ser "")
}

// ── Helpers de data no fuso de SP ─────────────────────────────────────────
// Data (YYYY-MM-DD) em São Paulo para um instante em epoch (ms, UTC).
function spYmd(epochMs: number): string {
  const d = new Date(epochMs - SP_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isYmd = (s: string | undefined | null): s is string =>
  !!s && ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00-03:00`));

// Subtrai N dias de uma data YYYY-MM-DD (SP) e devolve YYYY-MM-DD (SP).
function minusDays(ymd: string, days: number): string {
  const base = Date.parse(`${ymd}T12:00:00-03:00`); // meio-dia evita bordas
  return spYmd(base - days * DAY_MS);
}

function firstOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/**
 * Resolve os parâmetros de URL (?periodo=…&de=…&ate=…) numa janela concreta.
 * Default = "7d" — o painel abre respondendo "como estamos AGORA", não o
 * acumulado histórico (que escondia a leitura recente do ROI).
 * Sempre garante desde <= ate.
 */
export function resolvePeriodo(input: {
  periodo?: string | string[];
  de?: string | string[];
  ate?: string | string[];
}): PeriodoResolved {
  const rawPreset = first(input.periodo).toLowerCase();
  const de = first(input.de);
  const ateInput = first(input.ate);
  const hoje = spYmd(Date.now());

  const preset: PeriodoPreset = (PRESETS as string[]).includes(rawPreset)
    ? (rawPreset as PeriodoPreset)
    : "7d";

  let desde: string;
  let ate = hoje;

  switch (preset) {
    case "hoje":
      desde = hoje;
      break;
    case "7d":
      desde = minusDays(hoje, 6); // últimos 7 dias, inclusive hoje
      break;
    case "30d":
      desde = minusDays(hoje, 29); // últimos 30 dias, inclusive hoje
      break;
    case "mes":
      desde = firstOfMonth(hoje);
      break;
    case "custom": {
      // Clampa à janela com dados [inicioProjeto(), hoje]: não há investimento/
      // leads antes do início nem no futuro. Também limita o espaço de chaves do
      // cache do Meta (as datas vêm da URL).
      const clamp = (s: string) =>
        s < inicioProjeto() ? inicioProjeto() : s > hoje ? hoje : s;
      const d = clamp(isYmd(de) ? de : inicioProjeto());
      const a = clamp(isYmd(ateInput) ? ateInput : hoje);
      if (d <= a) {
        desde = d;
        ate = a;
      } else {
        desde = a;
        ate = d;
      }
      break;
    }
    case "inicio":
    default:
      desde = inicioProjeto();
      break;
  }

  if (desde > ate) desde = ate; // trava de segurança

  return { preset, desde, ate, de, ateInput };
}

/**
 * Limites ISO (timestamptz) inclusivos do intervalo, no fuso de SP. Use com
 * .gte(col, desdeIso) e .lte(col, ateIso) nas colunas tstz do Supabase.
 */
export function rangeBoundsIso(desde: string, ate: string): { desdeIso: string; ateIso: string } {
  return {
    desdeIso: `${desde}T00:00:00.000-03:00`,
    ateIso: `${ate}T23:59:59.999-03:00`,
  };
}

/** Hora do dia (0–23) em São Paulo para um timestamp ISO. -1 se inválido. */
export function spHour(iso: string | null | undefined): number {
  if (!iso) return -1;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return -1;
  return new Date(t - SP_OFFSET_MS).getUTCHours();
}
