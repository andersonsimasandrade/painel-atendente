"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Exercicio } from "@/lib/exercicios-tipos";

const campo = "w-full rounded-lg border border-line bg-base/70 px-2.5 py-2 text-[13px] text-ink outline-none focus:border-brand/60";
const rotulo = "text-[11px] uppercase tracking-wider text-ink-faint";
const botao = "inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";
const botaoPrim = "inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50";

const VAZIO = { nome: "", regiao: "", instrucoes: "", video_url: "", series: "3", repeticoes: "10", frequencia: "1 vez ao dia", observacao: "" };

/** Biblioteca de exercícios do Anderson: nome, região, como fazer, vídeo e a dose padrão. */
export function ExerciciosBoard({ exercicios }: { exercicios: Exercicio[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [f, setF] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  function abrir(e?: Exercicio) {
    setErro(null);
    if (e) {
      setEditando(e.id);
      setF({
        nome: e.nome,
        regiao: e.regiao ?? "",
        instrucoes: e.instrucoes ?? "",
        video_url: e.video_url ?? "",
        series: e.series != null ? String(e.series) : "",
        repeticoes: e.repeticoes ?? "",
        frequencia: e.frequencia ?? "",
        observacao: e.observacao ?? "",
      });
    } else {
      setEditando("novo");
      setF(VAZIO);
    }
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const url = editando === "novo" ? "/api/exercicios" : `/api/exercicios/${editando}`;
      const r = await fetch(url, { method: editando === "novo" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui salvar.");
        return;
      }
      setEditando(null);
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function ativar(e: Exercicio) {
    const r = await fetch(`/api/exercicios/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...e, series: e.series, ativo: !e.ativo }),
    });
    if (r.ok) router.refresh();
    else setErro("Não consegui alterar.");
  }

  async function apagar(e: Exercicio) {
    if (!window.confirm(`Apagar “${e.nome}” da biblioteca? Os planos já enviados não mudam.`)) return;
    const r = await fetch(`/api/exercicios/${e.id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else setErro("Não consegui apagar.");
  }

  const q = busca.trim().toLowerCase();
  const lista = exercicios.filter((e) => !q || `${e.nome} ${e.regiao ?? ""}`.toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={botaoPrim} onClick={() => abrir()}>
          + Novo exercício
        </button>
        <input className={`${campo} max-w-xs`} placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {editando && (
        <form onSubmit={salvar} className="flex flex-col gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="sm:col-span-2">
              <span className={rotulo}>Nome</span>
              <input className={campo} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required />
            </label>
            <label>
              <span className={rotulo}>Região</span>
              <input className={campo} value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })} placeholder="Cervical, Lombar, Ombro…" />
            </label>
          </div>
          <label>
            <span className={rotulo}>Como fazer</span>
            <textarea className={`${campo} min-h-[90px]`} value={f.instrucoes} onChange={(e) => setF({ ...f, instrucoes: e.target.value })} />
          </label>
          <label>
            <span className={rotulo}>Link do vídeo (YouTube toca na própria página; outros links viram botão)</span>
            <input className={campo} value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} placeholder="https://youtube.com/shorts/…" inputMode="url" />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label>
              <span className={rotulo}>Séries</span>
              <input className={campo} inputMode="numeric" value={f.series} onChange={(e) => setF({ ...f, series: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label>
              <span className={rotulo}>Repetições / tempo</span>
              <input className={campo} value={f.repeticoes} onChange={(e) => setF({ ...f, repeticoes: e.target.value })} />
            </label>
            <label className="col-span-2">
              <span className={rotulo}>Frequência</span>
              <input className={campo} value={f.frequencia} onChange={(e) => setF({ ...f, frequencia: e.target.value })} />
            </label>
          </div>
          <label>
            <span className={rotulo}>Observação (cuidado, o que evitar)</span>
            <input className={campo} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
          </label>
          {erro && <p className="text-[12.5px] text-amber">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" className={botaoPrim} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar exercício"}
            </button>
            <button type="button" className={botao} onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!editando && erro && <p className="text-[12.5px] text-amber">{erro}</p>}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {lista.map((e) => (
          <li key={e.id} className={`rounded-xl border px-4 py-3 ${e.ativo ? "border-line bg-white/[0.02]" : "border-line bg-white/[0.01] opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-ink">{e.nome}</span>
              {e.regiao && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-ink-muted">{e.regiao}</span>}
              {e.modelo && <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">modelo: revise</span>}
              {e.video_url && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">com vídeo</span>}
            </div>
            {e.instrucoes && <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-ink-muted">{e.instrucoes}</p>}
            <p className="mt-1 text-[11.5px] text-ink-faint">
              {[e.series ? `${e.series} série(s)` : null, e.repeticoes, e.frequencia].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={botao} onClick={() => abrir(e)}>
                Editar
              </button>
              <button type="button" className={botao} onClick={() => void ativar(e)}>
                {e.ativo ? "Desativar" : "Reativar"}
              </button>
              <button type="button" className={`${botao} ml-auto`} onClick={() => void apagar(e)}>
                Apagar
              </button>
            </div>
          </li>
        ))}
        {!lista.length && <li className="text-[13px] text-ink-muted">Nenhum exercício encontrado.</li>}
      </ul>
    </div>
  );
}
