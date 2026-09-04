"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERFIL_ORDER, perfilMeta } from "@/lib/theme";

/**
 * Categoria do lead, editável no Lead 360. A lista de categorias vem de
 * PERFIL_ORDER em lib/theme.ts — adapte-a ao seu negócio. A IA sugere uma
 * categoria a partir da conversa; o consultor tem a última palavra.
 */
export function MudarPerfil({
  telefone,
  perfilAtual,
}: {
  telefone: string;
  perfilAtual: string | null;
}) {
  const router = useRouter();
  const [perfil, setPerfil] = useState(perfilAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cor = perfilMeta(perfil || null).color;

  async function mudar(novo: string) {
    const anterior = perfil;
    setPerfil(novo);
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/perfil`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: novo }),
      });
      if (!res.ok) {
        setPerfil(anterior);
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui mudar.");
        return;
      }
      router.refresh();
    } catch {
      setPerfil(anterior);
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <select
        value={perfil}
        onChange={(e) => void mudar(e.target.value)}
        disabled={salvando}
        aria-label="Categoria do lead"
        title="Mudar a categoria do lead"
        className="tag-ink rounded-full border-0 bg-transparent px-3 py-1.5 text-[12.5px] font-medium leading-none outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-brand/70 disabled:opacity-50"
        style={{ "--tag": cor, background: `${cor}1a`, boxShadow: `inset 0 0 0 1px ${cor}40` } as React.CSSProperties}
      >
        <option value="" style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
          Indefinido
        </option>
        {PERFIL_ORDER.map((p) => (
          <option key={p.key} value={p.key} style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
            {p.label}
          </option>
        ))}
      </select>
      {erro && <span className="text-[11px] text-red-300">{erro}</span>}
    </span>
  );
}
