"use client";

import { useState } from "react";
import Link from "next/link";

const campo = "mt-1.5 w-full rounded-xl border border-[#C9D9D5] bg-white px-4 py-3 text-[16px] text-[#354746] outline-none focus:border-[#1EB49F]";
const rotulo = "block text-[14px] font-semibold text-[#354746]";

const mascara = {
  data: (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 8);
    return n.length > 4 ? `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}` : n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
  },
  cpf: (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 11);
    return n.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
  },
  cep: (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 8);
    return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
  },
};

/** Cadastro do paciente (link privado): os dados entram direto na ficha; o Anderson só confere. */
export function FormCadastro({ codigo, finalTelefone }: { codigo: string; finalTelefone: string }) {
  const [f, setF] = useState({ nome: "", email: "", nascimento: "", cpf: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", telefoneOutro: "" });
  const [telefoneOk, setTelefoneOk] = useState(true);
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function buscarCep(valor: string) {
    const n = valor.replace(/\D/g, "");
    if (n.length !== 8) return;
    setCepMsg("Buscando endereço…");
    try {
      const r = await fetch(`/api/site/cadastro/${encodeURIComponent(codigo)}/cep/${n}`);
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; logradouro?: string; bairro?: string; cidade?: string; uf?: string };
      if (!r.ok || !d.ok) {
        setCepMsg(d.error ?? "Não achei o CEP. Preencha à mão.");
        return;
      }
      setF((x) => ({ ...x, logradouro: d.logradouro || x.logradouro, bairro: d.bairro || x.bairro, cidade: d.cidade || x.cidade, uf: d.uf || x.uf }));
      setCepMsg(null);
    } catch {
      setCepMsg("Sem conexão com a busca de CEP. Preencha à mão.");
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch(`/api/site/cadastro/${encodeURIComponent(codigo)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, telefoneOk, aceite }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui enviar agora. Tente de novo.");
        return;
      }
      setFeito(true);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    return (
      <div className="mt-6 rounded-2xl border border-[#BFE3DC] bg-[#F0FAF8] p-6">
        <p className="font-destaque text-[22px] font-bold text-[#354746]">Cadastro recebido. Obrigado!</p>
        <p className="mt-2 text-[16px] leading-relaxed text-[#3F5452]">Já está tudo com o Anderson. Você pode fechar esta página.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-6 grid max-w-xl grid-cols-1 gap-4">
      <label>
        <span className={rotulo}>Nome completo</span>
        <input className={campo} autoComplete="name" value={f.nome} onChange={(e) => set("nome", e.target.value)} />
      </label>
      <label>
        <span className={rotulo}>E-mail</span>
        <input className={campo} type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
      </label>

      <fieldset className="rounded-xl border border-[#D8E4E1] p-4">
        <legend className="px-1 text-[14px] font-semibold text-[#354746]">O seu WhatsApp termina em {finalTelefone}. Está correto?</legend>
        <div className="flex gap-5 text-[15px] text-[#3F5452]">
          <label className="flex items-center gap-2">
            <input type="radio" checked={telefoneOk} onChange={() => setTelefoneOk(true)} /> Sim
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!telefoneOk} onChange={() => setTelefoneOk(false)} /> Não, uso outro
          </label>
        </div>
        {!telefoneOk && (
          <input className={campo} inputMode="tel" placeholder="Telefone com DDD" value={f.telefoneOutro} onChange={(e) => set("telefoneOutro", e.target.value)} />
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label>
          <span className={rotulo}>Data de nascimento</span>
          <input className={campo} inputMode="numeric" autoComplete="bday" placeholder="dd/mm/aaaa" value={f.nascimento} onChange={(e) => set("nascimento", mascara.data(e.target.value))} />
        </label>
        <label>
          <span className={rotulo}>CPF</span>
          <input className={campo} inputMode="numeric" placeholder="000.000.000-00" value={f.cpf} onChange={(e) => set("cpf", mascara.cpf(e.target.value))} />
        </label>
      </div>

      <label>
        <span className={rotulo}>CEP</span>
        <input
          className={campo}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={f.cep}
          onChange={(e) => {
            const v = mascara.cep(e.target.value);
            set("cep", v);
            void buscarCep(v);
          }}
        />
        {cepMsg && <span className="mt-1 block text-[13px] text-[#5E7371]">{cepMsg}</span>}
      </label>
      <label>
        <span className={rotulo}>Rua / avenida</span>
        <input className={campo} autoComplete="address-line1" value={f.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label>
          <span className={rotulo}>Número</span>
          <input className={campo} value={f.numero} onChange={(e) => set("numero", e.target.value)} />
        </label>
        <label>
          <span className={rotulo}>Complemento</span>
          <input className={campo} placeholder="apto, bloco… (opcional)" value={f.complemento} onChange={(e) => set("complemento", e.target.value)} />
        </label>
      </div>
      <label>
        <span className={rotulo}>Bairro</span>
        <input className={campo} value={f.bairro} onChange={(e) => set("bairro", e.target.value)} />
      </label>
      <div className="grid grid-cols-[1fr_90px] gap-4">
        <label>
          <span className={rotulo}>Cidade</span>
          <input className={campo} value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
        </label>
        <label>
          <span className={rotulo}>UF</span>
          <input className={campo} maxLength={2} value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
        </label>
      </div>

      <label className="flex items-start gap-3 text-[14px] leading-relaxed text-[#3F5452]">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        <span>
          Autorizo o uso destes dados para o meu atendimento, para a emissão de documentos, recibos e cobranças. Sei que posso pedir a correção ou a exclusão a qualquer momento.{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-[#1EB49F] underline">
            Política de privacidade
          </Link>
          .
        </span>
      </label>

      {erro && <p className="text-[15px] text-[#B4543A]">{erro}</p>}
      <button type="submit" disabled={enviando || !aceite} className="inline-flex w-fit items-center rounded-full bg-[#1EB49F] px-7 py-3.5 text-[16px] font-semibold text-white transition hover:bg-[#189B89] disabled:opacity-50">
        {enviando ? "Enviando…" : "Enviar meu cadastro"}
      </button>
    </form>
  );
}
