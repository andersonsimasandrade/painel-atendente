"use client";

import { useState } from "react";

/** Check-in do paciente na página do plano: quantos dias fez, como está a dor e um recado. */
export function FormCheckin({ codigo }: { codigo: string }) {
  const [dias, setDias] = useState<number | null>(null);
  const [dor, setDor] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [armadilha, setArmadilha] = useState(""); // honeypot: pessoas não preenchem
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch(`/api/site/exercicios/${encodeURIComponent(codigo)}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias_feitos: dias, dor, comentario, site_url: armadilha }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui enviar agora. Tente de novo.");
        return;
      }
      setFeito(true);
    } catch {
      setErro("Sem conexão. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    return (
      <div className="rounded-2xl border border-[#1EB49F]/30 bg-[#1EB49F]/10 p-5 text-[15px] text-[#354746]">
        <b>Obrigado por contar como foi!</b> O Anderson vê o seu retorno e acompanha a sua evolução.
      </div>
    );
  }

  const bolinha = (ativo: boolean) =>
    `flex h-10 w-10 items-center justify-center rounded-full border text-[14px] font-semibold transition ${
      ativo ? "border-[#1EB49F] bg-[#1EB49F] text-white" : "border-[#C9D8D5] bg-white text-[#354746] hover:border-[#1EB49F]"
    }`;

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-[#D8E4E1] bg-white p-5">
      <h2 className="text-[18px] font-semibold text-[#354746]">Como foi a sua semana?</h2>
      <p className="mt-1 text-[14px] text-[#5A6F6C]">Conte rapidinho. Isso ajuda a acompanhar a sua evolução.</p>

      <p className="mt-4 text-[14px] font-semibold text-[#354746]">Em quantos dias você fez os exercícios?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button key={n} type="button" onClick={() => setDias(n)} className={bolinha(dias === n)} aria-pressed={dias === n}>
            {n}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[14px] font-semibold text-[#354746]">Como está a dor hoje? (0 = sem dor, 10 = a pior dor)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button key={n} type="button" onClick={() => setDor(n)} className={bolinha(dor === n)} aria-pressed={dor === n}>
            {n}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-[14px] font-semibold text-[#354746]">
        Algum recado? (dificuldade, dúvida, algo que incomodou)
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={600}
          rows={3}
          className="mt-2 w-full rounded-xl border border-[#C9D8D5] bg-white px-3 py-2 text-[15px] font-normal text-[#354746] outline-none focus:border-[#1EB49F]"
        />
      </label>

      <input type="text" name="site_url" value={armadilha} onChange={(e) => setArmadilha(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {erro && <p className="mt-3 text-[14px] text-[#B45309]">{erro}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="mt-4 inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#189B89] disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar retorno"}
      </button>
    </form>
  );
}
