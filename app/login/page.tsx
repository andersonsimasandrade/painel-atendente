import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { safePath } from "@/lib/http";
import { empresaNome } from "@/lib/config";

export const metadata: Metadata = {
  title: "Entrar · Atendente 24h",
};

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string; erro?: string };
}) {
  const from = safePath(searchParams?.from);
  const erro = searchParams?.erro;

  return (
    <main className="relative z-[1] flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4">
            <Logo size={56} />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {empresaNome()} <span className="text-brand">·</span> Painel
          </h1>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Atendimento e captação por WhatsApp
          </p>
        </div>

        <div className="card-surface grain-none rounded-2xl border border-line p-6 shadow-card sm:p-7">
          <div className="text-center">
            <h2 className="font-display text-[15px] font-semibold text-ink">Acesso restrito</h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Entre com seu e-mail autorizado — enviamos um link de acesso.
            </p>
          </div>
          <LoginForm from={from} erro={erro} />
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-faint">
          {empresaNome()} · Atendente 24h
        </p>
      </div>
    </main>
  );
}
