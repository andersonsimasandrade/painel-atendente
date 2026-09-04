import { ReactNode } from "react";

export function EmptyState({
  title = "Sem dados ainda",
  hint,
  icon,
}: {
  title?: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <div className="text-ink-faint">
        {icon ?? (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 18V9m5 9V5m5 13v-6m5 6V8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <p className="font-display text-sm font-medium text-ink-muted">{title}</p>
      {hint && <p className="max-w-[240px] text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
