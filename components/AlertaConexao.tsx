"use client";

import { useState } from "react";

/** Mostra se o aviso por e-mail de "WhatsApp desconectado" está configurado e deixa mandar um e-mail de teste. */
export function AlertaConexao({ configurado, faltam, destinos }: { configurado: boolean; faltam: string[]; destinos: string[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function testar() {
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/conexao/teste-email", { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; resultados?: { email: string; ok: boolean; erro?: string }[] };
      if (d.ok) {
        setOk(true);
        setMsg(`E-mail de teste enviado para ${d.resultados?.map((x) => x.email).join(", ")}. Confira a caixa de entrada e o spam.`);
      } else {
        setOk(false);
        setMsg(d.error ?? d.resultados?.map((x) => `${x.email}: ${x.erro ?? "falhou"}`).join(" · ") ?? "Não consegui enviar.");
      }
    } catch {
      setOk(false);
      setMsg("Falha de rede.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card-surface rounded-xl border border-line px-4 py-3 text-[13px]">
      <p className="font-semibold text-ink">Aviso por e-mail quando o WhatsApp desconectar</p>
      {configurado ? (
        <p className="mt-1 text-ink-muted">
          Ativo. Quem recebe: <b className="text-ink">{destinos.join(", ")}</b>. O aviso sai em até 10 minutos depois da queda e se repete a cada 30 minutos até reconectar.
        </p>
      ) : (
        <p className="mt-1 text-amber">Não está ativo. Falta configurar no EasyPanel (Ambiente do painel): {faltam.join(", ")}.</p>
      )}
      <button
        type="button"
        onClick={() => void testar()}
        disabled={enviando}
        className="mt-2 inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviar e-mail de teste"}
      </button>
      {msg && <p className={`mt-2 ${ok ? "text-brand" : "text-amber"}`}>{msg}</p>}
    </div>
  );
}
