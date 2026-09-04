"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ from, erro }: { from: string; erro?: string }) {
  const router = useRouter();

  // Magic link (primário)
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkErro, setLinkErro] = useState<string | null>(
    erro === "link" ? "Esse link expirou ou já foi usado. Peça um novo abaixo." : null,
  );

  // Senha (fallback admin)
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [password, setPassword] = useState("");
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [loadingSenha, setLoadingSenha] = useState(false);

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setLoadingLink(true);
    setLinkErro(null);
    try {
      await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, from }),
      });
      // Resposta é sempre genérica — não confirmamos se o e-mail existe.
      setEnviado(true);
    } catch {
      setLinkErro("Falha de rede. Tente novamente.");
    } finally {
      setLoadingLink(false);
    }
  }

  async function entrarSenha(e: React.FormEvent) {
    e.preventDefault();
    setLoadingSenha(true);
    setSenhaErro(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, from }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; redirect?: string };
      if (!res.ok || !data.ok) {
        setSenhaErro(data.error ?? "Não foi possível entrar.");
        setLoadingSenha(false);
        return;
      }
      router.replace(data.redirect || "/");
      router.refresh();
    } catch {
      setSenhaErro("Falha de rede. Tente novamente.");
      setLoadingSenha(false);
    }
  }

  if (enviado) {
    return (
      <div className="mt-7 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/12 text-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-[13.5px] text-ink">
          Se <span className="font-medium">{email}</span> tiver acesso, enviamos um link de entrada.
        </p>
        <p className="text-[12px] text-ink-muted">
          Confira sua caixa de entrada (e o spam). O link vale por 15 minutos.
        </p>
        <button
          type="button"
          onClick={() => {
            setEnviado(false);
            setLinkErro(null);
          }}
          className="mt-1 text-[12.5px] font-medium text-brand hover:underline"
        >
          Usar outro e-mail
        </button>
      </div>
    );
  }

  return (
    <div className="mt-7">
      <form onSubmit={pedirLink} className="flex flex-col gap-3">
        <label className="text-left">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">
            E-mail autorizado
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            autoComplete="email"
            placeholder="voce@suaempresa.com.br"
            className="w-full rounded-xl border border-line bg-base/70 px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
          />
        </label>

        {linkErro && (
          <p className="flex items-center gap-1.5 text-left text-[12.5px] text-amber">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 8v5m0 3h.01M12 3l9 16H3l9-16Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {linkErro}
          </p>
        )}

        <button
          type="submit"
          disabled={loadingLink || !email}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-[14px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingLink ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/40 border-t-[#04140d]" />
              Enviando…
            </>
          ) : (
            <>
              Enviar link de acesso
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14m0 0-5-5m5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Fallback: acesso por senha (admin / emergência) */}
      <div className="mt-5 border-t border-line pt-4">
        {!mostrarSenha ? (
          <button
            type="button"
            onClick={() => setMostrarSenha(true)}
            className="mx-auto block text-[12px] text-ink-faint transition hover:text-ink-muted"
          >
            Acesso por senha (admin)
          </button>
        ) : (
          <form onSubmit={entrarSenha} className="flex flex-col gap-3">
            <label className="text-left">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">
                Senha de acesso
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••••"
                className="w-full rounded-xl border border-line bg-base/70 px-4 py-3 font-mono text-[15px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
              />
            </label>
            {senhaErro && (
              <p className="text-left text-[12.5px] text-amber">{senhaErro}</p>
            )}
            <button
              type="submit"
              disabled={loadingSenha || !password}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-base/50 px-4 py-2.5 text-[13.5px] font-semibold text-ink transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingSenha ? "Entrando…" : "Entrar com senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
