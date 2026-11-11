"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Porta da devolutiva: o paciente digita a data de nascimento (dia, mês e ano). */
export function AcessoDevolutiva({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Máscara dd/mm/aaaa enquanto digita.
  function digitar(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 8);
    setValor(n.length > 4 ? `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}` : n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n);
  }

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch(`/api/site/devolutiva/${encodeURIComponent(codigo)}/acesso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nascimento: valor }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui abrir agora. Tente de novo.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={abrir} className="mt-6 max-w-sm">
      <label className="block text-[14px] font-semibold text-[#354746]" htmlFor="nasc">
        Data de nascimento
      </label>
      <input
        id="nasc"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="dd/mm/aaaa"
        value={valor}
        onChange={(e) => digitar(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-[#C9D9D5] bg-white px-4 py-3 text-[18px] tracking-wide text-[#354746] outline-none focus:border-[#1EB49F]"
      />
      {erro && <p className="mt-2 text-[14px] text-[#B4543A]">{erro}</p>}
      <button
        type="submit"
        disabled={enviando || valor.replace(/\D/g, "").length !== 8}
        className="mt-4 inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#189B89] disabled:opacity-50"
      >
        {enviando ? "Abrindo…" : "Abrir minha devolutiva"}
      </button>
    </form>
  );
}
