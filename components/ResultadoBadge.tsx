import { RESULTADO_MAP } from "@/lib/theme";

/**
 * Badge de desfecho do atendimento (chaves de RESULTADO_ORDER em lib/theme).
 * Nulo = ainda em andamento -> "—" discreto (na lista) ou nada.
 */
export function ResultadoBadge({
  resultado,
  size = "sm",
}: {
  resultado: string | null | undefined;
  size?: "sm" | "md";
}) {
  if (!resultado) return <span className="text-ink-faint">—</span>;
  const meta = RESULTADO_MAP[resultado];
  if (!meta) return <span className="text-ink-faint">—</span>;
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]";
  return (
    <span
      className={`tag-ink inline-flex items-center gap-1.5 rounded-full font-medium leading-none ${pad}`}
      style={{
        "--tag": meta.color,
        backgroundColor: `${meta.color}1f`,
        boxShadow: `inset 0 0 0 1px ${meta.color}42`,
      } as React.CSSProperties}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}
