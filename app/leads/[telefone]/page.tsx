import { ReactNode } from "react";
import Link from "next/link";
import { getLead, getNotas } from "@/lib/db";
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
import { notFound, redirect } from "next/navigation";
import { resolverLead } from "@/lib/agenda";
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
import { FichaLayout } from "@/components/lead/FichaLayout";
import { InboxChat } from "@/components/inbox/InboxChat";
import { EmptyState } from "@/components/EmptyState";
import { DbErrorState } from "@/components/DbErrorState";
import { Sigilo } from "@/components/Sigilo";
import { empresaNome } from "@/lib/config";
import { instagramDoLead } from "@/lib/ig-dados";
import { formatDateTime as fmtDataHora } from "@/lib/format";
import { listarNegocios } from "@/lib/negocios";
import { getExtraLead, voltouAFalar } from "@/lib/lead-extra";
import { NegociosLead } from "@/components/lead/NegociosLead";
import { SessoesPaciente } from "@/components/lead/SessoesPaciente";
import { listarSessoesPaciente } from "@/lib/sessoes-paciente";
import { Prontuario } from "@/components/lead/Prontuario";
import { listarProntuario } from "@/lib/prontuario";
import { Prescricoes } from "@/components/lead/Prescricoes";
import { listarExercicios, listarPrescricoes } from "@/lib/exercicios";
import { Devolutivas } from "@/components/lead/Devolutivas";
import { listarDevolutivas, nascimentoDoPaciente } from "@/lib/devolutivas";
import { EditarEndereco } from "@/components/lead/EditarEndereco";
import { OrigemCanalLead } from "@/components/lead/OrigemCanalLead";

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
  // O mesmo número pode vir com ou sem o 9 (o WhatsApp entrega sem): abre a ficha na forma que o cadastro conhece.
  const canonico = await resolverLead(telefone);
  if (canonico && canonico !== telefone) redirect(`/leads/${encodeURIComponent(canonico)}`);
  // Escopo: um consultor não abre o lead de outro nem digitando a URL.
  // Responde "não encontrado" (não confirma que o lead existe).
  const sess = await getSessao();
  if (!(await podeVerLead(sess, telefone))) notFound();

  const [result, notas, etapas, instagram, negocios, extra, sessoesInfo, prontuario, prescricoes, biblioteca, devolutivas, nascimento] = await Promise.all([
    getLead(telefone),
    getNotas(telefone),
    getEtapas(),
    instagramDoLead(telefone).catch(() => null),
    listarNegocios(telefone).catch(() => []),
    getExtraLead(telefone),
    listarSessoesPaciente(telefone).catch(() => ({ sessoes: [], pacote: { comprado: 0, realizadas: 0, marcadas: 0, restantes: 0 } })),
    listarProntuario(telefone).catch(() => ({ exames: [], evolucoes: [] })),
    listarPrescricoes(telefone).catch(() => []),
    listarExercicios().catch(() => []),
    listarDevolutivas(telefone).catch(() => []),
    nascimentoDoPaciente(telefone).catch(() => null),
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
  const ultimoEncerrado = negocios.find((n) => n.status !== "aberto")?.fechado_em ?? null;
  const voltou = negocios.some((n) => n.status === "aberto") ? false : await voltouAFalar(lead.telefone, ultimoEncerrado);

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
              href={`/agenda?novo=1&telefone=${encodeURIComponent(lead.telefone)}&nome=${encodeURIComponent(lead.nome ?? "")}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-line-strong"
            >
              + Nova sessão
            </Link>
            <a
              href="#conversa"
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
            </a>
            <LiveStatus generatedAt={new Date().toISOString()} />
          </>
        }
      />

      <main className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <FichaLayout
          abas={[
            {
              id: "resumo",
              label: "Resumo",
              conteudo: (
                <>
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
              <Field label="CPF / CNPJ">
                <EditarCampo
                  key={`cnpj:${lead.cnpj_numero ?? ""}`}
                  telefone={lead.telefone}
                  campo="cnpj"
                  valorInicial={lead.cnpj_numero ?? ""}
                  placeholder="CPF ou CNPJ (só números)"
                >
                  {lead.cnpj_numero ? (
                    <Sigilo className="font-mono text-[12.5px] text-ink">
                      {lead.cnpj_numero.length === 14
                        ? lead.cnpj_numero.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
                        : lead.cnpj_numero.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}
                    </Sigilo>
                  ) : (
                    <Dash />
                  )}
                </EditarCampo>
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
                <EditarCampo
                  key={`etapa:${lead.estagio_conversa ?? ""}`}
                  telefone={lead.telefone}
                  campo="etapa"
                  valorInicial={lead.estagio_conversa ?? ""}
                  placeholder="Etapa da conversa"
                >
                  {lead.estagio_conversa ? (
                    <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-ink-muted ring-1 ring-inset ring-white/10">
                      {lead.estagio_conversa}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </EditarCampo>
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
              <Field label="Origem do contato">
                <OrigemCanalLead
                  key={`oc:${extra.origem_canal ?? ""}:${extra.origem_manual}`}
                  telefone={lead.telefone}
                  valor={extra.origem_canal}
                  manual={extra.origem_manual}
                  temClique={{ google: extra.tem_gclid, meta: extra.tem_fbclid }}
                />
              </Field>
              <Field label="Origem (campanha ou anúncio)" className="sm:col-span-2 lg:col-span-2">
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
                <EditarCampo
                  key={`canal:${lead.preferencia_canal ?? ""}`}
                  telefone={lead.telefone}
                  campo="canal"
                  valorInicial={lead.preferencia_canal === "audio" ? "áudio" : lead.preferencia_canal ?? ""}
                  placeholder="Canal (texto ou áudio)"
                >
                  {lead.preferencia_canal ? (lead.preferencia_canal === "audio" ? "Áudio" : "Texto") : <Dash />}
                </EditarCampo>
              </Field>
              <Field label="E-mail">
                <EditarCampo
                  key={`email:${extra.email ?? ""}`}
                  telefone={lead.telefone}
                  campo="email"
                  valorInicial={extra.email ?? ""}
                  placeholder="E-mail"
                >
                  {extra.email ? <Sigilo>{extra.email}</Sigilo> : <Dash />}
                </EditarCampo>
              </Field>
              <Field label="Endereço e cidade (busca pelo CEP)" className="col-span-2 sm:col-span-3 lg:col-span-4">
                <Sigilo>
                  <EditarEndereco
                    key={`end:${extra.cep ?? ""}:${extra.logradouro ?? ""}:${extra.numero ?? ""}:${extra.cidade ?? ""}`}
                    telefone={lead.telefone}
                    inicial={{
                      cep: extra.cep,
                      logradouro: extra.logradouro,
                      numero: extra.numero,
                      complemento: extra.complemento,
                      bairro: extra.bairro,
                      cidade: extra.cidade ?? lead.cidade,
                      uf: extra.uf ?? lead.uf,
                    }}
                  />
                </Sigilo>
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
              sessoes={negocios.find((n) => n.status === "ganho")?.sessoes ?? 1}
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


        {/* Negociações: histórico de cada tentativa de venda/atendimento */}
        <Panel
          title="Negociações"
          subtitle="Cada tentativa de atendimento fica registrada: em andamento, concretizada ou perdida"
          className="mt-4"
          delay={100}
        >
          <NegociosLead telefone={lead.telefone} negocios={negocios} voltouAFalar={voltou} />
        </Panel>


        {/* Instagram (quando a pessoa também conversou por lá) */}
        {instagram && (
          <Panel
            title="Também conversou no Instagram"
            subtitle={`${instagram.contato.nome ?? ""} ${instagram.contato.username ? "@" + instagram.contato.username : ""}`.trim() || "Conversa ligada pelo WhatsApp"}
            action={
              <Link
                href={`/instagram?id=${instagram.contato.ig_id}`}
                className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:bg-surface-2/50"
              >
                Abrir no Instagram
              </Link>
            }
            className="mt-4"
            delay={120}
          >
            <ul className="flex flex-col gap-1.5">
              {instagram.mensagens.slice(-8).map((m) => (
                <li key={m.id} className="rounded-lg border border-line bg-surface-2/30 px-3 py-1.5 text-[12.5px] text-ink-muted">
                  <span className="mr-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
                    {m.papel === "user" ? "Paciente" : m.papel === "humano" ? "Você" : "Robô"} · {fmtDataHora(m.criado_em)}
                  </span>
                  {m.texto}
                </li>
              ))}
            </ul>
          </Panel>
        )}


                  <div className="mt-4">
            <Panel
              title="Linha do tempo"
              subtitle="Avanços no funil registrados pelo robô"
              delay={160}
            >
              <LeadTimeline eventos={eventos} />
            </Panel>
                  </div>
                </>
              ),
            },
            {
              id: "sessoes",
              label: "Sessões e anotações",
              selo: sessoesInfo.pacote.restantes > 0 ? `${sessoesInfo.pacote.restantes} sem data` : null,
              conteudo: (
                <>
        {/* Sessões do paciente e saldo do pacote */}
        <Panel
          title="Sessões e pacote"
          subtitle="Histórico das sessões, presença e o que ainda falta agendar"
          className="mt-4"
          delay={90}
        >
          <SessoesPaciente telefone={lead.telefone} nome={lead.nome} sessoes={sessoesInfo.sessoes} pacote={sessoesInfo.pacote} temPlanoAtivo={prescricoes.some((p) => p.ativa)} />
        </Panel>


                  <div className="mt-4">
            <Panel
              title="Anotações do consultor"
              subtitle="Notas internas do time — o lead não vê"
              delay={140}
            >
              <NotasLead telefone={lead.telefone} initial={notas} sessoes={sessoesInfo.sessoes.map((x) => ({ id: x.id, data_hora: x.data_hora, status: x.status, local: x.local }))} />
            </Panel>
                  </div>
                </>
              ),
            },
            {
              id: "prontuario",
              label: "Prontuário",
              ancoras: ["prontuario"],
              conteudo: (
                <>
        <div id="prontuario" className="scroll-mt-24">
        {/* Prontuário: exames (com resumo do laudo) e evolução por sessão */}
        <Panel
          title="Prontuário e exames"
          subtitle="Linha do tempo clínica: exames com resumo do laudo e a evolução de cada sessão (dados sensíveis — só você vê)"
          className="mt-4"
          delay={95}
        >
          <Prontuario telefone={lead.telefone} exames={prontuario.exames} evolucoes={prontuario.evolucoes} />
        </Panel>
        </div>


        {/* Devolutiva do caso: documento com papel timbrado em link privado */}
        <Panel
          title="Devolutiva do caso"
          subtitle="Documento para o paciente: o que o exame descreve, o que você encontrou e o plano de cuidado (link privado, dá para salvar em PDF)"
          className="mt-4"
          delay={98}
        >
          <Devolutivas
            telefone={lead.telefone}
            primeiroNome={(lead.nome ?? "").trim().split(/\s+/)[0] || null}
            dataNascimento={nascimento}
            devolutivas={devolutivas}
            exames={prontuario.exames}
            evolucoes={prontuario.evolucoes}
            prescricoes={prescricoes}
          />
        </Panel>


                </>
              ),
            },
            {
              id: "exercicios",
              label: "Exercícios",
              ancoras: ["exercicios"],
              conteudo: (
                <>
        <div id="exercicios" className="scroll-mt-24">
        {/* Exercícios para casa: plano com vídeos, link privado e retorno do paciente */}
        <Panel
          title="Exercícios para casa"
          subtitle="Monte o plano com a sua biblioteca, envie o link pelo WhatsApp e acompanhe o retorno do paciente"
          className="mt-4"
          delay={97}
        >
          <Prescricoes
            telefone={lead.telefone}
            primeiroNome={(lead.nome ?? "").trim().split(/\s+/)[0] || null}
            prescricoes={prescricoes}
            biblioteca={biblioteca}
          />
        </Panel>
        </div>


                </>
              ),
            },
          ]}
          chat={
            <InboxChat
              telefone={lead.telefone}
              nome={lead.nome}
              funnelStage={lead.funnel_stage ?? ""}
              etapas={etapas.map((e) => ({ key: e.key, label: e.label, color: e.color }))}
              admin={sess?.papel === "admin"}
              embutido
            />
          }
        />

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
