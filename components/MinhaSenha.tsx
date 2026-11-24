"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";

const CAMPO =
  "w-full rounded-lg border border-line bg-surface-2/40 px-3 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60";

function sessaoExpirada(res: Response): boolean {
  return res.type === "opaqueredirect" || res.status === 0 || res.status === 401;
}

/** Ajustes → "Minha senha": criar (primeira vez) ou trocar a senha de entrada do painel, com e-mail de apoio se esquecer. */
export function SecaoMinhaSenha({ onSessaoExpirou }: { onSessaoExpirou: () => void }) {
  const [info, setInfo] = useState<{ email: string | null; temSenha: boolean } | null>(null);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/conta/senha", { cache: "no-store", redirect: "manual" });
        if (sessaoExpirada(res)) {
          onSessaoExpirou();
          return;
        }
        const d = (await res.json().catch(() => ({}))) as { ok?: boolean; email?: string | null; temSenha?: boolean };
        if (vivo && d.ok) setInfo({ email: d.email ?? null, temSenha: !!d.temSenha });
      } catch {
        /* a seção só não aparece com os dados; o resto do painel segue */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onSessaoExpirou]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (nova !== repetir) {
      setMsg({ tipo: "erro", texto: "As duas senhas novas não são iguais." });
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/conta/senha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "manual",
        body: JSON.stringify({ atual, nova }),
      });
      if (sessaoExpirada(res)) {
        onSessaoExpirou();
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) {
        setMsg({ tipo: "erro", texto: d.error ?? "Não foi possível salvar." });
        return;
      }
      setMsg({ tipo: "ok", texto: "Pronto! Senha salva. Na tela de entrada, use “Entrar com e-mail e senha”." });
      setInfo((i) => (i ? { ...i, temSenha: true } : i));
      setAtual("");
      setNova("");
      setRepetir("");
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de rede. Tente de novo." });
    } finally {
      setSalvando(false);
    }
  }

  async function mandarPorEmail() {
    if (!info?.email) return;
    setEnviandoEmail(true);
    setMsg(null);
    try {
      await fetch("/api/auth/esqueci", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: info.email }) });
      setMsg({ tipo: "ok", texto: `Enviei um link para ${info.email}. Abra o e-mail para escolher a senha.` });
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de rede. Tente de novo." });
    } finally {
      setEnviandoEmail(false);
    }
  }

  if (!info) return null;

  return (
    <Panel title="Minha senha" subtitle="Entre em qualquer aparelho com o seu e-mail e a sua senha" delay={0}>
      {!info.email ? (
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Você entrou com a senha geral do servidor. Para ter uma senha própria, saia e entre pelo seu e-mail (link ou “Esqueci a senha / criar minha senha”).
        </p>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Seu acesso: <strong className="font-semibold text-ink">{info.email}</strong>.{" "}
            {info.temSenha ? "Você já tem uma senha. Pode trocá-la abaixo." : "Você ainda não criou uma senha: escolha uma abaixo."}
          </p>
          <form onSubmit={salvar} className="mt-4 space-y-3">
            {info.temSenha && (
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink-muted">Senha atual</span>
                <input type={ver ? "text" : "password"} value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" required className={CAMPO} />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-muted">Senha nova (mínimo 8 caracteres)</span>
              <input type={ver ? "text" : "password"} value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" required minLength={8} className={CAMPO} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-muted">Repita a senha nova</span>
              <input type={ver ? "text" : "password"} value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required minLength={8} className={CAMPO} />
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
              <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />
              Mostrar as senhas
            </label>
            {msg && <p className={`text-[12.5px] ${msg.tipo === "ok" ? "text-brand" : "text-amber"}`}>{msg.texto}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={salvando || !nova || !repetir || (info.temSenha && !atual)}
                className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando ? "Salvando…" : info.temSenha ? "Trocar senha" : "Criar senha"}
              </button>
              {info.temSenha && (
                <button
                  type="button"
                  onClick={mandarPorEmail}
                  disabled={enviandoEmail}
                  className="text-[12.5px] font-medium text-brand hover:underline disabled:opacity-60"
                >
                  {enviandoEmail ? "Enviando…" : "Esqueci a senha atual: mandar link por e-mail"}
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </Panel>
  );
}
