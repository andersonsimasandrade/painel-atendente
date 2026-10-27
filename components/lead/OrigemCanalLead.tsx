"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPCOES = [
  { v: "", t: "Não informada" },
  { v: "google", t: "Google (anúncio)" },
  { v: "meta", t: "Meta (anúncio)" },
  { v: "instagram", t: "Instagram (orgânico)" },
  { v: "indicacao", t: "Indicação" },
  { v: "site", t: "Site" },
];

/** Origem do contato (google, meta, instagram, indicação, site). O sistema preenche sozinho quando sabe; aqui você corrige ou completa. */
export function OrigemCanalLead({
  telefone,
  valor,
  manual,
  temClique,
}: {
  telefone: string;
  valor: string | null;
  manual: boolean;
  temClique: { google: boolean; meta: boolean };
}) {
  const router = useRouter();
  const [v, setV] = useState(valor ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function mudar(novo: string) {
    const anterior = v;
    setV(novo);
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/lead/${encodeURIComponent(telefone)}/dados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origem_canal: novo }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setV(anterior);
        setErro(d.error ?? "Não consegui salvar.");
        return;
      }
      router.refresh();
    } catch {
      setV(anterior);
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        value={v}
        onChange={(e) => void mudar(e.target.value)}
        disabled={salvando}
        aria-label="Origem do contato"
        className="rounded-lg border border-line bg-base/70 px-2.5 py-1 text-[13px] text-ink outline-none focus:border-brand/60 disabled:opacity-50"
      >
        {OPCOES.map((o) => (
          <option key={o.v} value={o.v} style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
            {o.t}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-ink-faint">
        {manual ? "Definida por você." : v ? "Preenchida pelo sistema." : "Escolha, se souber."}
        {temClique.google ? " Tem clique do Google (conversão será enviada ao agendar)." : ""}
        {temClique.meta ? " Tem clique da Meta." : ""}
      </span>
      {erro && <span className="text-[11px] text-red-300">{erro}</span>}
    </span>
  );
}
