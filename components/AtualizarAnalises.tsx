"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AtualizarAnalises() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function atualizar() {
    setLoading(true);
    setErro(null);
    setMsg(null);
    try {
      const res = await fetch("/api/prioridades/atualizar", { method: "POST", cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        analisados?: number;
        tinha_pendentes?: boolean;
      };
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Não foi possível atualizar as análises.");
        return;
      }
      const n = data.analisados ?? 0;
      setMsg(
        n > 0
          ? `${n} lead${n > 1 ? "s" : ""} analisado${n > 1 ? "s" : ""} + plano atualizado.`
          : data.tinha_pendentes
            ? "Nada pôde ser analisado (IA indisponível?)."
            : "Tudo já estava atualizado — nenhum lead mudou.",
      );
      router.refresh(); // re-renderiza a página server-side com os dados novos
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => void atualizar()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/40 border-t-[#04140d]" />
            Analisando leads…
          </>
        ) : (
          <>🔄 Atualizar análises</>
        )}
      </button>
      {msg && <span className="text-[11.5px] text-brand">{msg}</span>}
      {erro && <span className="text-[11.5px] text-amber">{erro}</span>}
      {loading && (
        <span className="text-[11px] text-ink-faint">
          Pode levar alguns segundos conforme o número de leads.
        </span>
      )}
    </div>
  );
}
