import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { FormRedefinirSenha } from "@/components/FormRedefinirSenha";
import { empresaNome } from "@/lib/config";

export const metadata: Metadata = {
  title: "Escolher senha · Atendente 24h",
  // O link chega por e-mail: nada aqui deve ser indexado nem pré-carregado.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/** Tela aberta pelo link do e-mail "Criar ou trocar a senha". O link só é gasto quando a pessoa salva a senha nova. */
export default function RedefinirSenhaPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = String(searchParams?.token ?? "").trim();
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
        </div>
        <div className="card-surface grain-none rounded-2xl border border-line p-6 shadow-card sm:p-7">
          {token ? (
            <FormRedefinirSenha token={token} />
          ) : (
            <div className="text-center">
              <h2 className="font-display text-[15px] font-semibold text-ink">Link incompleto</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">Abra o link direto do e-mail, sem copiar e colar pela metade.</p>
              <a
                href="/login"
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line text-[13.5px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink"
              >
                Voltar para a entrada
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
