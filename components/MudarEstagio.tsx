"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_ORDER, stageMeta } from "@/lib/theme";

/** Etapa como o seletor precisa (as dinâmicas vêm de funil_etapas). */
export interface EtapaOpcao {
  key: string;
  label: string;
  color: string;
}

/**
 * Ajuste MANUAL da etapa do funil. Fica no Lead 360 e no cabeçalho do chat.
 * A mudança é registrada como evento 'painel' na linha do tempo — dá pra saber
 * depois que foi humano, não o bot. Quando `etapas` vem do servidor
 * (funil_etapas), o seletor mostra as etapas personalizadas; sem a prop, cai
 * nas 7 de fábrica.
 */
export function MudarEstagio({
  telefone,
  stageAtual,
  compacto = false,
  etapas,
}: {
  telefone: string;
  stageAtual: string;
  compacto?: boolean;
  etapas?: EtapaOpcao[];
}) {
  const router = useRouter();
  const lista: EtapaOpcao[] = etapas?.length ? etapas : STAGE_ORDER;
  const [stage, setStage] = useState(stageAtual || lista[0]?.key || "novo");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cor = lista.find((e) => e.key === stage)?.color ?? stageMeta(stage).color;

  async function mudar(novo: string) {
    const anterior = stage;
    setStage(novo);
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/estagio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: novo }),
      });
      if (!res.ok) {
        setStage(anterior);
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui mudar.");
        return;
      }
      router.refresh();
    } catch {
      setStage(anterior);
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <select
        value={stage}
        onChange={(e) => void mudar(e.target.value)}
        disabled={salvando}
        aria-label="Etapa do funil"
        title="Mudar a etapa do funil"
        className={`tag-ink rounded-full border-0 bg-transparent font-medium leading-none outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-brand/70 disabled:opacity-50 ${
          compacto ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-1.5 text-[12.5px]"
        }`}
        style={{ "--tag": cor, background: `${cor}1a`, boxShadow: `inset 0 0 0 1px ${cor}40` } as React.CSSProperties}
      >
        {/* etapa atual fora da lista (ex.: recém-excluída): mantém visível */}
        {!lista.some((e) => e.key === stage) && (
          <option value={stage} disabled style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
            {stageMeta(stage).label}
          </option>
        )}
        {lista.map((s) => (
          <option key={s.key} value={s.key} style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
            {s.label}
          </option>
        ))}
      </select>
      {erro && <span className="text-[11px] text-red-300">{erro}</span>}
    </span>
  );
}
