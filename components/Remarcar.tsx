"use client";

import { useState } from "react";
import { HistoricoAgendamento } from "@/components/HistoricoAgendamento";

export function Remarcar({ a, onFeito, visivel = false }: { a: { id: string; data_hora: string; local: string | null }; onFeito: () => void; visivel?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const dt = new Date(new Date(a.data_hora).getTime() - 3 * 3600 * 1000).toISOString();
  const [data, setData] = useState(dt.slice(0, 10));
  const [hora, setHora] = useState(dt.slice(11, 16));
  const [local, setLocal] = useState<"capoeiras" | "centro">(a.local === "centro" ? "centro" : "capoeiras");
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [avisar, setAvisar] = useState(true);

  async function enviar(corpo: Record<string, unknown>, texto: string) {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/agenda/${encodeURIComponent(a.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; aviso?: string; avisos?: { cancelamento: boolean; confirmacao: boolean } };
      if (!r.ok || !j.ok) {
        setMsg(j.error ?? "Não consegui salvar.");
        return;
      }
      const paciente = j.avisos
        ? j.avisos.cancelamento && j.avisos.confirmacao
          ? " Paciente avisado pelo WhatsApp (cancelamento do horário antigo e confirmação do novo)."
          : " ⚠ Não consegui avisar o paciente por WhatsApp: avise por conversa."
        : "";
      setMsg(`${texto}${paciente}${j.aviso ? ` ⚠ ${j.aviso}` : ""}`);
      setTimeout(onFeito, j.aviso || (j.avisos && !(j.avisos.cancelamento && j.avisos.confirmacao)) ? 6000 : 1500);
    } catch {
      setMsg("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          visivel
            ? "rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink"
            : "text-[11.5px] text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline"
        }
      >
        {visivel ? "Remarcar / cancelar" : "remarcar ou cancelar"}
      </button>
    );
  }
  const campo = "rounded-lg border border-line bg-base/70 px-2 py-1 text-[12px] text-ink outline-none focus:border-brand/60";
  return (
    <span className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-line bg-white/[0.02] p-2">
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
      <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
      <select value={local} onChange={(e) => setLocal(e.target.value as "capoeiras" | "centro")} className={campo}>
        <option value="capoeiras" style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>Capoeiras</option>
        <option value="centro" style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>Centro</option>
      </select>
      <label className="flex w-full items-center gap-2 text-[11.5px] text-ink-muted">
        <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
        Avisar o paciente pelo WhatsApp: cancelamento do horário antigo e confirmação da nova data
      </label>
      <button type="button" disabled={salvando} onClick={() => void enviar({ data, hora, local, avisar }, "Remarcada. O Google Agenda atualiza em poucos minutos.")} className="rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-[#04140d] disabled:opacity-50">
        Remarcar
      </button>
      <button
        type="button"
        disabled={salvando}
        onClick={() => {
          if (window.confirm("Cancelar esta consulta? O evento sai do Google Agenda.")) void enviar({ cancelar: true }, "Cancelada.");
        }}
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[12px] font-semibold text-red-300 disabled:opacity-50"
      >
        Cancelar consulta
      </button>
      <button type="button" onClick={() => setAberto(false)} className="text-[11.5px] text-ink-faint hover:text-ink-muted">
        fechar
      </button>
      {msg && <span className="w-full text-[11.5px] text-ink-muted">{msg}</span>}
      <HistoricoAgendamento id={a.id} rotulo="ver histórico desta consulta" />
    </span>
  );
}
