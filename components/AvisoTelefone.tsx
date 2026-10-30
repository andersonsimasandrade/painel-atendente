"use client";

import { useEffect, useRef, useState } from "react";
import { mesmoTelefone } from "@/lib/telefone";

// Enquanto o telefone é digitado, mostra os cadastros compatíveis (com ou sem o 9 da frente).
// modo "usar": clicar preenche o formulário com aquele paciente (agendamento).
// modo "aviso": só avisa que o número já existe e oferece abrir o cadastro (novo lead).
export function AvisoTelefone({
  telefone,
  modo,
  onEscolher,
}: {
  telefone: string;
  modo: "usar" | "aviso";
  onEscolher?: (p: { telefone: string; nome: string | null }) => void;
}) {
  const [itens, setItens] = useState<{ telefone: string; nome: string | null }[]>([]);
  const ultimo = useRef(0);

  useEffect(() => {
    const d = telefone.replace(/\D/g, "");
    const nacional = d.startsWith("55") ? d.slice(2) : d;
    if (!d.startsWith("55") || nacional.length < 6) {
      setItens([]);
      return;
    }
    const id = ++ultimo.current;
    const espera = setTimeout(async () => {
      try {
        const r = await fetch(`/api/lead/busca?q=${encodeURIComponent(d)}`);
        const j = (await r.json()) as { ok: boolean; itens?: { telefone: string; nome: string | null }[] };
        if (id === ultimo.current) setItens(j.ok ? j.itens ?? [] : []);
      } catch {
        if (id === ultimo.current) setItens([]);
      }
    }, 300);
    return () => clearTimeout(espera);
  }, [telefone]);

  if (!itens.length) return null;
  const fmt = (t: string) => {
    const d = t.replace(/\D/g, "");
    return d.startsWith("55") && d.length >= 12 ? `(${d.slice(2, 4)}) ${d.slice(4, d.length - 4)}-${d.slice(-4)}` : t;
  };
  return (
    <ul className="space-y-1.5 sm:col-span-2">
      {itens.map((i) => {
        const igual = mesmoTelefone(i.telefone, telefone);
        return (
          <li key={i.telefone} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[13px] ${igual ? "border-amber-400/50 bg-amber-400/10" : "border-line bg-white/[0.02]"}`}>
            <span className="min-w-0">
              <b className="text-ink">{i.nome?.trim() || "Sem nome"}</b> <span className="font-mono text-[12px] text-ink-muted">{fmt(i.telefone)}</span>
              <span className={`ml-2 text-[11.5px] font-semibold ${igual ? "text-amber-300" : "text-ink-faint"}`}>{igual ? "número já cadastrado" : "número parecido"}</span>
            </span>
            {modo === "usar" ? (
              <button type="button" onClick={() => onEscolher?.(i)} className="rounded-lg bg-brand px-2.5 py-1.5 text-[12px] font-semibold text-[#04140d] hover:bg-brand-bright">
                Usar este paciente
              </button>
            ) : (
              <a href={`/leads/${encodeURIComponent(i.telefone)}`} className="text-[12px] font-semibold text-brand underline-offset-2 hover:underline">
                Abrir cadastro
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
