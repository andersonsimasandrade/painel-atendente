import { ReactNode } from "react";

interface PanelProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** índice para escalonar a animação de entrada */
  delay?: number;
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
  delay = 0,
}: PanelProps) {
  return (
    <section
      className={`card-surface grain-none animate-fade-up rounded-2xl border border-line shadow-card ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={`px-5 pb-5 pt-4 sm:px-6 sm:pb-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
