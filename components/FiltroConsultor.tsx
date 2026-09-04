"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Filtro "de quem são os leads" — só para ADMIN. O consultor não vê (a lista
 * dele já é escopada no servidor). Some quando existe um consultor só: enquanto
 * não há divisão, o seletor é ruído.
 */
export function FiltroConsultor({
  consultores,
  atual,
}: {
  consultores: { slug: string; nome: string }[];
  atual?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Antes do early return: hook não pode ficar depois de um `return` condicional.
  const [pendente, iniciar] = useTransition();

  if (!consultores || consultores.length < 2) return null;

  function trocar(slug: string) {
    const q = new URLSearchParams(params?.toString() ?? "");
    if (slug) q.set("consultor", slug);
    else q.delete("consultor");
    iniciar(() => router.push(`${pathname}?${q.toString()}`));
  }

  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="hidden text-[11px] text-ink-faint sm:inline">Consultor</span>
      <select
        value={atual ?? ""}
        onChange={(e) => trocar(e.target.value)}
        disabled={pendente}
        aria-label="Filtrar por consultor"
        aria-busy={pendente}
        className="rounded-full border border-line bg-surface-2/60 px-3 py-1.5 text-[12px] text-ink outline-none transition hover:border-line-strong focus-visible:border-brand/60 disabled:opacity-50"
      >
        <option value="">Todos</option>
        {consultores.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
