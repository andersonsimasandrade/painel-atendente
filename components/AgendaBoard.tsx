"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AgendamentoView } from "@/lib/agenda";
import { formatarBR } from "@/lib/slots";
import { formatPhone } from "@/lib/format";
import { Panel } from "./Panel";
import { EmptyState } from "./EmptyState";
import { Sigilo } from "./Sigilo";

// Estilo de cada status do agendamento (distinto do StageBadge do funil).
const STATUS: Record<string, { label: string; cls: string }> = {
  agendado: { label: "Agendado", cls: "text-brand bg-brand/10 ring-brand/25" },
  confirmado: { label: "Confirmado", cls: "text-brand bg-brand/10 ring-brand/25" },
  compareceu: { label: "Compareceu", cls: "text-brand bg-brand/12 ring-brand/30" },
  faltou: { label: "Faltou", cls: "text-red-300 bg-red-500/12 ring-red-500/25" },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS[status] ?? { label: status, cls: "text-ink-muted bg-white/[0.05] ring-line" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none ring-1 ring-inset ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

const ROTULO_LOCAL: Record<string, string> = { capoeiras: "Capoeiras", centro: "Centro" };
const ROTULO_ORIGEM: Record<string, string> = { google: "Google", meta: "Meta", instagram: "Instagram", indicacao: "Indicação", site: "Site" };

function Chips({ a }: { a: AgendamentoView }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {a.local && (
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink-muted ring-1 ring-inset ring-line">{ROTULO_LOCAL[a.local] ?? a.local}</span>
      )}
      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand ring-1 ring-inset ring-brand/25" title="Origem do contato">
        {a.origem_canal ? ROTULO_ORIGEM[a.origem_canal] ?? a.origem_canal : "Origem não informada"}
      </span>
    </span>
  );
}

function Remarcar({ a, onFeito }: { a: AgendamentoView; onFeito: () => void }) {
  const [aberto, setAberto] = useState(false);
  const dt = new Date(new Date(a.data_hora).getTime() - 3 * 3600 * 1000).toISOString();
  const [data, setData] = useState(dt.slice(0, 10));
  const [hora, setHora] = useState(dt.slice(11, 16));
  const [local, setLocal] = useState<"capoeiras" | "centro">(a.local === "centro" ? "centro" : "capoeiras");
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(corpo: Record<string, unknown>, texto: string) {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/agenda/${encodeURIComponent(a.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setMsg(j.error ?? "Não consegui salvar.");
        return;
      }
      setMsg(texto);
      setTimeout(onFeito, 900);
    } catch {
      setMsg("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-[11.5px] text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline">
        remarcar ou cancelar
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
      <button type="button" disabled={salvando} onClick={() => void enviar({ data, hora, local }, "Remarcada. O Google Agenda atualiza em poucos minutos.")} className="rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-[#04140d] disabled:opacity-50">
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
    </span>
  );
}

function LeadLine({ a }: { a: AgendamentoView }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/leads/${encodeURIComponent(a.telefone_lead)}`}
        className="truncate text-[14px] font-semibold text-ink hover:text-brand"
      >
        <Sigilo>{a.nome_lead || "Lead sem nome"}</Sigilo>
      </Link>
      <p className="font-mono text-[11.5px] text-ink-faint"><Sigilo>{formatPhone(a.telefone_lead)}</Sigilo></p>
    </div>
  );
}

export function AgendaBoard({ items: inicial }: { items: AgendamentoView[] }) {
  const [items, setItems] = useState<AgendamentoView[]>(inicial);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { proximas, aMarcar, marcadas, comp, falt } = useMemo(() => {
    const now = Date.now();
    const ativo = (s: string) => s === "agendado" || s === "confirmado";
    const t = (a: AgendamentoView) => new Date(a.data_hora).getTime();
    const proximas = items
      .filter((a) => ativo(a.status) && t(a) >= now)
      .sort((a, b) => t(a) - t(b));
    const aMarcar = items
      .filter((a) => ativo(a.status) && t(a) < now)
      .sort((a, b) => t(b) - t(a));
    const marcadas = items
      .filter((a) => a.status === "compareceu" || a.status === "faltou")
      .sort((a, b) => t(b) - t(a));
    return {
      proximas,
      aMarcar,
      marcadas,
      comp: marcadas.filter((a) => a.status === "compareceu").length,
      falt: marcadas.filter((a) => a.status === "faltou").length,
    };
  }, [items]);

  const realizadas = comp + falt;
  const taxa = realizadas ? Math.round((comp / realizadas) * 100) : null;

  async function marcar(id: string, presenca: "compareceu" | "faltou" | "agendado") {
    const antes = items;
    setErro(null);
    setSalvando(id);
    setItems((xs) => xs.map((a) => (a.id === id ? { ...a, status: presenca } : a)));
    try {
      const res = await fetch("/api/agenda/presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, presenca }),
      });
      if (!res.ok) {
        setItems(antes);
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui salvar. Tente de novo.");
      }
    } catch {
      setItems(antes);
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  }

  const Stat = ({ v, label, tone }: { v: string; label: string; tone?: string }) => (
    <div className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
      <p className={`font-display text-[22px] font-semibold leading-none ${tone ?? "text-ink"}`}>{v}</p>
      <p className="mt-1 text-[11.5px] text-ink-muted">{label}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Show-rate */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat v={taxa == null ? "—" : `${taxa}%`} label="Taxa de presença" tone="text-brand" />
        <Stat v={String(comp)} label="Compareceram" />
        <Stat v={String(falt)} label="Faltaram" tone={falt ? "text-red-300" : "text-ink"} />
        <Stat v={String(aMarcar.length)} label="A marcar" tone={aMarcar.length ? "text-amber" : "text-ink"} />
      </div>

      {erro && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
          {erro}
        </p>
      )}

      {/* A marcar (consultas já passadas ainda sem presença) */}
      {aMarcar.length > 0 && (
        <Panel title="A marcar" subtitle="Consultas que já passaram — registre a presença" delay={40}>
          <ul className="flex flex-col divide-y divide-line">
            {aMarcar.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <LeadLine a={a} />
                <Chips a={a} />
                <span className="text-[12.5px] text-ink-muted">{formatarBR(a.data_hora)}</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={salvando === a.id}
                    onClick={() => void marcar(a.id, "compareceu")}
                    className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50"
                  >
                    Compareceu
                  </button>
                  <button
                    type="button"
                    disabled={salvando === a.id}
                    onClick={() => void marcar(a.id, "faltou")}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12.5px] font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Faltou
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Próximas consultas */}
      <Panel title="Próximas consultas" subtitle="Agendadas daqui pra frente" delay={80}>
        {proximas.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {proximas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <LeadLine a={a} />
                <Chips a={a} />
                <div className="ml-auto flex items-center gap-2.5">
                  <span className="text-[12.5px] text-ink">{formatarBR(a.data_hora)}</span>
                  <StatusPill status={a.status} />
                  {a.lembrete_enviado_em && (
                    <span className="text-[11px] text-ink-faint" title="Lembrete já enviado">
                      ⏰
                    </span>
                  )}
                </div>
                <Remarcar a={a} onFeito={() => window.location.reload()} />
                <a href={`/agenda?novo=1&telefone=${encodeURIComponent(a.telefone_lead)}&nome=${encodeURIComponent(a.nome_lead ?? "")}`} className="text-[12px] text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                  + nova sessão
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhuma consulta marcada"
            hint="Assim que um lead agendar pelo link da agenda, a consulta aparece aqui."
          />
        )}
      </Panel>

      {/* Histórico recente */}
      {marcadas.length > 0 && (
        <Panel title="Marcadas recentemente" delay={120}>
          <ul className="flex flex-col divide-y divide-line">
            {marcadas.slice(0, 12).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <LeadLine a={a} />
                <div className="ml-auto flex items-center gap-2.5">
                  <span className="text-[12px] text-ink-muted">{formatarBR(a.data_hora)}</span>
                  <StatusPill status={a.status} />
                  <button
                    type="button"
                    disabled={salvando === a.id}
                    onClick={() => void marcar(a.id, "agendado")}
                    className="text-[11.5px] text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline disabled:opacity-50"
                  >
                    desfazer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
