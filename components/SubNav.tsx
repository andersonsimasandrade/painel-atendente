import { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { SairButton } from "./SairButton";
import { getSessao } from "@/lib/session";

/**
 * Cabeçalho das sub-páginas (/leads, /leads/[telefone]). Mesma linguagem do
 * Header principal, com um caminho de volta e um slot à direita.
 */
export async function SubNav({
  title,
  subtitle,
  back = "/",
  backLabel = "Dashboard",
  right,
}: {
  /** ReactNode e não string: o Lead 360 passa o nome e o telefone do lead
   *  envolvidos em <Sigilo> para o modo demonstração poder borrá-los. */
  title: ReactNode;
  subtitle?: ReactNode;
  /** `null` omite o link de voltar — use na própria tela de destino dele. */
  back?: string | null;
  backLabel?: string;
  right?: ReactNode;
}) {
  const sess = await getSessao();
  const vendedor = sess?.papel === "vendedor";
  // Vendedor não acessa o Dashboard — volta pra fila de trabalho dele.
  const backHref = back === null ? null : vendedor && back === "/" ? "/prioridades" : back;
  const backLbl = vendedor && back === "/" ? "Prioridades" : backLabel;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3.5">
          {backHref ? (
            <Link href={backHref} className="shrink-0" aria-label={backLbl}>
              <Logo size={40} />
            </Link>
          ) : (
            <span className="shrink-0">
              <Logo size={40} />
            </span>
          )}
          <div className="min-w-0 leading-tight">
            {/* Sem link de voltar quando o destino É esta tela: em /prioridades
                (a home do consultor) o back padrão apontava pra própria página —
                um "< Prioridades" que recarregava onde ele já estava, ruído que
                ensina a ignorar o controle de navegação. */}
            {backHref && (
              <div className="flex items-center gap-2">
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-1 rounded-md text-[11px] font-medium text-ink-faint transition hover:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M15 6l-6 6 6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {backLbl}
                </Link>
              </div>
            )}
            <h1 className="truncate font-display text-[17px] font-semibold tracking-tight text-ink sm:text-lg">
              {title}
            </h1>
            {subtitle && <p className="truncate text-[12px] text-ink-muted">{subtitle}</p>}
          </div>
        </div>

        <div className="order-last w-full sm:order-none sm:w-auto">
          <NavLinks papel={sess?.papel} />
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {right}
          <SairButton />
        </div>
      </div>
    </header>
  );
}
