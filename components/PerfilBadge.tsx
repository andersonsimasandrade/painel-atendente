import { perfilMeta } from "@/lib/theme";

/**
 * Selo com a categoria do lead (as categorias vivem em PERFIL_ORDER, em
 * lib/theme.ts). Mesma linguagem visual do StageBadge, em tom menor.
 * Sem categoria -> "—" discreto.
 */
export function PerfilBadge({
  perfil,
  size = "sm",
}: {
  perfil: string | null | undefined;
  size?: "sm" | "md";
}) {
  if (!perfil) return <span className="text-ink-faint">—</span>;
  const meta = perfilMeta(perfil);
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]";
  return (
    <span
      className={`tag-ink inline-flex items-center gap-1.5 rounded-full font-medium leading-none ${pad}`}
      style={{
        "--tag": meta.color,
        backgroundColor: hexToRgba(meta.color, 0.12),
        boxShadow: `inset 0 0 0 1px ${hexToRgba(meta.color, 0.26)}`,
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

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
