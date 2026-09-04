import { CidadeCount, DesfechoCounts, RegiaoCount } from "@/lib/types";
import { RESULTADO_ORDER } from "@/lib/theme";
import { formatNumber } from "@/lib/format";


/**
 * Resumo "de onde estão vindo os leads" + desfechos, calculado DENTRO do
 * filtro atual da lista (combina com o filtro de data pra medir origem por
 * período). Só leitura; os filtros ficam na barra acima.
 */
export function LeadsOrigem({
  porUf,
  porCidade,
  desfechos,
  totalFiltrado,
}: {
  porUf: RegiaoCount[];
  porCidade: CidadeCount[];
  desfechos: DesfechoCounts;
  totalFiltrado: number;
}) {
  if (!totalFiltrado) return null;
  const topUf = porUf.slice(0, 6);
  const maxUf = Math.max(...topUf.map((u) => u.count), 1);
  // "Concluído" = desfecho TERMINAL (em negociação / reunião agendada seguem vivos).
  const concluidos = RESULTADO_ORDER.filter((r) => r.terminal).reduce(
    (soma, r) => soma + (desfechos[r.key] ?? 0),
    0,
  );

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
      {/* Desfechos dentro do filtro */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-faint">
          Desfechos · {formatNumber(concluidos)} concluído{concluidos === 1 ? "" : "s"}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {RESULTADO_ORDER.map((r) => {
            const n = desfechos[r.key] ?? 0;
            return (
              <span
                key={r.key}
                className={`tnum inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium leading-none ${
                  n > 0 ? "tag-ink" : "text-ink-faint ring-1 ring-inset ring-line"
                }`}
                style={
                  n > 0
                    ? ({
                        "--tag": r.color,
                        backgroundColor: `${r.color}1a`,
                        boxShadow: `inset 0 0 0 1px ${r.color}3d`,
                      } as React.CSSProperties)
                    : undefined
                }
              >
                {r.label} · {formatNumber(n)}
              </span>
            );
          })}
          <span className="tnum inline-flex items-center rounded-full bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-medium leading-none text-ink-muted ring-1 ring-inset ring-white/10">
            Sem desfecho · {formatNumber(desfechos.andamento ?? 0)}
          </span>
        </div>
      </div>

      {/* Por estado */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-faint">
          Por estado
        </p>
        {topUf.length === 0 ? (
          <p className="mt-2.5 text-[12.5px] text-ink-faint">Sem UF informada.</p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {topUf.map((u) => (
              <li key={u.uf} className="flex items-center gap-2">
                <span className="w-8 shrink-0 font-mono text-[11.5px] text-ink-muted">
                  {u.uf}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <span
                    className="block h-full rounded-full bg-brand/70"
                    style={{ width: `${Math.max(4, (u.count / maxUf) * 100)}%` }}
                  />
                </span>
                <span className="tnum w-8 shrink-0 text-right text-[11.5px] text-ink-muted">
                  {formatNumber(u.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Por cidade */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-faint">
          Cidades com mais leads
        </p>
        {porCidade.length === 0 ? (
          <p className="mt-2.5 text-[12.5px] text-ink-faint">Sem cidade informada.</p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {porCidade.slice(0, 8).map((c) => (
              <span
                key={`${c.cidade}|${c.uf ?? ""}`}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[11.5px] text-ink-muted"
              >
                {c.cidade}
                {c.uf && (
                  <span className="font-mono text-[10px] text-ink-faint">{c.uf}</span>
                )}
                <span className="tnum font-semibold text-ink">{formatNumber(c.count)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
