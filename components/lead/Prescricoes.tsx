"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SITE_URL } from "@/lib/site";
import { useRascunho } from "@/lib/use-rascunho";
import { CampoDitado } from "./CampoDitado";
import { MENSAGEM_PRESCRICAO, type Exercicio, type ItemPrescricao, type Prescricao } from "@/lib/exercicios-tipos";

const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const linkDo = (codigo: string) => `${SITE_URL}/exercicios/${codigo}`;

const campo = "w-full rounded-lg border border-line bg-base/70 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand/60";
const rotulo = "text-[11px] uppercase tracking-wider text-ink-faint";
const botao = "inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";
const botaoPrim = "inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50";

function doExercicio(e: Exercicio): ItemPrescricao {
  return {
    exercicio_id: e.id,
    nome: e.nome,
    instrucoes: e.instrucoes,
    video_url: e.video_url,
    series: e.series,
    repeticoes: e.repeticoes,
    frequencia: e.frequencia,
    observacao: e.observacao,
  };
}

/**
 * Exercícios para casa: o Anderson monta o plano com a biblioteca dele, gera um link privado e envia pelo WhatsApp.
 * O paciente abre a página (com os vídeos) e conta como foi; o retorno aparece aqui.
 */
export function Prescricoes({
  telefone,
  primeiroNome,
  prescricoes,
  biblioteca,
}: {
  telefone: string;
  primeiroNome: string | null;
  prescricoes: Prescricao[];
  biblioteca: Exercicio[];
}) {
  const router = useRouter();
  const base = `/api/paciente/${encodeURIComponent(telefone)}/prescricao`;
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ItemPrescricao[]>([]);
  const [titulo, setTitulo] = useState("Plano de exercícios");
  const [orientacoes, setOrientacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useRascunho(
    `rasc:prescricao:${telefone}`,
    aberto,
    { busca, itens, titulo, orientacoes },
    (r) => {
      setBusca(r.busca);
      setItens(r.itens);
      setTitulo(r.titulo);
      setOrientacoes(r.orientacoes);
      setAberto(true);
    },
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return biblioteca.filter((e) => !q || `${e.nome} ${e.regiao ?? ""}`.toLowerCase().includes(q));
  }, [biblioteca, busca]);

  const ids = new Set(itens.map((i) => i.exercicio_id).filter(Boolean));

  function alternar(e: Exercicio) {
    setItens((l) => (ids.has(e.id) ? l.filter((i) => i.exercicio_id !== e.id) : [...l, doExercicio(e)]));
  }
  function mudar(i: number, parte: Partial<ItemPrescricao>) {
    setItens((l) => l.map((x, k) => (k === i ? { ...x, ...parte } : x)));
  }
  function mover(i: number, d: -1 | 1) {
    setItens((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo, orientacoes, itens }) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui criar o plano.");
        return;
      }
      setItens([]);
      setOrientacoes("");
      setTitulo("Plano de exercícios");
      setAberto(false);
      setAviso("Plano criado. Use “Enviar no WhatsApp” abaixo para mandar o link ao paciente.");
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarWhats(p: Prescricao) {
    setErro(null);
    setAviso(null);
    if (!window.confirm("Enviar o link do plano por WhatsApp para este paciente agora?")) return;
    try {
      const r = await fetch(`/api/conversa/${encodeURIComponent(telefone)}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: MENSAGEM_PRESCRICAO(primeiroNome, linkDo(p.codigo)) }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui enviar pelo WhatsApp.");
        return;
      }
      await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, enviada: true }) });
      setAviso("Link enviado pelo WhatsApp.");
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    }
  }

  async function copiar(p: Prescricao) {
    try {
      await navigator.clipboard.writeText(linkDo(p.codigo));
      setAviso("Link copiado.");
    } catch {
      setAviso(linkDo(p.codigo));
    }
  }

  async function ativar(p: Prescricao, ativa: boolean) {
    const r = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, ativa }) });
    if (r.ok) router.refresh();
    else setErro("Não consegui alterar o plano.");
  }

  async function apagar(p: Prescricao) {
    if (!window.confirm("Apagar este plano e o retorno do paciente? Não dá para desfazer.")) return;
    const r = await fetch(`${base}?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else setErro("Não consegui apagar.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={botaoPrim} onClick={() => setAberto((v) => !v)}>
          {aberto ? "Fechar" : "+ Prescrever exercícios"}
        </button>
        <Link href="/exercicios" className={botao}>
          Biblioteca de exercícios
        </Link>
      </div>

      {aberto && (
        <form onSubmit={criar} className="flex flex-col gap-4 rounded-xl border border-line bg-white/[0.02] p-4">
          <div>
            <span className={rotulo}>1. Escolha os exercícios</span>
            <input className={`${campo} mt-1`} placeholder="Buscar por nome ou região (ex.: cervical)" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <div className="mt-2 grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {filtrados.map((e) => (
                <label key={e.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-[12.5px] ${ids.has(e.id) ? "border-brand/50 bg-brand/10" : "border-line"}`}>
                  <input type="checkbox" checked={ids.has(e.id)} onChange={() => alternar(e)} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{e.nome}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {e.regiao ?? "Sem região"}
                      {e.video_url ? " · com vídeo" : ""}
                      {e.modelo ? " · modelo" : ""}
                    </span>
                  </span>
                </label>
              ))}
              {!filtrados.length && <p className="text-[12.5px] text-ink-muted">Nenhum exercício na biblioteca com esse nome.</p>}
            </div>
            <button type="button" className={`${botao} mt-2`} onClick={() => setItens((l) => [...l, { exercicio_id: null, nome: "", instrucoes: null, video_url: null, series: 3, repeticoes: "10", frequencia: "1 vez ao dia", observacao: null }])}>
              + Exercício avulso (fora da biblioteca)
            </button>
          </div>

          {itens.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className={rotulo}>2. Ajuste séries, repetições e observações</span>
              {itens.map((it, i) => (
                <div key={i} className="rounded-lg border border-line p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-brand">{i + 1}</span>
                    {it.exercicio_id ? (
                      <span className="flex-1 text-[13px] font-semibold text-ink">{it.nome}</span>
                    ) : (
                      <input className={`${campo} flex-1`} placeholder="Nome do exercício" value={it.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
                    )}
                    <button type="button" className={botao} onClick={() => mover(i, -1)} aria-label="Subir">
                      ↑
                    </button>
                    <button type="button" className={botao} onClick={() => mover(i, 1)} aria-label="Descer">
                      ↓
                    </button>
                    <button type="button" className={botao} onClick={() => setItens((l) => l.filter((_, k) => k !== i))} aria-label="Remover">
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label>
                      <span className={rotulo}>Séries</span>
                      <input className={campo} inputMode="numeric" value={it.series ?? ""} onChange={(e) => mudar(i, { series: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null })} />
                    </label>
                    <label>
                      <span className={rotulo}>Repetições / tempo</span>
                      <input className={campo} value={it.repeticoes ?? ""} onChange={(e) => mudar(i, { repeticoes: e.target.value })} />
                    </label>
                    <label className="col-span-2">
                      <span className={rotulo}>Frequência</span>
                      <input className={campo} value={it.frequencia ?? ""} onChange={(e) => mudar(i, { frequencia: e.target.value })} />
                    </label>
                  </div>
                  {!it.exercicio_id && (
                    <>
                      <label className="mt-2 block">
                        <span className={rotulo}>Como fazer</span>
                        <textarea className={`${campo} min-h-[60px]`} value={it.instrucoes ?? ""} onChange={(e) => mudar(i, { instrucoes: e.target.value })} />
                      </label>
                      <label className="mt-2 block">
                        <span className={rotulo}>Link do vídeo (YouTube, etc.)</span>
                        <input className={campo} value={it.video_url ?? ""} onChange={(e) => mudar(i, { video_url: e.target.value })} placeholder="https://…" />
                      </label>
                    </>
                  )}
                  <label className="mt-2 block">
                    <span className={rotulo}>Observação para este paciente</span>
                    <input className={campo} value={it.observacao ?? ""} onChange={(e) => mudar(i, { observacao: e.target.value })} />
                  </label>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <label>
              <span className={rotulo}>Título do plano</span>
              <input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label>
              <span className={rotulo}>Orientações gerais (aparecem no topo da página do paciente)</span>
              <CampoDitado valor={orientacoes} onChange={setOrientacoes} minAltura={70} contexto="orientacoes" placeholder="Ex.: Faça pela manhã e à noite, com calma. Evite dormir de bruços." />
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" className={botaoPrim} disabled={salvando || !itens.length}>
              {salvando ? "Criando…" : "Criar plano e gerar link"}
            </button>
            <button type="button" className={botao} onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {erro && <p className="text-[12.5px] text-amber">{erro}</p>}
      {aviso && <p className="rounded-lg border border-brand/25 bg-brand/[0.06] px-3 py-2 text-[12.5px] text-ink">{aviso}</p>}

      <ul className="flex flex-col gap-3">
        {prescricoes.map((p) => (
          <li key={p.id} className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${p.ativa ? "bg-brand/15 text-brand" : "bg-white/[0.06] text-ink-muted"}`}>{p.ativa ? "Link ativo" : "Encerrado"}</span>
              <span className="text-[13.5px] font-semibold text-ink">{p.titulo}</span>
              <span className="text-[12px] text-ink-faint">
                {p.itens.length} exercício(s) · criado em {dataBR(p.criado_em)}
                {p.enviado_em ? ` · enviado em ${dataBR(p.enviado_em)}` : " · ainda não enviado"}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-ink-muted">{p.itens.map((i) => i.nome).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.ativa && (
                <>
                  <button type="button" className={botaoPrim} onClick={() => void enviarWhats(p)}>
                    Enviar no WhatsApp
                  </button>
                  <button type="button" className={botao} onClick={() => void copiar(p)}>
                    Copiar link
                  </button>
                  <a className={botao} href={linkDo(p.codigo)} target="_blank" rel="noopener noreferrer">
                    Ver como o paciente vê
                  </a>
                </>
              )}
              <button type="button" className={botao} onClick={() => void ativar(p, !p.ativa)}>
                {p.ativa ? "Encerrar link" : "Reabrir link"}
              </button>
              <button type="button" className={`${botao} ml-auto`} onClick={() => void apagar(p)}>
                Apagar
              </button>
            </div>
            {p.checkins.length > 0 && (
              <div className="mt-3 border-t border-line pt-2">
                <p className={rotulo}>Retorno do paciente</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {p.checkins.slice(0, 4).map((c) => (
                    <li key={c.id} className="text-[12.5px] text-ink-muted">
                      <b className="text-ink">{dataBR(c.criado_em)}</b>
                      {c.dias_feitos != null ? ` · fez ${c.dias_feitos} dia(s)` : ""}
                      {c.dor != null ? ` · dor ${c.dor}/10` : ""}
                      {c.comentario ? ` · “${c.comentario}”` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
        {!prescricoes.length && <li className="text-[12.5px] text-ink-muted">Nenhum plano de exercícios ainda.</li>}
      </ul>
    </div>
  );
}
