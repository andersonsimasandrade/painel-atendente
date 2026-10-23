"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_ORDER, stageMeta } from "@/lib/theme";
import { MOTIVOS_PERDA } from "@/lib/negocios-tipos";

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
  const [perdendo, setPerdendo] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS_PERDA[0]);
  const [obs, setObs] = useState("");
  const cor = lista.find((e) => e.key === stage)?.color ?? stageMeta(stage).color;

  async function confirmarPerdido() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/negocio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "perder", motivo, observacao: obs }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui marcar como perdido.");
        return;
      }
      setPerdendo(false);
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function mudar(novo: string) {
    if (novo === "__perdido__") {
      setPerdendo(true);
      return;
    }
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
        value={perdendo ? "__perdido__" : stage}
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
        <option value="__perdido__" style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
          Perdido (sai do funil)
        </option>
      </select>
      {perdendo && (
        <span className="mt-1 flex w-[250px] flex-col gap-1.5 rounded-xl border border-line bg-surface-2/60 p-2.5 text-[12px] text-ink">
          <span className="font-semibold">Marcar negociação como perdida</span>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="rounded-lg border border-line bg-base/70 px-2 py-1 text-[12.5px] outline-none"
          >
            {MOTIVOS_PERDA.map((m) => (
              <option key={m} value={m} style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
                {m}
              </option>
            ))}
          </select>
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            maxLength={200}
            placeholder="Observação (opcional)"
            className="rounded-lg border border-line bg-base/70 px-2 py-1 text-[12.5px] outline-none"
          />
          <span className="flex gap-1.5">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void confirmarPerdido()}
              className="rounded-lg bg-[#E05C5C] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {salvando ? "…" : "Confirmar"}
            </button>
            <button type="button" onClick={() => setPerdendo(false)} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-muted">
              Cancelar
            </button>
          </span>
          <span className="text-[11px] text-ink-faint">Sai do funil, cancela mensagens e tarefas pendentes e fica no histórico.</span>
        </span>
      )}
      {erro && <span className="text-[11px] text-red-300">{erro}</span>}
    </span>
  );
}
