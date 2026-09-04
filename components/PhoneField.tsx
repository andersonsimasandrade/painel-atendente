"use client";

import { useState } from "react";
import { PAISES, bandeira, paisPorIso, separarDDI } from "@/lib/paises";

// Campo de telefone com seletor de país. Emite o número COMPLETO (DDI + local,
// só dígitos) via onChange. Brasil (+55) é o default. Usado no agendamento
// público (variant light) e no criar-convite (variant dark).
export function PhoneField({
  value,
  onChange,
  variant = "light",
  autoFocus,
}: {
  value: string;
  onChange: (full: string) => void;
  variant?: "light" | "dark";
  autoFocus?: boolean;
}) {
  // Estado interno inicializado a partir do value (uma vez).
  const [iso, setIso] = useState(() => separarDDI(value).pais.iso);
  const [local, setLocal] = useState(() => separarDDI(value).local);

  function emit(nextIso: string, nextLocal: string) {
    const ddi = paisPorIso(nextIso)?.ddi ?? "55";
    onChange(ddi + nextLocal.replace(/\D/g, ""));
  }

  const base =
    variant === "dark"
      ? {
          wrap: "border-line bg-base/70",
          sel: "bg-base/70 text-ink border-line",
          inp: "text-ink placeholder:text-ink-faint",
          focus: "focus-within:border-brand/60",
        }
      : {
          wrap: "border-[#ddd6cc] bg-white",
          sel: "bg-white text-[#2b2b2b] border-[#ddd6cc]",
          inp: "text-[#2b2b2b] placeholder:text-[#a89f95]",
          focus: "focus-within:border-[#2f9e5e]",
        };

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border transition ${base.wrap} ${base.focus}`}
    >
      <select
        aria-label="País"
        value={iso}
        onChange={(e) => {
          setIso(e.target.value);
          emit(e.target.value, local);
        }}
        className={`w-[118px] shrink-0 border-r ${base.sel} px-2 py-2.5 text-[13px] outline-none`}
      >
        {PAISES.map((p) => (
          <option key={p.iso} value={p.iso}>
            {bandeira(p.iso)} +{p.ddi} · {p.nome}
          </option>
        ))}
      </select>
      <input
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          emit(iso, e.target.value);
        }}
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder="DDD + número"
        className={`min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-mono text-[14px] outline-none ${base.inp}`}
      />
    </div>
  );
}
