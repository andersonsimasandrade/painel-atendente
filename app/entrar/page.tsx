import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { safePath } from "@/lib/http";
import { empresaNome } from "@/lib/config";

export const metadata: Metadata = {
  title: "Confirmar acesso · Atendente 24h",
  // O link chega por e-mail: nada aqui deve ser indexado nem pré-carregado.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * Confirmação do link de acesso.
 *
 * POR QUE ESTA TELA EXISTE: o link do e-mail é de uso único, e antivírus de
 * e-mail e o navegador ABREM o link sozinhos pra verificar se é seguro. Isso
 * queimava o token antes da pessoa clicar — 8 dos 11 últimos links foram
 * consumidos em menos de um minuto, e quem tentou entrar viu "link expirado".
 *
 * Robô segue link (GET). Robô não aperta botão (POST). Então o token só é
 * consumido quando alguém de verdade confirma aqui.
 */
export default function EntrarPage({
  searchParams,
}: {
  searchParams: { token?: string; from?: string };
}) {
  const token = String(searchParams?.token ?? "").trim();
  const from = safePath(searchParams?.from);

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
          {!token ? (
            <div className="text-center">
              <h2 className="font-display text-[15px] font-semibold text-ink">
                Link incompleto
              </h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                Abra o link direto do e-mail, sem copiar e colar pela metade.
              </p>
              <a
                href="/login"
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line text-[13.5px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink"
              >
                Pedir um link novo
              </a>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="font-display text-[15px] font-semibold text-ink">
                  Confirmar acesso
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                  É você mesmo? Clique abaixo para entrar no painel.
                </p>
              </div>

              <form method="POST" action="/api/auth/verify" className="mt-5">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="from" value={from} />
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[14px] font-semibold text-[#04140d] transition hover:bg-brand-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                >
                  Entrar no painel
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>

              <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-faint">
                Este passo existe porque o antivírus do e-mail abre os links
                sozinho para conferir se são seguros — e isso gastava o seu
                acesso antes de você chegar.
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-faint">
          {empresaNome()} · Atendente 24h
        </p>
      </div>
    </main>
  );
}
