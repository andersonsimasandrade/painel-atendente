"use client";

import { ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeadsQuery } from "@/lib/types";
import { STAGE_ORDER, PERFIL_ORDER, RESULTADO_ORDER } from "@/lib/theme";

const FILTROS = [
  { v: "", label: "Todas as situações" },
  { v: "ativos", label: "Ativos" },
  { v: "agendados", label: "Agendados" },
  { v: "materiais", label: "Receberam material" },
  { v: "followups", label: "Com follow-up" },
  { v: "parados", label: "Parados (+24h)" },
];

const fieldCls =
  "rounded-lg border border-line bg-surface-2/60 text-[12.5px] text-ink-muted outline-none transition focus:border-line-strong focus:text-ink";

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`${fieldCls} h-9 appearance-none rounded-lg py-0 pl-3 pr-8`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

export function LeadsFilterBar({
  initial,
  ufs,
  campanhas,
  etapas,
}: {
  initial: LeadsQuery;
  ufs: string[];
  campanhas: string[];
  /** Etapas dinâmicas do funil (funil_etapas); sem a prop, as 7 de fábrica. */
  etapas?: { key: string; label: string }[];
}) {
  const listaEtapas = etapas?.length ? etapas : STAGE_ORDER;
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [busca, setBusca] = useState(initial.busca ?? "");
  const [filtro, setFiltro] = useState(initial.filtro ?? "");
  const [perfil, setPerfil] = useState(initial.perfil ?? "");
  const [estagio, setEstagio] = useState(initial.estagio ?? "");
  const [uf, setUf] = useState(initial.uf ?? "");
  const [cnpj, setCnpj] = useState(initial.cnpj ?? "");
  const [campanha, setCampanha] = useState(initial.campanha ?? "");
  const [resultado, setResultado] = useState(initial.resultado ?? "");
  const [de, setDe] = useState(initial.de ?? "");
  const [ate, setAte] = useState(initial.ate ?? "");

  function apply(next: Partial<Record<string, string>> = {}) {
    const merged: Record<string, string> = {
      filtro,
      perfil,
      estagio,
      uf,
      cnpj,
      campanha,
      resultado,
      de,
      ate,
      busca,
      ...next,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      const val = (v ?? "").toString().trim();
      if (val) params.set(k, val);
    }
    // Preserva o filtro de consultor do admin — ele não faz parte desta barra,
    // mas some da URL se a gente reconstruir a query do zero.
    const consultorAtual = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ).get("consultor");
    if (consultorAtual) params.set("consultor", consultorAtual);
    const qs = params.toString();
    // useTransition: `isPending` esmaece a barra enquanto a consulta corre. Sem
    // isso, no 4G o consultor trocava o filtro e a tela ficava idêntica — então
    // tocava de novo, enfileirando consultas na página mais pesada do painel.
    iniciar(() => router.push(qs ? `/leads?${qs}` : "/leads"));
  }

  function clear() {
    setBusca("");
    setFiltro("");
    setPerfil("");
    setEstagio("");
    setUf("");
    setCnpj("");
    setCampanha("");
    setResultado("");
    setDe("");
    setAte("");
    const consultorAtual = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ).get("consultor");
    iniciar(() =>
      router.push(
        consultorAtual ? `/leads?consultor=${encodeURIComponent(consultorAtual)}` : "/leads",
      ),
    );
  }

  const hasFilters = !!(
    busca || filtro || perfil || estagio || uf || cnpj || campanha || resultado || de || ate
  );

  // Filtros que ficam ESCONDIDOS no celular (a busca segue sempre visível). O
  // número aparece no botão pra ninguém filtrar sem perceber que filtrou.
  const ativosOcultos = [filtro, perfil, estagio, uf, cnpj, campanha, resultado, de, ate].filter(
    Boolean,
  ).length;
  const [abertos, setAbertos] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      aria-busy={pendente}
      className={`flex flex-col gap-2 transition-opacity ${
        pendente ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2">
      {/* Busca */}
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          aria-label="Buscar leads"
          className={`${fieldCls} h-11 w-full rounded-lg pl-9 pr-3 placeholder:text-ink-faint md:h-9`}
        />
      </div>

        {/* No celular o resto dos filtros fica atrás deste botão: eram 8 selects
            + 2 campos de data, ~350px de altura ANTES de qualquer resultado — o
            consultor rolava quase duas telas pra chegar no que veio buscar. */}
        <button
          type="button"
          onClick={() => setAbertos((v) => !v)}
          aria-expanded={abertos}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink md:hidden"
        >
          Filtros
          {ativosOcultos > 0 && (
            <span className="tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand/20 px-1 text-[11px] font-semibold text-brand">
              {ativosOcultos}
            </span>
          )}
        </button>
      </div>

      <div className={`${abertos ? "flex" : "hidden"} flex-wrap items-center gap-2 md:flex`}>
      <Select value={filtro} onChange={(v) => { setFiltro(v); apply({ filtro: v }); }} label="Situação">
        {FILTROS.map((f) => (
          <option key={f.v} value={f.v}>
            {f.label}
          </option>
        ))}
      </Select>

      <Select value={perfil} onChange={(v) => { setPerfil(v); apply({ perfil: v }); }} label="Perfil">
        <option value="">Todos os perfis</option>
        {PERFIL_ORDER.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </Select>

      <Select value={estagio} onChange={(v) => { setEstagio(v); apply({ estagio: v }); }} label="Estágio">
        <option value="">Todos os estágios</option>
        {listaEtapas.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </Select>

      <Select value={uf} onChange={(v) => { setUf(v); apply({ uf: v }); }} label="UF">
        <option value="">UF</option>
        {ufs.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </Select>

      <Select value={cnpj} onChange={(v) => { setCnpj(v); apply({ cnpj: v }); }} label="CNPJ">
        <option value="">CNPJ</option>
        <option value="sim">Com CNPJ</option>
        <option value="nao">Sem CNPJ</option>
      </Select>

      {campanhas.length > 0 && (
        <Select
          value={campanha}
          onChange={(v) => {
            setCampanha(v);
            apply({ campanha: v });
          }}
          label="Campanha"
        >
          <option value="">Todas as campanhas</option>
          {campanhas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      )}

      <Select
        value={resultado}
        onChange={(v) => {
          setResultado(v);
          apply({ resultado: v });
        }}
        label="Desfecho"
      >
        <option value="">Todos os desfechos</option>
        {/* Rótulo curto de propósito: a largura de um <select> é ditada pela
            opção mais longa, e esta sozinha passava de 280px — no celular
            empurrava o filtro pra uma linha só dele. */}
        <option value="abertos" title="Sem desfecho ou ainda negociando">
          Em aberto
        </option>
        <option value="andamento">Sem desfecho</option>
        {RESULTADO_ORDER.map((r) => (
          <option key={r.key} value={r.key}>
            {r.label}
          </option>
        ))}
      </Select>

      {/* Período de ENTRADA do lead (primeira interação) */}
      <div className="flex items-center gap-1.5" title="Leads que entraram neste período">
        <input
          type="date"
          value={de}
          max={ate || undefined}
          onChange={(e) => setDe(e.target.value)}
          aria-label="Entraram a partir de"
          className={`${fieldCls} tnum h-9 rounded-lg px-2.5 font-mono`}
        />
        <span className="text-[11px] text-ink-faint">até</span>
        <input
          type="date"
          value={ate}
          min={de || undefined}
          onChange={(e) => setAte(e.target.value)}
          aria-label="Entraram até"
          className={`${fieldCls} tnum h-9 rounded-lg px-2.5 font-mono`}
        />
      </div>

      <button
        type="submit"
        className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3.5 text-[12.5px] font-semibold text-brand transition hover:bg-brand/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 md:h-9"
      >
        Filtrar
      </button>

      {hasFilters && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink md:h-9"
        >
          Limpar
        </button>
      )}
      </div>
    </form>
  );
}
