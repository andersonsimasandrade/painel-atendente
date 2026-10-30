"use client";

import { useEffect, useRef, useState } from "react";

// Busca de paciente já cadastrado por nome ou telefone. Ao escolher, devolve telefone e nome ao formulário.
export function BuscaPaciente({ onEscolher }: { onEscolher: (p: { telefone: string; nome: string | null }) => void }) {
  const [q, setQ] = useState("");
  const [itens, setItens] = useState<{ telefone: string; nome: string | null }[]>([]);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const ultimo = useRef(0);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setItens([]);
      return;
    }
    const id = ++ultimo.current;
    const espera = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/lead/busca?q=${encodeURIComponent(t)}`);
        const d = (await r.json()) as { ok: boolean; itens?: { telefone: string; nome: string | null }[] };
        if (id === ultimo.current) setItens(d.ok ? d.itens ?? [] : []);
      } catch {
        if (id === ultimo.current) setItens([]);
      } finally {
        if (id === ultimo.current) setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(espera);
  }, [q]);

  const fmt = (t: string) => {
    const d = t.replace(/\D/g, "");
    return d.startsWith("55") && d.length >= 12 ? `(${d.slice(2, 4)}) ${d.slice(4, d.length - 4)}-${d.slice(-4)}` : t;
  };

  return (
    <div className="relative sm:col-span-2">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-muted">Já é paciente? Busque por nome ou telefone</span>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        placeholder="Digite o nome ou parte do telefone"
        className="w-full rounded-xl border border-line bg-base/70 px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand/60"
        autoComplete="off"
      />
      {aberto && q.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-surface-2 shadow-card">
          {buscando && <li className="px-3 py-2 text-[12.5px] text-ink-muted">Buscando…</li>}
          {!buscando && itens.length === 0 && <li className="px-3 py-2 text-[12.5px] text-ink-muted">Ninguém encontrado. Preencha os dados abaixo para cadastrar.</li>}
          {itens.map((i) => (
            <li key={i.telefone}>
              <button
                type="button"
                onClick={() => {
                  onEscolher(i);
                  setQ("");
                  setAberto(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13.5px] text-ink hover:bg-white/5"
              >
                <span className="truncate font-medium">{i.nome?.trim() || "Sem nome"}</span>
                <span className="shrink-0 font-mono text-[12px] text-ink-muted">{fmt(i.telefone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
