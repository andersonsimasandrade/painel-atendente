import Link from "next/link";
import { LeadRow } from "@/lib/types";
import { formatPhone, relativeTime, formatDateTime, initials } from "@/lib/format";
import { StageBadge } from "./StageBadge";
import { PerfilBadge } from "./PerfilBadge";
import { EmptyState } from "./EmptyState";
import { stageMeta } from "@/lib/theme";
import { Sigilo } from "./Sigilo";

function CanalPill({ canal }: { canal: string | null }) {
  if (!canal) return <span className="text-ink-faint">—</span>;
  const isAudio = canal === "audio";
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-ink-muted">
      <span
        className={`h-1.5 w-1.5 rounded-full ${isAudio ? "bg-amber" : "bg-brand"}`}
        aria-hidden="true"
      />
      {isAudio ? "Áudio" : "Texto"}
    </span>
  );
}

function LocalCell({ cidade, uf }: { cidade: string | null; uf: string | null }) {
  if (!cidade && !uf) return <span className="text-ink-faint">—</span>;
  return (
    <span className="text-[12.5px] text-ink-muted">
      {cidade ?? "—"}
      {uf && (
        <span className="ml-1 rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[10.5px] text-ink-faint">
          {uf}
        </span>
      )}
    </span>
  );
}

const COLS = [
  { h: "Lead", align: "left" },
  { h: "Telefone", align: "left" },
  { h: "Perfil", align: "left" },
  { h: "Cidade/UF", align: "left" },
  { h: "Estágio", align: "left" },
  { h: "Última interação", align: "left" },
  { h: "Follow-ups", align: "right" },
  { h: "Canal", align: "right" },
] as const;

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  if (!leads.length) {
    return (
      <EmptyState
        title="Sem leads ativos ainda"
        hint="Leads marcados como ativos (captados via anúncio) aparecem nesta tabela."
      />
    );
  }

  return (
    <div className="scroll-slim -mx-1 overflow-x-auto">
      <table className="w-full min-w-[860px] border-separate border-spacing-0">
        <thead>
          <tr className="text-left">
            {COLS.map((c) => (
              <th
                key={c.h}
                className={`sticky top-0 z-10 border-b border-line bg-surface/80 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint backdrop-blur ${
                  c.align === "right" ? "text-right" : ""
                }`}
              >
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((l, idx) => {
            const meta = stageMeta(l.funnel_stage);
            return (
              <tr
                key={l.telefone + idx}
                className="group transition-colors hover:bg-white/[0.02]"
              >
                <td className="border-b border-line/50 px-3 py-2.5">
                  <Link
                    href={`/leads/${encodeURIComponent(l.telefone)}`}
                    className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    <span
                      className="tag-ink flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{ "--tag": meta.color, background: `${meta.color}1f` } as React.CSSProperties}
                    >
                      <Sigilo>{initials(l.nome)}</Sigilo>
                    </span>
                    <span className="text-[13px] text-ink group-hover:text-brand">
                      <Sigilo>{l.nome?.trim() || <span className="text-ink-faint">—</span>}</Sigilo>
                    </span>
                  </Link>
                </td>
                <td className="border-b border-line/50 px-3 py-2.5">
                  <span className="font-mono text-[12px] text-ink-muted">
                    <Sigilo>{formatPhone(l.telefone)}</Sigilo>
                  </span>
                </td>
                <td className="border-b border-line/50 px-3 py-2.5">
                  <PerfilBadge perfil={l.perfil} size="sm" />
                </td>
                <td className="border-b border-line/50 px-3 py-2.5">
                  <LocalCell cidade={l.cidade} uf={l.uf} />
                </td>
                <td className="border-b border-line/50 px-3 py-2.5">
                  <StageBadge stage={l.funnel_stage} size="sm" />
                </td>
                <td className="border-b border-line/50 px-3 py-2.5">
                  <span
                    className="text-[12.5px] text-ink-muted"
                    title={formatDateTime(l.ultima_interacao)}
                  >
                    {relativeTime(l.ultima_interacao)}
                  </span>
                </td>
                <td className="border-b border-line/50 px-3 py-2.5 text-right">
                  <span
                    className={`tnum inline-flex min-w-[26px] items-center justify-center rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${
                      l.followup_count > 0 ? "bg-amber/10 text-amber" : "text-ink-faint"
                    }`}
                  >
                    {l.followup_count}
                  </span>
                </td>
                <td className="border-b border-line/50 px-3 py-2.5 text-right">
                  <div className="flex justify-end">
                    <CanalPill canal={l.preferencia_canal} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
