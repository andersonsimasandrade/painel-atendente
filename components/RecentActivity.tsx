import { EventRow } from "@/lib/types";
import { formatPhone, parseMateriais, relativeTime, formatDateTime } from "@/lib/format";
import { StageBadge } from "./StageBadge";
import { EmptyState } from "./EmptyState";
import { Sigilo } from "./Sigilo";

function CanalIcon({ canal }: { canal: string }) {
  const isAudio = canal === "audio";
  return (
    <span
      title={isAudio ? "Áudio" : "Texto"}
      className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.04] text-ink-muted"
    >
      {isAudio ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm7 9a7 7 0 0 1-14 0m7 7v2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 10h8M8 14h5m-8 6 3-3h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export function RecentActivity({ events }: { events: EventRow[] }) {
  if (!events.length) {
    return <EmptyState title="Sem atividade ainda" hint="Cada resposta do robô aparece aqui." />;
  }

  return (
    <ol className="scroll-slim -mr-2 max-h-[420px] space-y-0 overflow-y-auto pr-2">
      {events.map((e, i) => {
        const mats = parseMateriais(e.materiais);
        return (
          <li
            key={e.id ?? i}
            className="relative flex items-start gap-3 border-b border-line/60 py-2.5 last:border-0"
          >
            <div className="mt-1 flex flex-col items-center">
              <CanalIcon canal={e.canal} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-[12px] text-ink"><Sigilo>{formatPhone(e.telefone)}</Sigilo></span>
                <StageBadge stage={e.stage} size="sm" />
              </div>
              {mats.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
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
            <time
              className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-ink-faint"
              title={formatDateTime(e.created_at)}
              dateTime={e.created_at}
            >
              {relativeTime(e.created_at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
