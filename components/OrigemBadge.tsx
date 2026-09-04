/**
 * Atribuição de anúncio (Feature 3). Mostra a origem paga do lead: um selo
 * âmbar com a campanha (📣) quando origem_campanha/origem_ad existem, ou
 * "Orgânico / direto" (discreto) quando ambos são nulos. O âmbar segue a
 * semântica de tráfego pago usada em Tráfego & Retorno.
 */
export function OrigemBadge({
  campanha,
  ad,
  size = "sm",
}: {
  campanha: string | null;
  ad: string | null;
  size?: "sm" | "md";
}) {
  if (!campanha && !ad) {
    return (
      <span className={size === "md" ? "text-[13px] text-ink-faint" : "text-[12px] text-ink-faint"}>
        Orgânico / direto
      </span>
    );
  }

  const primary = campanha ?? ad ?? "";
  const secondary = campanha && ad && ad !== campanha ? ad : null;
  const pad = size === "md" ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[11px]";

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={`inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-amber/10 font-medium leading-none text-amber ring-1 ring-inset ring-amber/25 ${pad}`}
        title={secondary ? `${primary} · ${secondary}` : primary}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0"
          aria-hidden="true"
        >
          <path
            d="M3 11v2a1 1 0 0 0 1 1h2l3.5 3.5a1 1 0 0 0 1.7-.7V7.2a1 1 0 0 0-1.7-.7L6 10H4a1 1 0 0 0-1 1Zm12-4a5 5 0 0 1 0 10"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="truncate">{primary}</span>
      </span>
    </span>
  );
}
