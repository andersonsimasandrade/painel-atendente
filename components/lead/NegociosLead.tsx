"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/format";
import {
  COR_STATUS,
  MOTIVOS_PERDA,
  ROTULO_STATUS,
  ROTULO_TIPO,
  type Negocio,
} from "@/lib/negocios-tipos";

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/**
 * Histórico de NEGOCIAÇÕES da pessoa: cada tentativa de venda/atendimento é um registro (em andamento, concretizada ou perdida).
 * Perdida sai do funil e fica aqui com o motivo. Se a pessoa voltar a ter interesse ou for uma recompra, abre-se outra.
 */
export function NegociosLead({
  telefone,
  negocios,
  voltouAFalar,
}: {
  telefone: string;
  negocios: Negocio[];
  voltouAFalar: boolean;
}) {
  const router = useRouter();
  const aberto = negocios.find((n) => n.status === "aberto") ?? null;
  const [modo, setModo] = useState<null | "perder" | "nova">(null);
  const [motivo, setMotivo] = useState(MOTIVOS_PERDA[0]);
  const [tipo, setTipo] = useState<"reativacao" | "recompra">("reativacao");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(corpo: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/lead/${encodeURIComponent(telefone)}/negocio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui salvar.");
        return;
      }
      setModo(null);
      setObs("");
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = "rounded-lg border border-line bg-base/70 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand/60";
  return (
    <div className="flex flex-col gap-3">
      {voltouAFalar && !aberto && (
        <p className="rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-[12.5px] text-ink">
          Esta pessoa <b>voltou a escrever</b> depois de a negociação ser encerrada. Se houver interesse, abra uma nova negociação.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {negocios.map((n) => (
          <li key={n.id} className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                style={{ color: COR_STATUS[n.status], background: `${COR_STATUS[n.status]}1f` }}
              >
                {ROTULO_STATUS[n.status]}
              </span>
              <span className="text-[12.5px] font-medium text-ink">{ROTULO_TIPO[n.tipo]}</span>
              <span className="ml-auto text-[11.5px] text-ink-faint">
                {dataBR(n.criado_em)}
                {n.fechado_em ? ` → ${dataBR(n.fechado_em)}` : ""}
              </span>
            </div>
            {(n.status === "ganho" && n.valor != null) || n.motivo_perda || n.observacao ? (
              <p className="mt-1 text-[12.5px] text-ink-muted">
                {n.status === "ganho" && n.valor != null ? `Valor: ${formatBRL(n.valor)}. ` : ""}
                {n.motivo_perda ? `Motivo: ${n.motivo_perda}. ` : ""}
                {n.observacao ?? ""}
              </p>
            ) : null}
          </li>
        ))}
        {!negocios.length && <li className="text-[12.5px] text-ink-muted">Nenhuma negociação registrada ainda.</li>}
      </ul>

      {!modo && (
        <div className="flex flex-wrap gap-2">
          {aberto ? (
            <button
              type="button"
              onClick={() => setModo("perder")}
              className="rounded-lg border border-[#E05C5C]/50 px-3 py-1.5 text-[12.5px] font-semibold text-[#E88]"
            >
              Marcar como perdida
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModo("nova")}
              className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-[#04140d] hover:bg-brand-bright"
            >
              Nova negociação
            </button>
          )}
        </div>
      )}

      {modo === "perder" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-3">
          <span className="text-[12.5px] font-semibold text-ink">Por que a negociação foi perdida?</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo}>
            {MOTIVOS_PERDA.map((m) => (
              <option key={m} value={m} style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
                {m}
              </option>
            ))}
          </select>
          <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="Observação (opcional)" className={campo} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void enviar({ acao: "perder", motivo, observacao: obs })}
              className="rounded-lg bg-[#E05C5C] px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
            >
              {salvando ? "…" : "Confirmar: sair do funil"}
            </button>
            <button type="button" onClick={() => setModo(null)} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-ink-muted">
              Cancelar
            </button>
          </div>
          <span className="text-[11.5px] text-ink-faint">Cancela mensagens e tarefas pendentes. O histórico fica guardado.</span>
        </div>
      )}

      {modo === "nova" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-3">
          <span className="text-[12.5px] font-semibold text-ink">Abrir uma nova negociação</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "reativacao" | "recompra")} className={campo}>
            <option value="reativacao" style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
              Reativação (voltou a ter interesse)
            </option>
            <option value="recompra" style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
              Recompra / novo atendimento
            </option>
          </select>
          <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="Observação (opcional)" className={campo} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void enviar({ acao: "nova", tipo, observacao: obs })}
              className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-[#04140d] disabled:opacity-50"
            >
              {salvando ? "…" : "Abrir e voltar ao funil"}
            </button>
            <button type="button" onClick={() => setModo(null)} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-ink-muted">
              Cancelar
            </button>
          </div>
        </div>
      )}
      {erro && <p className="text-[12px] text-red-300">{erro}</p>}
    </div>
  );
}
