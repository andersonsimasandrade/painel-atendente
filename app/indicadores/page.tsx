import Link from "next/link";
import { SubNav } from "@/components/SubNav";
import { Panel } from "@/components/Panel";
import { GeradorLinks } from "@/components/indicadores/GeradorLinks";
import { montarIndicadores, type Linha } from "@/lib/indicadores";
import { hojeSP, addDias } from "@/lib/trafego";
import { inicioProjeto } from "@/lib/periodo";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RANGES: Record<string, { label: string; desde: (h: string) => string }> = {
  "7d": { label: "7 dias", desde: (h) => addDias(h, -7) },
  "30d": { label: "30 dias", desde: (h) => addDias(h, -30) },
  tudo: { label: "Tudo", desde: () => inicioProjeto() },
};

const ROTULO_CANAL: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta / Instagram",
  organico: "Busca orgânica",
  direto: "Direto",
  outro: "Outros",
  todos: "Total",
};

const brl = (v: number | null) => (v == null ? "—" : formatBRL(v));
const por = (custo: number | null, n: number) => (custo != null && custo > 0 && n > 0 ? formatBRL(custo / n) : "—");
const taxa = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

function Cartao({ titulo, valor, dica }: { titulo: string; valor: string; dica?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] px-4 py-3.5">
      <p className="font-display text-[22px] font-semibold leading-none text-ink">{valor}</p>
      <p className="mt-1.5 text-[11.5px] text-ink-muted">{titulo}</p>
      {dica && <p className="mt-0.5 text-[10.5px] text-ink-muted/70">{dica}</p>}
    </div>
  );
}

function Tabela({ linhas, nivel }: { linhas: Linha[]; nivel: "canal" | "campanha" | "criativo" }) {
  if (linhas.length === 0) {
    return <p className="px-1 py-3 text-[12.5px] text-ink-muted">Ainda sem dados neste período.</p>;
  }
  const cab = [
    nivel === "canal" ? "Canal" : nivel === "campanha" ? "Campanha" : "Criativo",
    "Visitas",
    "Clicaram",
    "Pedidos",
    "Conversas",
    "Compareceram",
    "Fechados",
    "Receita",
    "Custo",
    "Custo/conversa",
    "Custo/compar.",
  ];
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            {cab.map((c, i) => (
              <th key={c} className={`px-2 py-2 font-medium ${i === 0 ? "" : "text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {linhas.map((l) => (
            <tr key={l.chave}>
              <td className="px-2 py-2">
                <span className="font-semibold text-ink">
                  {nivel === "canal" ? (ROTULO_CANAL[l.canal] ?? l.canal) : nivel === "campanha" ? l.campanha : l.criativo}
                </span>
                {nivel !== "canal" && (
                  <span className="ml-1.5 text-[11px] text-ink-muted">
                    {ROTULO_CANAL[l.canal] ?? l.canal}
                    {nivel === "criativo" ? ` · ${l.campanha}` : ""}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-right">{l.visitantes}</td>
              <td className="px-2 py-2 text-right">
                {l.cliques}
                <span className="ml-1 text-[10.5px] text-ink-muted">{taxa(l.cliques, l.visitantes)}</span>
              </td>
              <td className="px-2 py-2 text-right">{l.pedidos}</td>
              <td className="px-2 py-2 text-right">{l.conversas}</td>
              <td className="px-2 py-2 text-right">{l.compareceram}</td>
              <td className="px-2 py-2 text-right">{l.fechados}</td>
              <td className="px-2 py-2 text-right">{l.receita > 0 ? brl(l.receita) : "—"}</td>
              <td className="px-2 py-2 text-right">{brl(l.custo)}</td>
              <td className="px-2 py-2 text-right">{por(l.custo, l.conversas)}</td>
              <td className="px-2 py-2 text-right">{por(l.custo, l.compareceram)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function IndicadoresPage({ searchParams }: { searchParams: { range?: string } }) {
  const range = searchParams?.range && RANGES[searchParams.range] ? searchParams.range : "30d";
  const hoje = hojeSP();
  const desde = RANGES[range].desde(hoje);
  const r = await montarIndicadores(desde, hoje);
  const t = r.total;
  const custoTotal = r.custo.google + r.custo.meta;

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Indicadores" subtitle="Do clique ao paciente · por canal, campanha e criativo" />
      <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(RANGES).map(([k, rr]) => (
            <Link
              key={k}
              href={`/indicadores?range=${k}`}
              aria-current={range === k ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${
                range === k
                  ? "bg-brand/10 text-brand ring-1 ring-inset ring-brand/25"
                  : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
              }`}
            >
              {rr.label}
            </Link>
          ))}
          <Link href="/trafego/comparativo" className="ml-auto text-[12.5px] text-ink-muted underline-offset-2 hover:underline">
            Comparativo Google × Meta →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Cartao titulo="Investimento" valor={brl(custoTotal > 0 ? custoTotal : null)} />
          <Cartao titulo="Visitantes do site" valor={String(t.visitantes)} dica={`${taxa(t.cliques, t.visitantes)} clicaram para agendar`} />
          <Cartao titulo="Pedidos de agendamento" valor={String(t.pedidos)} />
          <Cartao titulo="Viraram conversa" valor={String(t.conversas)} dica={`custo ${por(custoTotal, t.conversas)}`} />
          <Cartao titulo="Compareceram" valor={String(t.compareceram)} dica={`custo ${por(custoTotal, t.compareceram)}`} />
          <Cartao titulo="Receita fechada" valor={t.receita > 0 ? brl(t.receita) : "—"} dica={`${t.fechados} fechado(s)`} />
        </div>

        {!r.temEventos && (
          <p className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-[12.5px] text-ink">
            A medição das visitas do site começou agora. Visitas, rolagem e cliques aparecem aqui a partir do primeiro acesso
            registrado. Pedidos, conversas e consultas já vêm do CRM.
          </p>
        )}

        <Panel title="Por canal" subtitle="De onde vem quem chega e quanto custa cada degrau">
          <Tabela linhas={r.porCanal} nivel="canal" />
        </Panel>
        <Panel title="Por campanha" subtitle="O custo aparece quando a campanha tem o nome ligado ao Google Ads (lib/indicadores.ts)">
          <Tabela linhas={r.porCampanha} nivel="campanha" />
        </Panel>
        <Panel
          title="Por criativo (teste A/B)"
          subtitle="Cada anúncio/post com seu ID no link. Compare pelo que chega ao consultório, não só pelo clique"
        >
          <Tabela linhas={r.porCriativo} nivel="criativo" />
        </Panel>
        <Panel title="Gerador de links com padrão de nomes" subtitle="Use sempre este padrão em anúncios, bio, stories e comentários">
          <GeradorLinks />
        </Panel>
      </main>
    </div>
  );
}
