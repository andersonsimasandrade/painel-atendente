"use client";

import { useState } from "react";
import { PhoneField } from "./PhoneField";

// Cria um link de convite (travado a um telefone) pra uma pessoa NÃO cadastrada.
// Só o operador logado consegue chamar /api/agenda/convite. O link é copiável;
// o operador manda como quiser.
export function CriarConvite() {
  const [aberto, setAberto] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const digitos = telefone.replace(/\D/g, "");

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLink(null);
    setLoading(true);
    try {
      const res = await fetch("/api/agenda/convite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone }),
      });
      const d = (await res.json()) as { ok: boolean; error?: string; link?: string };
      if (!res.ok || !d.ok || !d.link) {
        setErro(d.error ?? "Não consegui gerar o link.");
        return;
      }
      setLink(d.link);
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setErro("Não consegui copiar — selecione e copie manualmente.");
    }
  }

  function reset() {
    setLink(null);
    setErro(null);
    setTelefone("");
  }

  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Convidar alguém de fora</h3>
          <p className="text-[12px] text-ink-muted">
            Gere um link de agendamento pra uma pessoa que não é lead (reunião ou compromisso).
          </p>
        </div>
        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
          >
            Criar link de convite
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-3.5 border-t border-line pt-3.5">
          {!link ? (
            <form onSubmit={gerar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-1 block text-[11.5px] font-medium text-ink-muted">
                  WhatsApp da pessoa (com DDD) *
                </span>
                <PhoneField
                  value={telefone}
                  onChange={(v) => {
                    setTelefone(v);
                    setErro(null);
                  }}
                  variant="dark"
                  autoFocus
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading || digitos.length < 10}
                  className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Gerando…" : "Gerar link"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    reset();
                  }}
                  className="text-[12.5px] text-ink-faint transition hover:text-ink-muted"
                >
                  cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-brand/25 bg-brand/[0.06] px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{link}</span>
                <button
                  type="button"
                  onClick={() => void copiar()}
                  className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
                >
                  {copiado ? "Copiado ✓" : "Copiar"}
                </button>
              </div>
              <p className="text-[11.5px] text-ink-faint">
                Vale 3 dias · só esse número consegue agendar por este link.
              </p>
              <button
                type="button"
                onClick={reset}
                className="self-start text-[12.5px] font-medium text-brand hover:underline"
              >
                Criar outro
              </button>
            </div>
          )}

          {erro && <p className="mt-2 text-[12.5px] text-red-300">{erro}</p>}
        </div>
      )}
    </div>
  );
}
