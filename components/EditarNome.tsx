"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Nome do contato editável in-place (Lead 360 e cabeçalho do chat). Clica no
 * lápis, edita, Enter salva / Esc cancela. O bot também grava nome pela tag
 * [NOME:], mas o que o humano escreve aqui prevalece.
 */
export function EditarNome({
  telefone,
  nome,
  className = "",
}: {
  telefone: string;
  nome: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome ?? "");
  const [atual, setAtual] = useState(nome ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const novo = valor.trim();
    if (novo === atual) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/nome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novo }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui salvar.");
        return;
      }
      setAtual(novo);
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
      <span className="inline-flex items-center gap-1.5">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
            if (e.key === "Escape") {
              setValor(atual);
              setEditando(false);
              setErro(null);
            }
          }}
          autoFocus
          maxLength={80}
          placeholder="Nome do contato"
          className="min-w-0 max-w-[220px] rounded-lg border border-line bg-base/70 px-2.5 py-1 text-[14px] text-ink outline-none focus:border-brand/60"
        />
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
      <span className={`truncate ${className}`}>
        {atual || <span className="text-ink-faint">Lead sem nome</span>}
      </span>
      <button
        type="button"
        onClick={() => {
          setValor(atual);
          setEditando(true);
        }}
        title="Editar nome do contato"
        aria-label="Editar nome do contato"
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
