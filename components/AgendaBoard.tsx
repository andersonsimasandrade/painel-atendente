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

      {/* A marcar (reuniões já passadas ainda sem presença) */}
      {aMarcar.length > 0 && (
        <Panel title="A marcar" subtitle="Reuniões que já passaram — registre a presença" delay={40}>
          <ul className="flex flex-col divide-y divide-line">
            {aMarcar.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <LeadLine a={a} />
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

      {/* Próximas reuniões */}
      <Panel title="Próximas reuniões" subtitle="Agendadas daqui pra frente" delay={80}>
        {proximas.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {proximas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <LeadLine a={a} />
                <div className="ml-auto flex items-center gap-2.5">
                  <span className="text-[12.5px] text-ink">{formatarBR(a.data_hora)}</span>
                  <StatusPill status={a.status} />
                  {a.lembrete_enviado_em && (
                    <span className="text-[11px] text-ink-faint" title="Lembrete já enviado">
                      ⏰
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhuma reunião marcada"
            hint="Assim que um lead agendar pelo link da agenda, a reunião aparece aqui."
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
