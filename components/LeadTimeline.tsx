import { EventRow } from "@/lib/types";
import { parseMateriais, relativeTime, formatDateTime } from "@/lib/format";
import { StageBadge } from "./StageBadge";
import { EmptyState } from "./EmptyState";
import { stageMeta } from "@/lib/theme";

/**
 * Linha do tempo do funil de UM lead: eventos de ff_eventos em ordem
 * cronológica (mais antigo -> mais recente), com StageBadge e tempo relativo.
 */
export function LeadTimeline({ eventos }: { eventos: EventRow[] }) {
  if (!eventos.length) {
    return (
      <EmptyState
        title="Sem eventos ainda"
        hint="Cada avanço no funil registrado pelo robô aparece aqui."
      />
    );
  }

  return (
    <ol className="relative ml-1">
      {/* trilho vertical */}
      <span
        className="absolute left-[5px] top-1 bottom-1 w-px bg-line-strong"
        aria-hidden="true"
      />
      {eventos.map((e, i) => {
        const meta = stageMeta(e.stage);
        const mats = parseMateriais(e.materiais);
        return (
          <li key={e.id ?? i} className="relative flex gap-3.5 pb-4 pl-5 last:pb-0">
            <span
              className="absolute left-0 top-[5px] z-[1] h-[11px] w-[11px] rounded-full ring-4 ring-surface"
              style={{ backgroundColor: meta.color }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={e.stage} size="sm" />
                <time
                  className="text-[11.5px] text-ink-faint"
                  title={formatDateTime(e.created_at)}
                  dateTime={e.created_at}
                >
                  {relativeTime(e.created_at)}
                </time>
                {e.canal && (
                  <span className="text-[11px] text-ink-faint">
                    · {e.canal === "audio" ? "Áudio" : "Texto"}
                  </span>
                )}
              </div>
              {mats.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {mats.map((m) => (
                    <span
                      key={m}
                      className="rounded-md bg-brand/[0.08] px-1.5 py-0.5 text-[10.5px] font-medium text-brand/90"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
