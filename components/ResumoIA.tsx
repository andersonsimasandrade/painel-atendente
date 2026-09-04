"use client";

import { useState } from "react";

type Temp = "quente" | "morno" | "frio";

interface Estado {
  resumo: string | null;
  temperatura: Temp | null;
  proxima_acao: string | null;
  resumo_em: string | null;
}

const TEMP: Record<Temp, { label: string; emoji: string; cls: string }> = {
  quente: { label: "Quente", emoji: "🔥", cls: "text-red-300 bg-red-500/12 ring-red-500/25" },
  morno: { label: "Morno", emoji: "🌤️", cls: "text-amber bg-amber/10 ring-amber/25" },
  frio: { label: "Frio", emoji: "❄️", cls: "text-sky-300 bg-sky-500/12 ring-sky-500/25" },
};

function quando(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

export function ResumoIA({ telefone, initial }: { telefone: string; initial: Estado }) {
  const [st, setSt] = useState<Estado>(initial);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/resumo`, {
        method: "POST",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        resumo?: string;
        temperatura?: Temp;
        proxima_acao?: string;
        resumo_em?: string;
      };
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Não foi possível gerar o resumo.");
        return;
      }
      setSt({
        resumo: data.resumo ?? null,
        temperatura: data.temperatura ?? null,
        proxima_acao: data.proxima_acao ?? null,
        resumo_em: data.resumo_em ?? new Date().toISOString(),
      });
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  const temMeta = st.temperatura ? TEMP[st.temperatura] : null;

  const botao = (
    <button
      type="button"
      onClick={() => void gerar()}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3.5 py-2 text-[12.5px] font-semibold text-ink transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/30 border-t-brand" />
          Analisando…
        </>
      ) : (
        <>🧠 {st.resumo ? "Atualizar resumo" : "Gerar resumo IA"}</>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {!st.resumo ? (
        <div className="flex flex-col items-start gap-2.5">
          <p className="text-[12.5px] text-ink-muted">
            Gere um resumo do lead com temperatura (quente / morno / frio) e a próxima ação
            sugerida — a partir da conversa inteira.
          </p>
          {botao}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {temMeta && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none ring-1 ring-inset ${temMeta.cls}`}
              >
                {temMeta.emoji} {temMeta.label}
              </span>
            )}
            {st.resumo_em && (
              <span className="text-[11px] text-ink-faint">gerado {quando(st.resumo_em)}</span>
            )}
            <div className="ml-auto">{botao}</div>
          </div>

          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{st.resumo}</p>

          {st.proxima_acao && (
            <div className="rounded-xl border border-brand/20 bg-brand/[0.06] px-3.5 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-brand/80">Próxima ação</p>
              <p className="mt-0.5 text-[13px] text-ink">{st.proxima_acao}</p>
            </div>
          )}
        </>
      )}

      {erro && <p className="text-[12.5px] text-amber">{erro}</p>}

      <p className="text-[10.5px] text-ink-faint">
        Gerado por IA (Groq, com OpenAI de reserva) — confira antes de agir.
      </p>
    </div>
  );
}
