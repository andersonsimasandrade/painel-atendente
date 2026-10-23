"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EnderecoLead {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

const mascaraCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/** Endereço do paciente: digite o CEP e o resto é preenchido sozinho (ViaCEP). Tudo continua editável. */
export function EditarEndereco({ telefone, inicial }: { telefone: string; inicial: EnderecoLead }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState({
    cep: mascaraCep(inicial.cep ?? ""),
    logradouro: inicial.logradouro ?? "",
    numero: inicial.numero ?? "",
    complemento: inicial.complemento ?? "",
    bairro: inicial.bairro ?? "",
    cidade: inicial.cidade ?? "",
    uf: inicial.uf ?? "",
  });
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const resumo = [
    [inicial.logradouro, inicial.numero].filter(Boolean).join(", "),
    inicial.complemento,
    inicial.bairro,
    [inicial.cidade, inicial.uf].filter(Boolean).join("/"),
    inicial.cep ? `CEP ${mascaraCep(inicial.cep)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  async function buscar(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setBuscando(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/cep/${d}`);
      const j = (await r.json()) as { ok: boolean; error?: string; logradouro?: string; bairro?: string; cidade?: string; uf?: string };
      if (!j.ok) {
        setMsg(j.error ?? "CEP não encontrado.");
        return;
      }
      setV((x) => ({ ...x, logradouro: j.logradouro ?? x.logradouro, bairro: j.bairro ?? x.bairro, cidade: j.cidade ?? x.cidade, uf: j.uf ?? x.uf }));
    } catch {
      setMsg("Não consegui consultar o CEP agora. Preencha à mão.");
    } finally {
      setBuscando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/lead/${encodeURIComponent(telefone)}/dados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setMsg(d.error ?? "Não consegui salvar.");
        return;
      }
      setEditando(false);
      router.refresh();
    } catch {
      setMsg("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = "rounded-lg border border-line bg-base/70 px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand/60";

  if (!editando) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="min-w-0">{resumo || <span className="text-ink-faint">—</span>}</span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          title="Editar endereço"
          aria-label="Editar endereço"
          className="shrink-0 rounded p-1 text-ink-faint transition hover:text-brand"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <div className="grid max-w-[560px] grid-cols-6 gap-2">
      <label className="col-span-3 flex flex-col gap-1 text-[11px] text-ink-faint sm:col-span-2">
        CEP
        <input
          value={v.cep}
          onChange={(e) => {
            const m = mascaraCep(e.target.value);
            setV({ ...v, cep: m });
            if (m.replace(/\D/g, "").length === 8) void buscar(m);
          }}
          inputMode="numeric"
          placeholder="00000-000"
          className={campo}
        />
      </label>
      <span className="col-span-3 flex items-end pb-1.5 text-[11.5px] text-ink-muted sm:col-span-4">{buscando ? "Buscando o endereço…" : "Digite o CEP e o endereço é preenchido sozinho."}</span>
      <label className="col-span-6 flex flex-col gap-1 text-[11px] text-ink-faint sm:col-span-4">
        Rua / avenida
        <input value={v.logradouro} onChange={(e) => setV({ ...v, logradouro: e.target.value })} maxLength={120} className={campo} />
      </label>
      <label className="col-span-3 flex flex-col gap-1 text-[11px] text-ink-faint sm:col-span-2">
        Número
        <input value={v.numero} onChange={(e) => setV({ ...v, numero: e.target.value })} maxLength={20} className={campo} />
      </label>
      <label className="col-span-6 flex flex-col gap-1 text-[11px] text-ink-faint sm:col-span-3">
        Complemento
        <input value={v.complemento} onChange={(e) => setV({ ...v, complemento: e.target.value })} maxLength={80} className={campo} />
      </label>
      <label className="col-span-6 flex flex-col gap-1 text-[11px] text-ink-faint sm:col-span-3">
        Bairro
        <input value={v.bairro} onChange={(e) => setV({ ...v, bairro: e.target.value })} maxLength={80} className={campo} />
      </label>
      <label className="col-span-4 flex flex-col gap-1 text-[11px] text-ink-faint">
        Cidade
        <input value={v.cidade} onChange={(e) => setV({ ...v, cidade: e.target.value })} maxLength={80} className={campo} />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-[11px] text-ink-faint">
        UF
        <input value={v.uf} onChange={(e) => setV({ ...v, uf: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} className={campo} />
      </label>
      <div className="col-span-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-[#04140d] disabled:opacity-50"
        >
          {salvando ? "…" : "Salvar endereço"}
        </button>
        <button type="button" onClick={() => setEditando(false)} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-ink-muted">
          Cancelar
        </button>
        {msg && <span className="text-[12px] text-red-300">{msg}</span>}
      </div>
    </div>
  );
}
