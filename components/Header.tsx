import { Logo } from "./Logo";
import { LiveStatus } from "./LiveStatus";
import { NavLinks } from "./NavLinks";
import { SairButton } from "./SairButton";
import { getSessao } from "@/lib/session";
import { empresaNome } from "@/lib/config";

export async function Header({ generatedAt }: { generatedAt: string }) {
  const sess = await getSessao();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3.5">
          <Logo size={42} />
          <div className="leading-tight">
            <h1 className="font-display text-[17px] font-semibold tracking-tight text-ink sm:text-lg">
              {empresaNome()} <span className="text-ink-faint">·</span>{" "}
              <span className="text-brand">Painel</span>
            </h1>
            <p className="text-[12px] text-ink-muted">
              Atendimento e captação por WhatsApp
            </p>
          </div>
        </div>

        <div className="order-last w-full sm:order-none sm:w-auto">
          <NavLinks papel={sess?.papel} />
        </div>

        <div className="flex items-center gap-2.5">
          <LiveStatus generatedAt={generatedAt} />
          <SairButton />
        </div>
      </div>
    </header>
  );
}
