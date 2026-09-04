"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RESULTADO_ORDER, RESULTADO_MAP } from "@/lib/theme";
import { formatDateTime } from "@/lib/format";

/**
 * Concluir atendimento com classificação (chaves de
 * RESULTADO_ORDER em lib/theme, terminais ou não) + motivo curto. Vira o "relatório do que se sucedeu" na
 * lista de leads (coluna + filtro por desfecho). Dá pra desfazer.
 */
export function ConcluirLead({
  telefone,
  resultado,
  motivo,
  resultadoEm,
}: {
  telefone: string;
  resultado: string | null;
  motivo: string | null;
  resultadoEm: string | null;
}) {
  const router = useRouter();
  const [escolha, setEscolha] = useState<string | null>(null);
  const [motivoNovo, setMotivoNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui salvar.");
        return;
      }
      setEscolha(null);
      setMotivoNovo("");
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  const meta = resultado ? RESULTADO_MAP[resultado] : null;

  return (
    <div className="border-t border-line pt-4">
      <p className="text-[11px] uppercase tracking-wider text-ink-faint">
        Desfecho do atendimento
      </p>

      {meta ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <span
            className="tag-ink inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium leading-none"
            style={{
              "--tag": meta.color,
              backgroundColor: `${meta.color}1f`,
              boxShadow: `inset 0 0 0 1px ${meta.color}42`,
            } as React.CSSProperties}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: meta.color }}
              aria-hidden="true"
            />
            {meta.label}
          </span>
          {motivo && <span className="text-[12.5px] text-ink-muted">{motivo}</span>}
          {resultadoEm && (
            <span className="text-[11.5px] text-ink-faint">
              em {formatDateTime(resultadoEm)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void post({ resultado: null })}
            disabled={salvando}
            className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50"
          >
            Desfazer
          </button>
        </div>
      ) : (
        <div className="mt-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {RESULTADO_ORDER.map((r) => {
              const ativo = escolha === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setEscolha(ativo ? null : r.key)}
                  aria-pressed={ativo}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium leading-none ring-1 ring-inset transition ${
                    ativo
                      ? "tag-ink"
                      : "text-ink-muted ring-line hover:text-ink hover:ring-line-strong"
                  }`}
                  style={
                    ativo
                      ? ({
                          "--tag": r.color,
                          backgroundColor: `${r.color}24`,
                          boxShadow: `inset 0 0 0 1px ${r.color}66`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {escolha && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void post({ resultado: escolha, motivo: motivoNovo });
              }}
              className="mt-2.5 flex flex-wrap items-stretch gap-2"
            >
              <input
                value={motivoNovo}
                onChange={(e) => setMotivoNovo(e.target.value)}
                maxLength={200}
                placeholder="Motivo (opcional) — ex.: sem verba agora, fechou com concorrente…"
                aria-label="Motivo do desfecho"
                className="h-9 min-w-[220px] flex-1 rounded-lg border border-line bg-base/70 px-3 text-[13px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60"
              />
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50"
              >
                {salvando ? "…" : "Concluir"}
              </button>
            </form>
          )}
        </div>
      )}

      {erro && <p className="mt-2 text-[12px] text-amber">{erro}</p>}
    </div>
  );
}
