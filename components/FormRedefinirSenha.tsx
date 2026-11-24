"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CAMPO =
  "w-full rounded-xl border border-line bg-base/70 px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]";

/** Formulário da tela /redefinir-senha: escolher a senha nova (duas vezes) e já entrar no painel. */
export function FormRedefinirSenha({ token }: { token: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== repetir) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/auth/redefinir", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; redirect?: string };
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Não foi possível salvar.");
        setSalvando(false);
        return;
      }
      router.replace(data.redirect || "/");
      router.refresh();
    } catch {
      setErro("Falha de rede. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      <div className="text-center">
        <h2 className="font-display text-[15px] font-semibold text-ink">Escolha a sua senha</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
          Com ela você entra em qualquer aparelho, usando o seu e-mail. Mínimo de 8 caracteres.
        </p>
      </div>
      <label className="mt-2 text-left">
        <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Senha nova</span>
        <input type={ver ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required minLength={8} autoFocus className={CAMPO} />
      </label>
      <label className="text-left">
        <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Repita a senha nova</span>
        <input type={ver ? "text" : "password"} value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required minLength={8} className={CAMPO} />
      </label>
      <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
        <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />
        Mostrar a senha
      </label>
      {erro && <p className="text-left text-[12.5px] text-amber">{erro}</p>}
      <button
        type="submit"
        disabled={salvando || !senha || !repetir}
        className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-brand text-[14px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Salvar e entrar"}
      </button>
    </form>
  );
}
