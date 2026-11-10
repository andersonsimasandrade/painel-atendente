"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPhone } from "@/lib/format";
import { Sigilo } from "@/components/Sigilo";
import type { NivelAlerta, PacienteTratamento } from "@/lib/pacientes-tratamento";

const dm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const dmHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const LOCAL: Record<string, string> = { capoeiras: "Capoeiras", centro: "Centro" };

const COR: Record<NivelAlerta, string> = { alto: "#E05C5C", medio: "#E0A23C", info: "#39B7C4" };

const botao = "inline-flex items-center rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";
const botaoPrim = "inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-[#04140d] transition hover:bg-brand-bright";

type Filtro = "todos" | "atencao" | "sem_proxima" | "sumidos" | "altas";

function Sparkline({ pontos }: { pontos: number[] }) {
  if (pontos.length < 2) return null;
  const w = 64;
  const h = 22;
  const x = (i: number) => 2 + (i * (w - 4)) / (pontos.length - 1);
  const y = (v: number) => 2 + ((10 - v) * (h - 4)) / 10;
  const d = pontos.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const desceu = pontos[pontos.length - 1] <= pontos[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke={desceu ? "#2FE58F" : "#E05C5C"} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BarraPacote({ p }: { p: PacienteTratamento["pacote"] }) {
  if (!p.comprado) return <span className="text-[12.5px] text-ink-faint">Sem pacote registrado ({p.realizadas} sessão(ões) feita(s))</span>;
  const cel = (n: number, cor: string) => Array.from({ length: n }, (_, i) => <span key={cor + i} className="h-2 flex-1 rounded-full" style={{ background: cor }} />);
  return (
    <div>
      <div className="flex gap-1">
        {cel(p.realizadas, "#2FE58F")}
        {cel(p.marcadas, "#39B7C4")}
        {cel(p.restantes, "rgba(255,255,255,0.14)")}
      </div>
      <p className="mt-1 text-[12px] text-ink-muted">
        {p.realizadas} de {p.comprado} feitas · {p.marcadas} marcada(s){p.restantes > 0 ? ` · ${p.restantes} sem data` : ""}
      </p>
    </div>
  );
}

/** Pacientes em tratamento: o que cada um tem de pacote, sessões, dor e exercícios, com os alertas do que precisa de atenção. */
export function PacientesBoard({ pacientes }: { pacientes: PacienteTratamento[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const ativos = pacientes.filter((p) => !p.encerrado);
  const comAlerta = ativos.filter((p) => p.alertas.some((a) => a.nivel !== "info"));
  const semProxima = ativos.filter((p) => p.alertas.some((a) => a.tipo === "sem_proxima" || a.tipo === "sumiu"));
  const sumidos = ativos.filter((p) => p.alertas.some((a) => a.tipo === "sumiu"));
  const semData = ativos.reduce((t, p) => t + p.pacote.restantes, 0);
  const dores = ativos.filter((p) => p.dor.primeira != null && p.dor.ultima != null && p.dor.pontos.length >= 2);
  const media = (f: (p: PacienteTratamento) => number) => (dores.length ? (dores.reduce((t, p) => t + f(p), 0) / dores.length).toFixed(1).replace(".", ",") : null);
  const altas = pacientes.filter((p) => p.encerrado);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base =
      filtro === "altas" ? altas : filtro === "atencao" ? comAlerta : filtro === "sem_proxima" ? semProxima : filtro === "sumidos" ? sumidos : ativos;
    return base.filter((p) => !q || `${p.nome ?? ""} ${p.telefone}`.toLowerCase().includes(q));
  }, [filtro, busca, pacientes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function alta(p: PacienteTratamento, dar: boolean) {
    if (dar && !window.confirm(`Dar alta a ${p.nome ?? "este paciente"}? Ele sai de “Em tratamento” (dá para reabrir).`)) return;
    setErro(null);
    const r = await fetch(`/api/paciente/${encodeURIComponent(p.telefone)}/alta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alta: dar }) });
    if (r.ok) router.refresh();
    else setErro("Não consegui alterar. Tente de novo.");
  }

  const chip = (id: Filtro, rotulo: string, n: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setFiltro(id)}
      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${filtro === id ? "border-brand/60 bg-brand/15 text-brand" : "border-line text-ink-muted hover:text-ink"}`}
    >
      {rotulo} <span className="opacity-70">{n}</span>
    </button>
  );

  const kpi = (valor: string | number, rotulo: string, destaque = false) => (
    <div className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
      <div className={`font-display text-[24px] font-semibold leading-none ${destaque ? "text-[#E0A23C]" : "text-ink"}`}>{valor}</div>
      <div className="mt-1.5 text-[12px] text-ink-muted">{rotulo}</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpi(ativos.length, "em tratamento")}
        {kpi(comAlerta.length, "precisam de atenção", comAlerta.length > 0)}
        {kpi(semProxima.length, "sem próxima sessão", semProxima.length > 0)}
        {kpi(semData, "sessões de pacote sem data")}
        {kpi(media((p) => p.dor.primeira ?? 0) && media((p) => p.dor.ultima ?? 0) ? `${media((p) => p.dor.primeira ?? 0)} → ${media((p) => p.dor.ultima ?? 0)}` : "—", "dor média (primeira → última nota)")}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chip("todos", "Todos", ativos.length)}
        {chip("atencao", "Precisam de atenção", comAlerta.length)}
        {chip("sem_proxima", "Sem próxima sessão", semProxima.length)}
        {chip("sumidos", "Sumidos", sumidos.length)}
        {chip("altas", "Altas", altas.length)}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar paciente"
          className="ml-auto w-full max-w-[220px] rounded-lg border border-line bg-base/70 px-3 py-1.5 text-[13px] text-ink outline-none focus:border-brand/60"
        />
      </div>
      {erro && <p className="text-[12.5px] text-amber">{erro}</p>}

      <ul className="flex flex-col gap-3">
        {lista.map((p) => (
          <li key={p.telefone} className={`rounded-2xl border bg-white/[0.02] p-4 ${p.alertas.some((a) => a.nivel === "alto") ? "border-[#E05C5C]/40" : "border-line"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link href={`/leads/${encodeURIComponent(p.telefone)}`} className="text-[15px] font-semibold text-ink hover:underline">
                <Sigilo>{p.nome?.trim() || "Paciente sem nome"}</Sigilo>
              </Link>
              <span className="font-mono text-[12px] text-ink-faint">
                <Sigilo>{formatPhone(p.telefone)}</Sigilo>
              </span>
              {p.encerrado && <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-muted">Alta</span>}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Pacote</p>
                <div className="mt-1.5">
                  <BarraPacote p={p.pacote} />
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Sessões</p>
                <p className="mt-1.5 text-[12.5px] text-ink-muted">
                  Última: {p.ultimaSessao ? `${dm(p.ultimaSessao.iso)}${p.diasDesdeUltima != null ? ` (há ${p.diasDesdeUltima} d)` : ""}${p.ultimaSessao.local ? ` · ${LOCAL[p.ultimaSessao.local] ?? ""}` : ""}` : "—"}
                </p>
                <p className="text-[12.5px] text-ink-muted">
                  Próxima: {p.proxima ? `${dmHora(p.proxima.iso)}${p.proxima.local ? ` · ${LOCAL[p.proxima.local] ?? ""}` : ""}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Dor (0–10)</p>
                {p.dor.pontos.length ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {p.dor.primeira}
                      {p.dor.pontos.length > 1 ? ` → ${p.dor.ultima}` : ""}
                    </span>
                    <Sparkline pontos={p.dor.pontos} />
                  </div>
                ) : (
                  <p className="mt-1.5 text-[12.5px] text-ink-faint">Sem nota registrada</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Exercícios</p>
                <p className="mt-1.5 text-[12.5px] text-ink-muted">
                  {p.exercicios.ativo ? "Plano ativo" : "Sem plano ativo"}
                  {p.exercicios.ultimoRetorno
                    ? ` · retorno ${dm(p.exercicios.ultimoRetorno.em)}${(() => {
                        const r = p.exercicios.ultimoRetorno;
                        const partes = [r.dias != null ? `${r.dias} dia(s)` : null, r.dor != null ? `dor ${r.dor}` : null].filter(Boolean).join(" · ");
                        return partes ? ` (${partes})` : "";
                      })()}`
                    : ""}
                </p>
              </div>
            </div>

            {p.alertas.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {p.alertas.map((a, i) => (
                  <li key={a.tipo + i} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ color: COR[a.nivel], background: `${COR[a.nivel]}1f` }}>
                    {a.texto}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/leads/${encodeURIComponent(p.telefone)}`} className={botao}>
                Abrir ficha
              </Link>
              {!p.encerrado && (
                <Link href={`/agenda?novo=1&telefone=${encodeURIComponent(p.telefone)}&nome=${encodeURIComponent(p.nome ?? "")}`} className={botaoPrim}>
                  + Agendar sessão
                </Link>
              )}
              <Link href={`/conversas?tel=${encodeURIComponent(p.telefone)}`} className={botao}>
                Conversa
              </Link>
              <button type="button" className={`${botao} ml-auto`} onClick={() => void alta(p, !p.encerrado)}>
                {p.encerrado ? "Reabrir tratamento" : "Dar alta"}
              </button>
            </div>
          </li>
        ))}
        {!lista.length && <li className="rounded-xl border border-line px-4 py-6 text-center text-[13px] text-ink-muted">Nenhum paciente neste filtro.</li>}
      </ul>
    </div>
  );
}
