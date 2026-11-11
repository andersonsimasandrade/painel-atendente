"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SITE_URL } from "@/lib/site";
import { useRascunho } from "@/lib/use-rascunho";
import { CampoDitado } from "./CampoDitado";
import type { Devolutiva } from "@/lib/devolutivas";
import type { Evolucao, Exame } from "@/lib/prontuario-tipos";
import type { Prescricao } from "@/lib/exercicios-tipos";

const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const linkDo = (codigo: string) => `${SITE_URL}/devolutiva/${codigo}`;

const campo = "w-full rounded-lg border border-line bg-base/70 px-2.5 py-2 text-[13px] text-ink outline-none focus:border-brand/60";
const rotulo = "text-[11px] uppercase tracking-wider text-ink-faint";
const botao = "inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";
const botaoPrim = "inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50";

const nascBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/**
 * Devolutiva do caso: o Anderson revisa o texto (já preenchido com o prontuário), escolhe os exames e gera um documento
 * com papel timbrado, em link privado, para enviar pelo WhatsApp ou salvar em PDF.
 */
export function Devolutivas({
  telefone,
  dataNascimento,
  devolutivas,
  exames,
  evolucoes,
  prescricoes,
}: {
  telefone: string;
  primeiroNome?: string | null;
  dataNascimento: string | null;
  devolutivas: Devolutiva[];
  exames: Exame[];
  evolucoes: Evolucao[];
  prescricoes: Prescricao[];
}) {
  const router = useRouter();
  const base = `/api/paciente/${encodeURIComponent(telefone)}/devolutiva`;
  const examesComResumo = exames.filter((e) => e.resumo);
  const recente = (campoEv: "queixa" | "achados" | "plano" | "conduta") => evolucoes.find((e) => e[campoEv])?.[campoEv] ?? "";
  const ativas = prescricoes.filter((p) => p.ativa);

  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("Devolutiva do seu caso");
  const [nascimento, setNascimento] = useState(nascBR(dataNascimento));
  const [relato, setRelato] = useState("");
  const [achados, setAchados] = useState("");
  const [plano, setPlano] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [mostrarDor, setMostrarDor] = useState(true);
  const [prescricaoId, setPrescricaoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // O formulário não pode se perder: pausa a atualização automática e guarda um rascunho na aba.
  useRascunho(
    `rasc:devolutiva:${telefone}`,
    aberto,
    { titulo, relato, achados, plano, observacoes, escolhidos: [...escolhidos], mostrarDor, prescricaoId },
    (r) => {
      setTitulo(r.titulo);
      setRelato(r.relato);
      setAchados(r.achados);
      setPlano(r.plano);
      setObservacoes(r.observacoes);
      setEscolhidos(new Set(r.escolhidos));
      setMostrarDor(r.mostrarDor);
      setPrescricaoId(r.prescricaoId);
      setAberto(true);
    },
  );

  function abrir() {
    setErro(null);
    setNascimento(nascBR(dataNascimento));
    setRelato(String(recente("queixa") ?? ""));
    setAchados(String(recente("achados") ?? ""));
    setPlano(String(recente("plano") || recente("conduta") || ""));
    setEscolhidos(new Set(examesComResumo.map((e) => e.id)));
    setMostrarDor(evolucoes.some((e) => e.dor_inicio != null || e.dor_fim != null));
    setPrescricaoId(ativas[0]?.id ?? "");
    setAberto(true);
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const lista = examesComResumo
        .filter((x) => escolhidos.has(x.id))
        .map((x) => ({ titulo: x.titulo, tipo: x.tipo, data: x.data_exame, resumo: x.resumo }));
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, data_nascimento: nascimento, relato, exames: lista, achados, plano, observacoes, mostrar_dor: mostrarDor, prescricao_id: prescricaoId || null }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui criar a devolutiva.");
        return;
      }
      setAberto(false);
      setAviso("Devolutiva criada. Abra “Ver como o paciente vê” para conferir e use “Enviar no WhatsApp”.");
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviar(d: Devolutiva, nascimentoManual?: string) {
    setErro(null);
    setAviso(null);
    if (!nascimentoManual && !window.confirm("Enviar agora pelo WhatsApp DUAS mensagens ao paciente?\n\n1) Dados da sessão e o link do documento\n2) Passo a passo para salvar em PDF ou imprimir")) return;
    try {
      const r = await fetch(`${base}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, nascimento: nascimentoManual }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; precisaNascimento?: boolean };
      if (j.precisaNascimento) {
        const n = window.prompt("Digite a data de nascimento do paciente (dd/mm/aaaa).\nEla é a senha para abrir o link.");
        if (n) await enviar(d, n);
        return;
      }
      if (!r.ok || !j.ok) {
        setErro(j.error ?? "Não consegui enviar pelo WhatsApp.");
        return;
      }
      setAviso("Duas mensagens enviadas pelo WhatsApp (dados da sessão com o link, e o passo a passo).");
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    }
  }

  async function copiar(d: Devolutiva) {
    try {
      await navigator.clipboard.writeText(linkDo(d.codigo));
      setAviso("Link copiado.");
    } catch {
      setAviso(linkDo(d.codigo));
    }
  }

  async function ativar(d: Devolutiva, ativa: boolean) {
    const r = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, ativa }) });
    if (r.ok) router.refresh();
    else setErro("Não consegui alterar.");
  }

  async function apagar(d: Devolutiva) {
    if (!window.confirm("Apagar esta devolutiva? Não dá para desfazer.")) return;
    const r = await fetch(`${base}?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else setErro("Não consegui apagar.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button type="button" className={botaoPrim} onClick={() => (aberto ? setAberto(false) : abrir())}>
          {aberto ? "Fechar" : "+ Criar devolutiva do caso"}
        </button>
      </div>

      {aberto && (
        <form onSubmit={criar} className="flex flex-col gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
          <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-[12.5px] text-ink">
            Os campos vêm preenchidos com o prontuário. <b>Revise o texto</b>: é um documento seu, em linguagem simples, sem promessa de resultado e sem diagnóstico fechado.
          </p>
          <label>
            <span className={rotulo}>Título</span>
            <input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label>
            <span className={rotulo}>Data de nascimento do paciente (é a senha para abrir o link)</span>
            <input className={campo} inputMode="numeric" placeholder="dd/mm/aaaa" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
          </label>
          <label>
            <span className={rotulo}>O que o paciente nos contou</span>
            <CampoDitado valor={relato} onChange={setRelato} minAltura={80} contexto="devolutiva_relato" />
          </label>

          <div>
            <span className={rotulo}>Exames incluídos (só os que têm resumo do laudo)</span>
            {examesComResumo.length ? (
              <ul className="mt-1 flex flex-col gap-1.5">
                {examesComResumo.map((x) => (
                  <li key={x.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-2.5 py-2 text-[12.5px]">
                      <input
                        type="checkbox"
                        checked={escolhidos.has(x.id)}
                        onChange={() =>
                          setEscolhidos((s) => {
                            const n = new Set(s);
                            if (n.has(x.id)) n.delete(x.id);
                            else n.add(x.id);
                            return n;
                          })
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <b className="text-ink">{x.titulo}</b>
                        <span className="block whitespace-pre-wrap text-ink-muted">{(x.resumo ?? "").slice(0, 220)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[12.5px] text-ink-muted">Nenhum exame com resumo do laudo ainda. Cole o texto do laudo em “+ Exame” e gere o resumo para ele entrar aqui.</p>
            )}
          </div>

          <label>
            <span className={rotulo}>O que encontramos na avaliação</span>
            <CampoDitado valor={achados} onChange={setAchados} minAltura={80} contexto="devolutiva_achados" />
          </label>
          <label>
            <span className={rotulo}>Plano de cuidado (próximos passos, frequência das sessões)</span>
            <CampoDitado valor={plano} onChange={setPlano} minAltura={80} contexto="devolutiva_plano" />
          </label>
          <label>
            <span className={rotulo}>Observações (opcional)</span>
            <CampoDitado valor={observacoes} onChange={setObservacoes} minAltura={60} contexto="devolutiva_observacoes" />
          </label>

          <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
            <input type="checkbox" checked={mostrarDor} onChange={(e) => setMostrarDor(e.target.checked)} />
            Mostrar o gráfico da evolução da dor (usa as notas de dor das evoluções)
          </label>
          {ativas.length > 0 && (
            <label>
              <span className={rotulo}>Plano de exercícios para ligar à devolutiva</span>
              <select className={campo} value={prescricaoId} onChange={(e) => setPrescricaoId(e.target.value)}>
                <option value="">Nenhum</option>
                {ativas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo} · {dataBR(p.criado_em)} · {p.itens.length} exercício(s)
                  </option>
                ))}
              </select>
            </label>
          )}

          {erro && <p className="text-[12.5px] text-amber">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" className={botaoPrim} disabled={salvando}>
              {salvando ? "Criando…" : "Criar devolutiva e gerar link"}
            </button>
            <button type="button" className={botao} onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!aberto && erro && <p className="text-[12.5px] text-amber">{erro}</p>}
      {aviso && <p className="rounded-lg border border-brand/25 bg-brand/[0.06] px-3 py-2 text-[12.5px] text-ink">{aviso}</p>}
      <p className="text-[12px] text-ink-faint">Proteção (LGPD): para abrir o link, o paciente precisa digitar a data de nascimento. Depois de 5 erros, o link trava por 15 minutos.</p>

      <ul className="flex flex-col gap-3">
        {devolutivas.map((d) => (
          <li key={d.id} className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${d.ativa ? "bg-brand/15 text-brand" : "bg-white/[0.06] text-ink-muted"}`}>{d.ativa ? "Link ativo" : "Encerrado"}</span>
              <span className="text-[13.5px] font-semibold text-ink">{d.titulo}</span>
              <span className="text-[12px] text-ink-faint">
                criada em {dataBR(d.criado_em)}
                {d.enviado_em ? ` · enviada em ${dataBR(d.enviado_em)}` : " · ainda não enviada"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {d.ativa && (
                <>
                  <button type="button" className={botaoPrim} onClick={() => void enviar(d)}>
                    Enviar no WhatsApp (2 mensagens)
                  </button>
                  <button type="button" className={botao} onClick={() => void copiar(d)}>
                    Copiar link
                  </button>
                  <a className={botao} href={linkDo(d.codigo)} target="_blank" rel="noopener noreferrer">
                    Ver como o paciente vê (e salvar em PDF)
                  </a>
                </>
              )}
              <button type="button" className={botao} onClick={() => void ativar(d, !d.ativa)}>
                {d.ativa ? "Encerrar link" : "Reabrir link"}
              </button>
              <button type="button" className={`${botao} ml-auto`} onClick={() => void apagar(d)}>
                Apagar
              </button>
            </div>
          </li>
        ))}
        {!devolutivas.length && <li className="text-[12.5px] text-ink-muted">Nenhuma devolutiva ainda.</li>}
      </ul>
    </div>
  );
}
