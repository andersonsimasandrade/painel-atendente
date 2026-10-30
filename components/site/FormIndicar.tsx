"use client";

import { useState } from "react";
import { PhoneField } from "@/components/PhoneField";

// Formulário de indicação do parceiro. Só registra; quem escreve ao paciente é o Anderson, depois.
export function FormIndicar({ codigo }: { codigo: string }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [quem, setQuem] = useState("");
  const [obs, setObs] = useState("");
  const [ok, setOk] = useState(false);
  const [autorizou, setAutorizou] = useState(false);
  const [site, setSite] = useState(""); // honeypot
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pronto = nome.trim().length > 1 && telefone.replace(/\D/g, "").length >= 12 && autorizou;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/site/indicacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, paciente_nome: nome, paciente_telefone: telefone, quem_indicou: quem, observacao: obs, consentimento: autorizou, site_url: site }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (!r.ok || !d.ok) return setErro(d.error ?? "Não foi possível enviar.");
      setOk(true);
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <div className="mt-8 rounded-2xl border border-[#DCE8E5] bg-white p-6">
        <p className="font-destaque text-[20px] font-bold text-[#354746]">Indicação recebida 💚</p>
        <p className="mt-2 text-[15px] leading-relaxed text-[#3F5452]">Obrigado! O Anderson vai entrar em contato com a pessoa em breve.</p>
        <button type="button" onClick={() => { setOk(false); setNome(""); setTelefone(""); setObs(""); setAutorizou(false); }} className="mt-4 text-[14px] font-semibold text-[#0F7F70] underline-offset-2 hover:underline">
          Indicar outra pessoa
        </button>
      </div>
    );
  }

  const campo = "w-full rounded-xl border border-[#DCE8E5] bg-white px-3.5 py-3 text-[16px] text-[#243635] outline-none focus:border-[#0F7F70]";
  return (
    <form onSubmit={enviar} className="mt-8 space-y-4 rounded-2xl border border-[#DCE8E5] bg-white p-5 sm:p-6">
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-[#354746]">Nome da pessoa indicada *</span>
        <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-[#354746]">WhatsApp da pessoa (com DDD) *</span>
        <PhoneField value={telefone} onChange={setTelefone} variant="light" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-[#354746]">Seu nome (quem está indicando)</span>
        <input className={campo} value={quem} onChange={(e) => setQuem(e.target.value)} autoComplete="off" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-[#354746]">Quer deixar um recado? (opcional)</span>
        <input className={campo} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: prefere falar à tarde" maxLength={300} />
      </label>
      <input type="text" name="site_url" value={site} onChange={(e) => setSite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-2.5 text-[14px] leading-snug text-[#3F5452]">
        <input type="checkbox" checked={autorizou} onChange={(e) => setAutorizou(e.target.checked)} className="mt-1 h-4 w-4" />
        <span>Confirmo que a pessoa indicada autorizou o contato do Anderson por WhatsApp.</span>
      </label>
      {erro && <p className="text-[14px] text-red-700">{erro}</p>}
      <button type="submit" disabled={!pronto || enviando} className="w-full rounded-2xl bg-[#0F7F70] px-6 py-4 text-[16px] font-semibold text-white shadow-md transition hover:bg-[#0B6B5E] disabled:cursor-not-allowed disabled:opacity-50">
        {enviando ? "Enviando…" : "Enviar indicação"}
      </button>
    </form>
  );
}
