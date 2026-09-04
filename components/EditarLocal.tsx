"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

/**
 * Cidade/UF editáveis in-place no Lead 360 (para preencher a
 * origem do lead pra medir de onde está entrando mais). A IA sugere pelo
 * resumo; o que o humano digita aqui prevalece.
 */
export function EditarLocal({
  telefone,
  cidade,
  uf,
}: {
  telefone: string;
  cidade: string | null;
  uf: string | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [cid, setCid] = useState(cidade ?? "");
  const [estado, setEstado] = useState(uf ?? "");
  const [atual, setAtual] = useState({ cidade: cidade ?? "", uf: uf ?? "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cidade: cid.trim(), uf: estado }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui salvar.");
        return;
      }
      setAtual({ cidade: cid.trim(), uf: estado });
      setEditando(false);
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <input
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
            if (e.key === "Escape") {
              setCid(atual.cidade);
              setEstado(atual.uf);
              setEditando(false);
              setErro(null);
            }
          }}
          autoFocus
          maxLength={80}
          placeholder="Cidade"
          className="w-[140px] rounded-lg border border-line bg-base/70 px-2.5 py-1 text-[13px] text-ink outline-none focus:border-brand/60"
        />
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          aria-label="UF"
          className="rounded-lg border border-line bg-base/70 px-1.5 py-1 font-mono text-[12px] text-ink outline-none focus:border-brand/60"
        >
          <option value="">UF</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50"
        >
          {salvando ? "…" : "Salvar"}
        </button>
        {erro && <span className="text-[11px] text-red-300">{erro}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {atual.cidade || atual.uf ? (
        <span>
          {atual.cidade || "—"}
          {atual.uf && (
            <span className="ml-1 rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[10.5px] text-ink-faint">
              {atual.uf}
            </span>
          )}
        </span>
      ) : (
        <span className="text-ink-faint">—</span>
      )}
      <button
        type="button"
        onClick={() => {
          setCid(atual.cidade);
          setEstado(atual.uf);
          setEditando(true);
        }}
        title="Editar cidade/UF"
        aria-label="Editar cidade/UF"
        className="shrink-0 rounded p-1 text-ink-faint transition hover:text-brand"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </span>
  );
}
