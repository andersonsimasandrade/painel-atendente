"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { parseValorBR } from "@/lib/format";

/**
 * Editor inline genérico dos campos comerciais do Lead 360:
 * investimento previsto (R$), marca atual e origem. `children` é o valor
 * exibido; o lápis troca por um input. A IA sugere; o humano prevalece.
 * Use key={valorInicial} no ponto de uso pra ressincronizar após salvar.
 */
export function EditarCampo({
  telefone,
  campo,
  valorInicial,
  placeholder,
  children,
}: {
  telefone: string;
  campo: "investimento" | "marca" | "origem";
  valorInicial: string;
  placeholder: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(valorInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    let corpo: Record<string, unknown>;
    if (campo === "investimento") {
      const t = valor.trim();
      if (!t) {
        corpo = { investimento: null };
      } else {
        const v = parseValorBR(t);
        if (!Number.isFinite(v) || v < 0) {
          setErro("Valor inválido — use números (ex.: 3.500).");
          return;
        }
        corpo = { investimento: v };
      }
    } else {
      corpo = { [campo]: valor.trim() };
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/dados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui salvar.");
        return;
      }
      setEditando(false);
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="relative">
          {campo === "investimento" && (
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-ink-faint">
              R$
            </span>
          )}
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void salvar();
              if (e.key === "Escape") {
                setValor(valorInicial);
                setEditando(false);
                setErro(null);
              }
            }}
            autoFocus
            maxLength={campo === "origem" ? 120 : 80}
            inputMode={campo === "investimento" ? "decimal" : undefined}
            placeholder={placeholder}
            className={`w-[170px] rounded-lg border border-line bg-base/70 py-1 pr-2.5 text-[13px] text-ink outline-none focus:border-brand/60 ${
              campo === "investimento" ? "pl-7" : "pl-2.5"
            }`}
          />
        </span>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50"
        >
          {salvando ? "…" : "Salvar"}
        </button>
        {erro && <span className="text-[11px] text-red-300">{erro}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="min-w-0">{children}</span>
      <button
        type="button"
        onClick={() => {
          setValor(valorInicial);
          setEditando(true);
        }}
        title={`Editar ${placeholder.toLowerCase()}`}
        aria-label={`Editar ${placeholder.toLowerCase()}`}
        className="shrink-0 rounded p-1 text-ink-faint transition hover:text-brand"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </span>
  );
}
