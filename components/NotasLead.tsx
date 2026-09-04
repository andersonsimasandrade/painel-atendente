"use client";

import { useState } from "react";
import { Nota } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

/**
 * Anotações manuais do consultor no Lead 360: separadas das
 * observações do bot. Cada nota guarda autor + data; dá pra excluir.
 */
export function NotasLead({
  telefone,
  initial,
}: {
  telefone: string;
  initial: Nota[];
}) {
  const [notas, setNotas] = useState<Nota[]>(initial);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/notas`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        notas?: Nota[];
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setErro(d.error ?? "Não consegui salvar.");
        return false;
      }
      if (Array.isArray(d.notas)) setNotas(d.notas);
      return true;
    } catch {
      setErro("Falha de rede.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    const ok = await chamar("POST", { texto });
    if (ok) setTexto("");
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={adicionar} className="flex flex-col gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void adicionar(e);
          }}
          rows={2}
          maxLength={2000}
          placeholder="Anotação sobre este lead (ex.: pediu retorno na sexta; prefere falar à tarde)…"
          aria-label="Nova anotação sobre este lead" className="w-full resize-y rounded-lg border border-line bg-base/70 px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-faint">Ctrl+Enter para salvar</span>
          <button
            type="submit"
            disabled={salvando || !texto.trim()}
            className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? "…" : "Adicionar nota"}
          </button>
        </div>
      </form>

      {erro && <p className="text-[12px] text-amber">{erro}</p>}

      {notas.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">
          Nenhuma anotação ainda — o que você escrever aqui fica só para o time.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notas.map((n) => (
            <li
              key={n.id}
              className="group rounded-xl border border-line bg-surface-2/40 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                  {n.autor ?? "—"}
                  {n.criado_em && (
                    <span className="ml-2 font-normal normal-case tracking-normal">
                      {formatDateTime(n.criado_em)}
                    </span>
                  )}
                </span>
                {/* opacity-60 fixo em vez de opacity-0/group-hover: em tela de
                    toque não existe hover, e a lixeira ficava invisível — porém
                    clicável — no canto de cada nota. */}
                <button
                  type="button"
                  onClick={() => {
                    // Sem desfazer do outro lado: a nota é escrita à mão e não
                    // existe em nenhum outro lugar.
                    const trecho =
                      n.texto.length > 120 ? `${n.texto.slice(0, 120)}…` : n.texto;
                    if (!window.confirm(`Excluir esta anotação?\n\n"${trecho}"`)) return;
                    void chamar("DELETE", { id: n.id });
                  }}
                  disabled={salvando}
                  title="Excluir anotação"
                  aria-label="Excluir anotação"
                  className="rounded p-1 text-ink-faint opacity-60 transition hover:text-danger group-hover:opacity-100 disabled:opacity-40"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-.7 12.1a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                {n.texto}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
