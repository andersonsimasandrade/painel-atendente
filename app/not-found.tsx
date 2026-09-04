import Link from "next/link";
import { Logo } from "@/components/Logo";

/** 404 no visual do painel — antes caía na tela padrão do Next, sem volta. */
export default function NaoEncontrado() {
  return (
    <main className="relative z-[1] mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 opacity-90">
        <Logo size={52} />
      </div>
      <div className="card-surface w-full rounded-2xl border border-line p-6 shadow-card sm:p-8">
        <h1 className="font-display text-xl font-semibold text-ink">Esta página não existe</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          O endereço pode ter mudado, ou o link veio quebrado.
        </p>
        <div className="mt-5 flex justify-center">
          <Link
            href="/prioridades"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Voltar para Prioridades
          </Link>
        </div>
      </div>
    </main>
  );
}
