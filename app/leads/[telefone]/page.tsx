import { ReactNode } from "react";
import Link from "next/link";
import { getLead, getConversa, getNotas, getPainelConfig } from "@/lib/db";
import { getEtapas } from "@/lib/funil";
import {
  formatPhone,
  relativeTime,
  formatDateTime,
  formatBRL,
  formatNumber,
  initials,
} from "@/lib/format";
import { stageMeta } from "@/lib/theme";
import { SubNav } from "@/components/SubNav";
import { LiveStatus } from "@/components/LiveStatus";
import { Panel } from "@/components/Panel";
import { MudarEstagio } from "@/components/MudarEstagio";
import { EditarNome } from "@/components/EditarNome";
import { notFound } from "next/navigation";
import { getSessao } from "@/lib/session";
import { podeVerLead } from "@/lib/escopo";
import { PerfilBadge } from "@/components/PerfilBadge";
import { OrigemBadge } from "@/components/OrigemBadge";
import { LeadTimeline } from "@/components/LeadTimeline";
import { FecharLead } from "@/components/FecharLead";
import { ConcluirLead } from "@/components/ConcluirLead";
import { MudarPerfil } from "@/components/MudarPerfil";
import { EditarLocal } from "@/components/EditarLocal";
import { EditarCampo } from "@/components/EditarCampo";
import { NotasLead } from "@/components/NotasLead";
import { ResumoIA } from "@/components/ResumoIA";
import { Conversa } from "@/components/Conversa";
import { EmptyState } from "@/components/EmptyState";
import { DbErrorState } from "@/components/DbErrorState";
import { Sigilo } from "@/components/Sigilo";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

const Dash = () => <span className="text-ink-faint">—</span>;

function StateBadge({
  label,
  tone,
}: {
  label: string;
  tone: "brand" | "amber" | "muted";
}) {
  const cls =
    tone === "brand"
      ? "text-brand bg-brand/10 ring-brand/25"
      : tone === "amber"
        ? "text-amber bg-amber/10 ring-amber/25"
        : "text-ink-muted bg-white/[0.04] ring-white/10";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: { telefone: string };
}) {
  const telefone = params.telefone;
  // Escopo: um consultor não abre o lead de outro nem digitando a URL.
  // Responde "não encontrado" (não confirma que o lead existe).
  const sess = await getSessao();
  if (!(await podeVerLead(sess, telefone))) notFound();

  const [result, conversa, notas, etapas, cfgPainel] = await Promise.all([
    getLead(telefone),
    getConversa(telefone),
    getNotas(telefone),
    getEtapas(),
    getPainelConfig(),
  ]);

  if (!result.ok) {
    return <DbErrorState error={result.error} />;
  }

  if (!result.lead) {
    return (
      <div className="relative z-[1] min-h-screen">
        <SubNav title="Lead não encontrado" back="/leads" backLabel="Leads" />
        <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
          <Panel>
            <EmptyState
              title="Não encontramos esse lead"
              hint="O telefone pode ter sido removido da base ou o link está incorreto."
            />
            <div className="mt-4 flex justify-center">
              <Link
                href="/leads"
                className="inline-flex h-9 items-center rounded-lg border border-line px-3.5 text-[12.5px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink"
              >
                Voltar para a lista
              </Link>
            </div>
          </Panel>
        </main>
      </div>
    );
  }

  const lead = result.lead;
  const eventos = result.eventos;
  const meta = stageMeta(lead.funnel_stage);

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav
        title={<Sigilo>{lead.nome?.trim() || "Lead sem nome"}</Sigilo>}
        subtitle={<Sigilo>{formatPhone(lead.telefone)}</Sigilo>}
        back="/leads"
        backLabel="Leads"
        right={
          <>
            <Link
              href={`/conversas?tel=${encodeURIComponent(lead.telefone)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1a8.5 8.5 0 0 1-.9-3.9A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Responder
            </Link>
            <LiveStatus generatedAt={new Date().toISOString()} />
          </>
        }
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Perfil */}
        <Panel delay={80}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3.5">
              <span
                className="tag-ink flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-[16px] font-semibold"
                style={{ "--tag": meta.color, background: `${meta.color}1f` } as React.CSSProperties}
              >
                <Sigilo>{initials(lead.nome)}</Sigilo>
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                  <Sigilo>
                    <EditarNome telefone={lead.telefone} nome={lead.nome} />
                  </Sigilo>
                </h2>
                <p className="font-mono text-[12.5px] text-ink-muted">
                  <Sigilo>{formatPhone(lead.telefone)}</Sigilo>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <MudarEstagio
                  telefone={lead.telefone}
                  stageAtual={lead.funnel_stage}
                  etapas={etapas}
                />
                <MudarPerfil telefone={lead.telefone} perfilAtual={lead.perfil} />
                <StateBadge
                  label={lead.lead_ativo ? "Lead ativo" : "Inativo"}
                  tone={lead.lead_ativo ? "brand" : "muted"}
                />
                {lead.fechado === true && (
                  <StateBadge label="Negócio fechado" tone="brand" />
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Categoria">
                <PerfilBadge perfil={lead.perfil} size="sm" />
              </Field>
              <Field label="Cidade / UF">
                <EditarLocal
                  telefone={lead.telefone}
                  cidade={lead.cidade}
                  uf={lead.uf}
                />
              </Field>
              <Field label="CNPJ">
                {lead.cnpj === true ? (
                  <span className="text-brand">
                    Sim
                    {lead.cnpj_numero && (
                      <Sigilo className="ml-1.5 font-mono text-[12.5px] text-ink">
                        {lead.cnpj_numero.replace(
                          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                          "$1.$2.$3/$4-$5",
                        )}
                      </Sigilo>
                    )}
                  </span>
                ) : lead.cnpj === false ? (
                  <span className="text-ink-muted">Não</span>
                ) : (
                  <Dash />
                )}
              </Field>
              <Field label="Marca atual">
                <EditarCampo
                  key={`marca:${lead.marca_atual ?? ""}`}
                  telefone={lead.telefone}
                  campo="marca"
                  valorInicial={lead.marca_atual ?? ""}
                  placeholder="Marca atual"
                >
                  {lead.marca_atual || <Dash />}
                </EditarCampo>
              </Field>

              <Field label="Etapa da conversa (bot)">
                {lead.estagio_conversa ? (
                  <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-ink-muted ring-1 ring-inset ring-white/10">
                    {lead.estagio_conversa}
                  </span>
                ) : (
                  <Dash />
                )}
              </Field>

              <Field label="Investimento previsto">
                <EditarCampo
                  key={`inv:${lead.valor_investimento ?? ""}`}
                  telefone={lead.telefone}
                  campo="investimento"
                  valorInicial={
                    lead.valor_investimento != null
                      ? String(lead.valor_investimento).replace(".", ",")
                      : ""
                  }
                  placeholder="Investimento previsto"
                >
                  {formatBRL(lead.valor_investimento)}
                </EditarCampo>
              </Field>
              <Field label="Origem" className="sm:col-span-2 lg:col-span-2">
                <EditarCampo
                  key={`ori:${lead.origem_campanha ?? ""}`}
                  telefone={lead.telefone}
                  campo="origem"
                  valorInicial={lead.origem_campanha ?? ""}
                  placeholder="Origem (ex.: Indicação)"
                >
                  <OrigemBadge
                    campanha={lead.origem_campanha}
                    ad={lead.origem_ad}
                    size="md"
                  />
                </EditarCampo>
              </Field>
              <Field label="Canal preferido">
                {lead.preferencia_canal
                  ? lead.preferencia_canal === "audio"
                    ? "Áudio"
                    : "Texto"
                  : <Dash />}
              </Field>

              <Field label="Primeira interação">
                {lead.primeira_interacao ? (
                  <span title={formatDateTime(lead.primeira_interacao)}>
                    {formatDateTime(lead.primeira_interacao)}
                  </span>
                ) : (
                  <Dash />
                )}
              </Field>
              <Field label="Última interação">
                <span title={formatDateTime(lead.ultima_interacao)}>
                  {relativeTime(lead.ultima_interacao)}
                </span>
              </Field>
              <Field label="Mensagens">
                <span className="tnum">{formatNumber(lead.total_mensagens)}</span>
              </Field>
              <Field label="Follow-ups">
                <span className="tnum">{formatNumber(lead.followup_count)}</span>
                {lead.last_followup && (
                  <span className="ml-1.5 text-[11.5px] text-ink-faint">
                    (últ. {relativeTime(lead.last_followup)})
                  </span>
                )}
              </Field>
            </dl>

            {lead.observacoes && (
              <div className="border-t border-line pt-4">
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Observações</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">
                  {lead.observacoes}
                </p>
              </div>
            )}

            <ConcluirLead
              telefone={lead.telefone}
              resultado={lead.resultado}
              motivo={lead.resultado_motivo}
              resultadoEm={lead.resultado_em}
            />

            <FecharLead
              telefone={lead.telefone}
              fechado={lead.fechado === true}
              valorFechado={lead.valor_fechado}
              dataFechamento={lead.data_fechamento}
            />
          </div>
        </Panel>

        {/* Resumo & score IA */}
        <Panel
          title="Resumo & score do lead"
          subtitle="Gerado por IA a partir da conversa"
          className="mt-4"
          delay={110}
        >
          <ResumoIA
            telefone={lead.telefone}
            initial={{
              resumo: lead.resumo_ia,
              temperatura: lead.temperatura_ia,
              proxima_acao: lead.proxima_acao_ia,
              resumo_em: lead.resumo_em,
            }}
          />
        </Panel>

        {/* Anotações + Timeline + Conversa */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-5">
            <Panel
              title="Anotações do consultor"
              subtitle="Notas internas do time — o lead não vê"
              delay={140}
            >
              <NotasLead telefone={lead.telefone} initial={notas} />
            </Panel>

            <Panel
              title="Linha do tempo"
              subtitle="Avanços no funil registrados pelo robô"
              delay={160}
            >
              <LeadTimeline eventos={eventos} />
            </Panel>
          </div>

          <Panel
            title="Conversa"
            subtitle="Histórico completo no WhatsApp"
            className="lg:col-span-7"
            delay={180}
          >
            <Conversa
              telefone={lead.telefone}
              initialMessages={conversa}
              atendenteNome={cfgPainel.atendente_nome}
            />
          </Panel>
        </div>

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-line pt-5 text-[11px] text-ink-faint sm:flex-row">
          <span>{empresaNome()} · Perfil 360 do lead — dados ao vivo do Supabase</span>
          <Link href="/leads" className="text-ink-muted transition hover:text-ink">
            ← Voltar para a lista de leads
          </Link>
        </footer>
      </main>
    </div>
  );
}
