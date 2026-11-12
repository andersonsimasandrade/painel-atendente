import Link from "next/link";
import { redirect } from "next/navigation";
import { SubNav } from "@/components/SubNav";
import { getSessao } from "@/lib/session";
import { listarRecibos } from "@/lib/recibo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const dh = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function mesAtual(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 7);
}
function somaMes(mes: string, d: number): string {
  const [a, m] = mes.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1 + d, 1));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function RecibosPage({ searchParams }: { searchParams: { mes?: string } }) {
  const sess = await getSessao();
  if (sess?.papel === "vendedor") redirect("/leads");
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.mes ?? "") ? (searchParams.mes as string) : mesAtual();
  const linhas = await listarRecibos(mes).catch(() => []);
  const enviados = linhas.filter((l) => l.estado === "enviado");
  const total = enviados.reduce((t, l) => t + l.valor, 0);
  const [a, m] = mes.split("-").map(Number);
  const link = "rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink";

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Recibos" subtitle="Recibos da fisioterapia enviados depois da sessão, para a contabilidade" />
      <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/recibos?mes=${somaMes(mes, -1)}`} className={link}>
            ← {MESES[(m + 10) % 12]}
          </Link>
          <span className="px-2 text-[15px] font-semibold capitalize text-ink">
            {MESES[m - 1]} de {a}
          </span>
          <Link href={`/recibos?mes=${somaMes(mes, 1)}`} className={link}>
            {MESES[m % 12]} →
          </Link>
          <a href={`/api/recibos/csv?mes=${mes}`} className={`${link} ml-auto`}>
            Baixar planilha do mês (Excel)
          </a>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Recibos enviados", String(enviados.length)],
            ["Valor total enviado", brl(total)],
            ["Dispensados (sem recibo)", String(linhas.filter((l) => l.estado === "dispensado").length)],
            ["Emitidos, não enviados", String(linhas.filter((l) => l.estado === "emitido").length)],
          ].map(([r, v]) => (
            <div key={r} className="card-surface rounded-xl border border-line px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-ink-faint">{r}</p>
              <p className="mt-1 text-[20px] font-semibold text-ink">{v}</p>
            </div>
          ))}
        </div>

        <div className="card-surface overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-4 py-2.5">Nº</th>
                <th className="px-4 py-2.5">Paciente</th>
                <th className="px-4 py-2.5">Sessão</th>
                <th className="px-4 py-2.5">Valor</th>
                <th className="px-4 py-2.5">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.numero} className="border-t border-line">
                  <td className="px-4 py-2.5 font-mono text-ink-muted">{String(l.numero).padStart(6, "0")}</td>
                  <td className="px-4 py-2.5 text-ink">{l.nome ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{dBR(l.data_sessao)}</td>
                  <td className="px-4 py-2.5 text-ink">{brl(l.valor)}</td>
                  <td className="px-4 py-2.5">
                    {l.estado === "enviado" ? (
                      <span className="text-brand">Enviado em {dh(l.enviado_em ?? l.emitido_em)}</span>
                    ) : l.estado === "dispensado" ? (
                      <span className="text-ink-muted">Dispensado (sem recibo)</span>
                    ) : (
                      <span className="text-amber">Emitido, não enviado</span>
                    )}
                  </td>
                </tr>
              ))}
              {!linhas.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    Nenhum recibo neste mês ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
