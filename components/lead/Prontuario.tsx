"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GravarSessao } from "./GravarSessao";
import { AnexosWhatsApp } from "./AnexosWhatsApp";
import type { RascunhoEvolucao } from "@/lib/prontuario-ia";
import { LIMITE_ARQUIVO_MB, ROTULO_EXAME, type Evolucao, type Exame, type TipoExame } from "@/lib/prontuario-tipos";

const dataBR = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const hojeSP = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

type Item =
  | { tipo: "exame"; data: string; ord: number; exame: Exame }
  | { tipo: "evolucao"; data: string; ord: number; evolucao: Evolucao };

const campo = "w-full rounded-lg border border-line bg-base/70 px-2.5 py-2 text-[13px] text-ink outline-none focus:border-brand/60";
const rotulo = "text-[11px] uppercase tracking-wider text-ink-faint";
const botao = "inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";
const botaoPrim = "inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50";

/**
 * Prontuário do paciente: linha do tempo com os exames (link, arquivo e resumo do laudo) e a evolução de cada sessão.
 * A IA só rascunha o resumo do laudo; quem revisa e assina é o fisioterapeuta.
 */
export function Prontuario({ telefone, exames, evolucoes }: { telefone: string; exames: Exame[]; evolucoes: Evolucao[] }) {
  const router = useRouter();
  const base = `/api/paciente/${encodeURIComponent(telefone)}`;
  const [aba, setAba] = useState<null | "exame" | "evolucao">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // exame
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoExame>("ressonancia");
  const [dataExame, setDataExame] = useState("");
  const [link, setLink] = useState("");
  const [laudo, setLaudo] = useState("");
  const [resumo, setResumo] = useState("");
  const [resumoIA, setResumoIA] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [resumindo, setResumindo] = useState(false);

  // evolução
  const [dataSessao, setDataSessao] = useState(hojeSP());
  const [queixa, setQueixa] = useState("");
  const [achados, setAchados] = useState("");
  const [conduta, setConduta] = useState("");
  const [plano, setPlano] = useState("");
  const [dorIni, setDorIni] = useState("");
  const [dorFim, setDorFim] = useState("");
  const [doRascunho, setDoRascunho] = useState(false); // campos preenchidos pela gravação (IA): precisam de revisão
  const [transcricao, setTranscricao] = useState("");
  const [resumindoId, setResumindoId] = useState<string | null>(null);

  const itens = useMemo<Item[]>(() => {
    const a: Item[] = exames.map((e) => ({ tipo: "exame", data: (e.data_exame ?? e.criado_em).slice(0, 10), ord: new Date(e.criado_em).getTime(), exame: e }));
    const b: Item[] = evolucoes.map((e) => ({ tipo: "evolucao", data: e.data_sessao, ord: new Date(e.criado_em).getTime(), evolucao: e }));
    return [...a, ...b].sort((x, y) => (x.data === y.data ? y.ord - x.ord : x.data < y.data ? 1 : -1));
  }, [exames, evolucoes]);

  function fechar() {
    setAba(null);
    setErro(null);
  }

  // A gravação da sessão devolve um RASCUNHO: abre o formulário da evolução já preenchido para o Anderson revisar.
  function receberRascunho(r: RascunhoEvolucao | null, texto: string) {
    setTranscricao(texto);
    setDoRascunho(true);
    setDataSessao(hojeSP());
    setQueixa(r?.queixa ?? "");
    setAchados(r?.achados ?? "");
    setConduta(r?.conduta ?? "");
    setPlano(r?.plano ?? "");
    setDorIni(r?.dor_inicio != null ? String(r.dor_inicio) : "");
    setDorFim(r?.dor_fim != null ? String(r.dor_fim) : "");
    if (!r) setErro("A transcrição saiu, mas não consegui montar o rascunho. O texto está abaixo para você copiar.");
    setAba("evolucao");
  }

  async function resumirArquivo(ex: Exame) {
    setErro(null);
    setResumindoId(ex.id);
    try {
      const r = await fetch(`${base}/resumir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ex.id }) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui resumir o arquivo.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setResumindoId(null);
    }
  }

  async function resumirComIA() {
    setErro(null);
    setResumindo(true);
    try {
      const r = await fetch(`${base}/resumir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: laudo }) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; resumo?: string; error?: string };
      if (!r.ok || !d.resumo) {
        setErro(d.error ?? "Não consegui resumir.");
        return;
      }
      setResumo(d.resumo);
      setResumoIA(true);
    } catch {
      setErro("Falha de rede.");
    } finally {
      setResumindo(false);
    }
  }

  async function salvarExame(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (arquivo && arquivo.size > LIMITE_ARQUIVO_MB * 1024 * 1024) {
      setErro(`O arquivo passa de ${LIMITE_ARQUIVO_MB} MB.`);
      return;
    }
    setSalvando(true);
    try {
      const f = new FormData();
      f.set("titulo", titulo);
      f.set("tipo", tipo);
      f.set("data_exame", dataExame);
      f.set("link_url", link);
      f.set("laudo_texto", laudo);
      f.set("resumo", resumo);
      f.set("resumo_por_ia", resumoIA ? "1" : "0");
      if (arquivo) f.set("arquivo", arquivo);
      const r = await fetch(`${base}/exame`, { method: "POST", body: f });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui salvar o exame.");
        return;
      }
      setTitulo("");
      setDataExame("");
      setLink("");
      setLaudo("");
      setResumo("");
      setResumoIA(false);
      setArquivo(null);
      fechar();
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEvolucao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch(`${base}/evolucao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_sessao: dataSessao, queixa, achados, conduta, plano, dor_inicio: dorIni, dor_fim: dorFim, gravacao_autorizada: doRascunho, rascunho_ia: doRascunho }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui salvar a evolução.");
        return;
      }
      setQueixa("");
      setAchados("");
      setConduta("");
      setPlano("");
      setDorIni("");
      setDorFim("");
      setDoRascunho(false);
      setTranscricao("");
      fechar();
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(tipoItem: "exame" | "evolucao", id: string) {
    if (!window.confirm("Apagar este registro do prontuário? Não dá para desfazer.")) return;
    const r = await fetch(`${base}/${tipoItem}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else setErro("Não consegui apagar.");
  }

  async function editarResumo(ex: Exame) {
    const novo = window.prompt("Resumo do laudo (edite à vontade):", ex.resumo ?? "");
    if (novo === null) return;
    const r = await fetch(`${base}/exame`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ex.id, resumo: novo }) });
    if (r.ok) router.refresh();
    else setErro("Não consegui salvar o resumo.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={botaoPrim} onClick={() => setAba(aba === "evolucao" ? null : "evolucao")}>
          + Evolução da sessão
        </button>
        <button type="button" className={botao} onClick={() => setAba(aba === "exame" ? null : "exame")}>
          + Exame
        </button>
        <GravarSessao telefone={telefone} onRascunho={receberRascunho} />
        <AnexosWhatsApp telefone={telefone} />
      </div>

      {aba === "exame" && (
        <form onSubmit={salvarExame} className="flex flex-col gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="sm:col-span-2">
              <span className={rotulo}>Nome do exame</span>
              <input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ressonância da coluna cervical" required />
            </label>
            <label>
              <span className={rotulo}>Tipo</span>
              <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoExame)}>
                {(Object.keys(ROTULO_EXAME) as TipoExame[]).map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_EXAME[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={rotulo}>Data do exame</span>
              <input type="date" className={campo} value={dataExame} onChange={(e) => setDataExame(e.target.value)} />
            </label>
            <label className="sm:col-span-2">
              <span className={rotulo}>Link do exame (se o paciente enviou um link)</span>
              <input className={campo} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
            </label>
          </div>
          <label>
            <span className={rotulo}>Arquivo (PDF ou imagem, até {LIMITE_ARQUIVO_MB} MB) — opcional</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-[12.5px] text-ink-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-ink"
            />
          </label>
          <label>
            <span className={rotulo}>Texto do laudo (cole aqui para gerar o resumo)</span>
            <textarea className={`${campo} min-h-[110px]`} value={laudo} onChange={(e) => setLaudo(e.target.value)} placeholder="Cole o texto do laudo do exame" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={botao} disabled={resumindo || laudo.trim().length < 30} onClick={() => void resumirComIA()}>
              {resumindo ? "Resumindo…" : "Resumir o laudo com IA (rascunho)"}
            </button>
            <span className="text-[11.5px] text-ink-faint">A IA só resume o que o laudo descreve. Revise antes de salvar.</span>
          </div>
          <label>
            <span className={rotulo}>Resumo do laudo (o que fica visível na linha do tempo)</span>
            <textarea
              className={`${campo} min-h-[96px]`}
              value={resumo}
              onChange={(e) => {
                setResumo(e.target.value);
                setResumoIA(false);
              }}
              placeholder="• Cervical C5-C6: …"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={botaoPrim} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar exame"}
            </button>
            <button type="button" className={botao} onClick={fechar}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {aba === "evolucao" && (
        <form onSubmit={salvarEvolucao} className="flex flex-col gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
          {doRascunho && (
            <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-[12.5px] text-ink">
              <b>Rascunho gerado pela IA a partir da gravação.</b> Leia, corrija o que for preciso e só então salve: o registro é seu.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label>
              <span className={rotulo}>Data da sessão</span>
              <input type="date" className={campo} value={dataSessao} onChange={(e) => setDataSessao(e.target.value)} required />
            </label>
            <label>
              <span className={rotulo}>Dor no início (0–10)</span>
              <input className={campo} inputMode="numeric" value={dorIni} onChange={(e) => setDorIni(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="0 a 10" />
            </label>
            <label>
              <span className={rotulo}>Dor no fim (0–10)</span>
              <input className={campo} inputMode="numeric" value={dorFim} onChange={(e) => setDorFim(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="0 a 10" />
            </label>
          </div>
          <label>
            <span className={rotulo}>Relato do paciente / queixa</span>
            <textarea className={`${campo} min-h-[70px]`} value={queixa} onChange={(e) => setQueixa(e.target.value)} />
          </label>
          <label>
            <span className={rotulo}>Achados da avaliação</span>
            <textarea className={`${campo} min-h-[70px]`} value={achados} onChange={(e) => setAchados(e.target.value)} />
          </label>
          <label>
            <span className={rotulo}>Conduta / manobras realizadas</span>
            <textarea className={`${campo} min-h-[70px]`} value={conduta} onChange={(e) => setConduta(e.target.value)} />
          </label>
          <label>
            <span className={rotulo}>Plano e orientações (inclui exercícios para casa)</span>
            <textarea className={`${campo} min-h-[70px]`} value={plano} onChange={(e) => setPlano(e.target.value)} />
          </label>
          {transcricao && (
            <details className="rounded-lg border border-line px-3 py-2 text-[12.5px] text-ink-muted">
              <summary className="cursor-pointer font-semibold text-ink">Texto da gravação (não fica salvo)</summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{transcricao}</p>
            </details>
          )}
          <div className="flex gap-2">
            <button type="submit" className={botaoPrim} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar evolução"}
            </button>
            <button
              type="button"
              className={botao}
              onClick={() => {
                setDoRascunho(false);
                setTranscricao("");
                fechar();
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {erro && <p className="text-[12.5px] text-amber">{erro}</p>}

      <ol className="flex flex-col gap-3">
        {itens.map((it) =>
          it.tipo === "exame" ? (
            <li key={`e${it.exame.id}`} className="rounded-xl border border-[#39B7C4]/30 bg-[#39B7C4]/[0.05] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#39B7C4]/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-[#39B7C4]">{ROTULO_EXAME[it.exame.tipo]}</span>
                <span className="text-[13.5px] font-semibold text-ink">{it.exame.titulo}</span>
                <span className="ml-auto text-[11.5px] text-ink-faint">{dataBR(it.data)}</span>
              </div>
              {it.exame.resumo ? (
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">
                  {it.exame.resumo}
                  {it.exame.resumo_por_ia && <span className="mt-1 block text-[11px] text-ink-faint">Rascunho gerado por IA — revise antes de usar.</span>}
                </p>
              ) : (
                <p className="mt-2 text-[12.5px] text-ink-faint">Sem resumo do laudo ainda.</p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {it.exame.tem_arquivo && (
                  <a href={`${base}/exame?id=${encodeURIComponent(it.exame.id)}`} target="_blank" rel="noopener noreferrer" className={botao}>
                    Abrir arquivo{it.exame.arquivo_nome ? ` (${it.exame.arquivo_nome.slice(0, 24)})` : ""}
                  </a>
                )}
                {it.exame.link_url && (
                  <a href={it.exame.link_url} target="_blank" rel="noopener noreferrer" className={botao}>
                    Abrir link do exame
                  </a>
                )}
                {it.exame.tem_arquivo && (
                  <button type="button" className={botao} disabled={resumindoId === it.exame.id} onClick={() => void resumirArquivo(it.exame)}>
                    {resumindoId === it.exame.id ? "Lendo o arquivo…" : "Resumir o arquivo com IA"}
                  </button>
                )}
                <button type="button" className={botao} onClick={() => void editarResumo(it.exame)}>
                  Editar resumo
                </button>
                <button type="button" className={`${botao} ml-auto`} onClick={() => void excluir("exame", it.exame.id)}>
                  Apagar
                </button>
              </div>
            </li>
          ) : (
            <li key={`v${it.evolucao.id}`} className="rounded-xl border border-brand/25 bg-brand/[0.04] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand">Evolução</span>
                <span className="text-[13.5px] font-semibold text-ink">Sessão de {dataBR(it.data)}</span>
                {(it.evolucao.dor_inicio != null || it.evolucao.dor_fim != null) && (
                  <span className="ml-auto rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11.5px] text-ink-muted">
                    Dor: {it.evolucao.dor_inicio ?? "—"} → {it.evolucao.dor_fim ?? "—"}
                  </span>
                )}
              </div>
              <dl className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-muted">
                {([["Relato", it.evolucao.queixa], ["Achados", it.evolucao.achados], ["Conduta", it.evolucao.conduta], ["Plano", it.evolucao.plano]] as const).map(
                  ([r, v]) =>
                    v ? (
                      <div key={r}>
                        <dt className="inline text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{r}: </dt>
                        <dd className="inline whitespace-pre-wrap">{v}</dd>
                      </div>
                    ) : null,
                )}
              </dl>
              <div className="mt-2 flex">
                <button type="button" className={`${botao} ml-auto`} onClick={() => void excluir("evolucao", it.evolucao.id)}>
                  Apagar
                </button>
              </div>
            </li>
          ),
        )}
        {!itens.length && <li className="text-[12.5px] text-ink-muted">Nenhum registro ainda. Adicione o exame do paciente ou a evolução da sessão.</li>}
      </ol>
    </div>
  );
}
