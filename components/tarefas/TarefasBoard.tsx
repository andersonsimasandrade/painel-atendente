"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TIPOS, type CanalTarefa, type Tarefa, type TipoTarefa } from "@/lib/tarefas-tipos";

// Tarefas de relacionamento: o sistema sugere, você aprova, e o envio sai sozinho no horário (depois de conferir o contexto).

const spDia = (iso: string | Date) => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const hojeSP = () => spDia(new Date());
const horaSP = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const dataSP = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" });
/** valor de <input type="datetime-local"> (horário de SP) para ISO */
const localParaISO = (v: string) => new Date(`${v}:00-03:00`).toISOString();
const isoParaLocal = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 16);

const CANAIS: Record<CanalTarefa, string> = { whatsapp: "WhatsApp", instagram: "Instagram", ligacao: "Ligação", presencial: "Presencial" };

interface Resultado {
  rotulo: string;
  telefone: string | null;
  ig_id: string | null;
  nome: string | null;
}

export function TarefasBoard({ inicial }: { inicial: Tarefa[] }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>(inicial);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [ocupado, setOcupado] = useState<number | "todas" | null>(null);
  const [mostrarNova, setMostrarNova] = useState(false);
  const [mostrarFechadas, setMostrarFechadas] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch("/api/tarefas", { cache: "no-store" });
      const d = (await r.json()) as { ok?: boolean; tarefas?: Tarefa[] };
      if (d.ok && d.tarefas) setTarefas(d.tarefas);
    } catch {
      /* mantém */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => void recarregar(), 30000);
    return () => clearInterval(t);
  }, [recarregar]);

  async function agir(id: number, corpo: Record<string, unknown>, okMsg?: string): Promise<boolean> {
    setOcupado(id);
    setAviso(null);
    try {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setAviso({ tipo: "erro", msg: d.error ?? "Não consegui concluir." });
        return false;
      }
      if (okMsg) setAviso({ tipo: "ok", msg: okMsg });
      await recarregar();
      return true;
    } catch {
      setAviso({ tipo: "erro", msg: "Falha de rede." });
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function aprovarTodas() {
    setOcupado("todas");
    setAviso(null);
    try {
      const r = await fetch("/api/tarefas/aprovar-todas", { method: "POST" });
      const d = (await r.json()) as { ok?: boolean; aprovadas?: number; aRever?: number };
      setAviso({
        tipo: "ok",
        msg: `${d.aprovadas ?? 0} aprovada(s). ${d.aRever ? `${d.aRever} precisa(m) da sua revisão (aviso em amarelo).` : ""}`,
      });
      await recarregar();
    } catch {
      setAviso({ tipo: "erro", msg: "Falha de rede." });
    } finally {
      setOcupado(null);
    }
  }

  const hoje = hojeSP();
  const grupos = useMemo(() => {
    const abertas = tarefas.filter((t) => t.status === "sugerida" || t.status === "aprovada");
    return {
      atrasadas: abertas.filter((t) => spDia(t.devida_em) < hoje),
      hoje: abertas.filter((t) => spDia(t.devida_em) === hoje),
      proximas: abertas.filter((t) => spDia(t.devida_em) > hoje),
      fechadas: tarefas.filter((t) => t.status === "executada" || t.status === "descartada"),
    };
  }, [tarefas, hoje]);
  const pendentesHoje = [...grupos.atrasadas, ...grupos.hoje].filter((t) => t.status === "sugerida").length;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void aprovarTodas()}
          disabled={ocupado !== null || pendentesHoje === 0}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50"
        >
          {ocupado === "todas" ? "Conferindo…" : `Aprovar as ${pendentesHoje} de hoje que fazem sentido`}
        </button>
        <button
          type="button"
          onClick={() => setMostrarNova((v) => !v)}
          className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-[13px] font-semibold text-ink hover:bg-surface-2/50"
        >
          {mostrarNova ? "Fechar" : "+ Nova tarefa"}
        </button>
        <span className="text-[12px] text-ink-faint">
          Nada é enviado sem a sua aprovação. Ao aprovar, o envio sai sozinho no horário, depois de conferir de novo se ainda faz sentido.
        </span>
      </div>

      {aviso && <p className={`text-[13px] ${aviso.tipo === "erro" ? "text-amber" : "text-brand"}`}>{aviso.msg}</p>}

      {mostrarNova && (
        <NovaTarefa
          onCriada={async () => {
            setMostrarNova(false);
            setAviso({ tipo: "ok", msg: "Tarefa criada. Revise e aprove abaixo." });
            await recarregar();
          }}
        />
      )}

      <Grupo titulo="Atrasadas" tarefas={grupos.atrasadas} ocupado={ocupado} agir={agir} destaque />
      <Grupo titulo="Hoje" tarefas={grupos.hoje} ocupado={ocupado} agir={agir} vazio="Nenhuma tarefa para hoje." />
      <Grupo titulo="Próximos dias" tarefas={grupos.proximas} ocupado={ocupado} agir={agir} />

      {grupos.fechadas.length > 0 && (
        <section>
          <button type="button" onClick={() => setMostrarFechadas((v) => !v)} className="text-[12.5px] font-semibold text-ink-muted hover:text-ink">
            {mostrarFechadas ? "▾" : "▸"} Concluídas e descartadas nos últimos 7 dias ({grupos.fechadas.length})
          </button>
          {mostrarFechadas && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {grupos.fechadas.map((t) => (
                <li key={t.id} className="rounded-lg border border-line bg-surface-2/30 px-3 py-2 text-[12.5px] text-ink-muted">
                  {TIPOS[t.tipo].emoji} <strong className="text-ink">{t.nome ?? "Paciente"}</strong> — {TIPOS[t.tipo].label} ·{" "}
                  {t.status === "executada" ? "feita" : "descartada"} {t.resultado ? `(${t.resultado})` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Grupo({
  titulo,
  tarefas,
  ocupado,
  agir,
  vazio,
  destaque,
}: {
  titulo: string;
  tarefas: Tarefa[];
  ocupado: number | "todas" | null;
  agir: (id: number, corpo: Record<string, unknown>, okMsg?: string) => Promise<boolean>;
  vazio?: string;
  destaque?: boolean;
}) {
  if (!tarefas.length && !vazio) return null;
  return (
    <section>
      <h2 className={`mb-2 text-[13px] font-semibold uppercase tracking-wider ${destaque ? "text-amber" : "text-ink-faint"}`}>
        {titulo} ({tarefas.length})
      </h2>
      {tarefas.length === 0 ? (
        <p className="text-[13px] text-ink-faint">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tarefas.map((t) => (
            <Cartao key={t.id} t={t} ocupado={ocupado === t.id} agir={agir} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Cartao({ t, ocupado, agir }: { t: Tarefa; ocupado: boolean; agir: (id: number, corpo: Record<string, unknown>, okMsg?: string) => Promise<boolean> }) {
  const [msg, setMsg] = useState(t.mensagem ?? "");
  const [quando, setQuando] = useState(isoParaLocal(t.devida_em));
  const [dica, setDica] = useState(false);
  const meta = TIPOS[t.tipo];
  const automatica = t.canal === "whatsapp" || t.canal === "instagram";
  const aprovada = t.status === "aprovada";
  const ch = t.checagem;
  const editado = msg !== (t.mensagem ?? "") || quando !== isoParaLocal(t.devida_em);
  const edicao = { mensagem: msg, devida_em: localParaISO(quando) };

  return (
    <li className="card-surface rounded-2xl border border-line p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink">
            {meta.emoji} {t.titulo}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-faint">
            {t.telefone ? (
              <Link className="hover:underline" href={`/leads/${encodeURIComponent(t.telefone)}`}>
                {t.nome ?? t.telefone} · abrir cadastro
              </Link>
            ) : t.ig_id ? (
              <Link className="hover:underline" href={`/instagram?id=${t.ig_id}`}>
                {t.nome ?? "Instagram"} · abrir conversa
              </Link>
            ) : (
              t.nome
            )}
            {t.motivo ? ` · ${t.motivo}` : ""} · {CANAIS[t.canal]} · {t.origem === "manual" ? "criada por você" : t.origem === "conversa" ? "achada na conversa" : "plano automático"}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${aprovada ? "bg-brand/15 text-brand" : "bg-amber/20 text-amber"}`}>
          {aprovada ? `Aprovada · envia ${dataSP(t.devida_em)} ${horaSP(t.devida_em)}` : "Aguardando sua aprovação"}
        </span>
      </div>

      <div
        className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${
          !ch ? "bg-surface-2/40 text-ink-muted" : ch.faz_sentido ? "bg-brand/10 text-ink" : "bg-amber/15 text-ink"
        }`}
      >
        {!ch ? (
          <>Contexto ainda não conferido. </>
        ) : (
          <>
            <strong>{ch.faz_sentido ? "✓ Faz sentido" : "⚠ Rever antes"}:</strong> {ch.resumo}{" "}
          </>
        )}
        <button type="button" onClick={() => void agir(t.id, { acao: "checar" }, "Contexto conferido.")} disabled={ocupado} className="ml-1 underline disabled:opacity-50">
          conferir agora
        </button>
      </div>

      {automatica ? (
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
          maxLength={2000}
          aria-label="Mensagem que será enviada"
          className="mt-3 w-full resize-y rounded-lg border border-line bg-base/70 px-3 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-brand/60"
        />
      ) : (
        <p className="mt-3 text-[12.5px] text-ink-muted">Tarefa para você fazer ({CANAIS[t.canal].toLowerCase()}). Ela aparece na sua agenda do Google no horário.</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
        <label className="flex items-center gap-1.5">
          Quando:
          <input
            type="datetime-local"
            value={quando}
            onChange={(e) => setQuando(e.target.value)}
            className="h-8 rounded-lg border border-line bg-base/70 px-2 text-[12.5px] text-ink outline-none focus:border-brand/60"
          />
        </label>
        <button type="button" onClick={() => setDica((v) => !v)} className="underline">
          {dica ? "esconder" : "como abordar"}
        </button>
      </div>
      {dica && <p className="mt-2 rounded-lg bg-surface-2/40 px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">{meta.dica}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!aprovada && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void agir(t.id, { acao: "aprovar", ...edicao }, automatica ? "Aprovada. Envio automático no horário." : "Aprovada. Está na sua agenda.")}
            className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-[#04140d] hover:bg-brand-bright disabled:opacity-50"
          >
            Aprovar{automatica ? ` (envia ${horaSP(localParaISO(quando))})` : ""}
          </button>
        )}
        {aprovada && editado && (
          <button type="button" disabled={ocupado} onClick={() => void agir(t.id, { acao: "editar", ...edicao }, "Alterações salvas.")} className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:bg-surface-2/50 disabled:opacity-50">
            Salvar alterações
          </button>
        )}
        {automatica && (
          <button
            type="button"
            disabled={ocupado}
            onClick={async () => {
              if (!window.confirm("Enviar esta mensagem agora?")) return;
              await agir(t.id, { acao: "enviar_agora", ...edicao }, "Enviada.");
            }}
            className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:bg-surface-2/50 disabled:opacity-50"
          >
            Enviar agora
          </button>
        )}
        <button type="button" disabled={ocupado} onClick={() => void agir(t.id, { acao: "feito" }, "Marcada como feita.")} className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:bg-surface-2/50 disabled:opacity-50">
          Já fiz
        </button>
        {[1, 3, 7].map((d) => (
          <button key={d} type="button" disabled={ocupado} onClick={() => void agir(t.id, { acao: "adiar", dias: d }, `Adiada ${d} dia(s).`)} className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-[12.5px] text-ink-muted hover:bg-surface-2/50 disabled:opacity-50">
            +{d}d
          </button>
        ))}
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            if (window.confirm("Descartar esta tarefa?")) await agir(t.id, { acao: "descartar" }, "Descartada.");
          }}
          className="ml-auto inline-flex h-8 items-center rounded-lg px-2.5 text-[12.5px] text-amber hover:bg-amber/10 disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
      {t.resultado && <p className="mt-2 text-[12px] text-ink-faint">{t.resultado}</p>}
    </li>
  );
}

function NovaTarefa({ onCriada }: { onCriada: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [achados, setAchados] = useState<Resultado[]>([]);
  const [escolhido, setEscolhido] = useState<Resultado | null>(null);
  const [tipo, setTipo] = useState<TipoTarefa>("retorno_prometido");
  const [canal, setCanal] = useState<CanalTarefa>("whatsapp");
  const [quando, setQuando] = useState(() => isoParaLocal(new Date(Date.now() + 86400000).toISOString()).slice(0, 11) + "09:30");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (escolhido || q.trim().length < 2) {
      setAchados([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tarefas/buscar?q=${encodeURIComponent(q)}`);
        const d = (await r.json()) as { ok?: boolean; resultados?: Resultado[] };
        setAchados(d.resultados ?? []);
      } catch {
        setAchados([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, escolhido]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!escolhido) return setErro("Escolha o paciente na lista.");
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: escolhido.telefone,
          ig_id: escolhido.ig_id,
          nome: escolhido.nome,
          tipo,
          canal,
          motivo,
          mensagem: msg.trim() || undefined,
          devida_em: localParaISO(quando),
        }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) return setErro(d.error ?? "Não consegui criar.");
      await onCriada();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={criar} className="card-surface flex flex-col gap-3 rounded-2xl border border-line p-4 shadow-card">
      <div className="text-[13px] font-semibold text-ink">Nova tarefa</div>
      <div className="relative">
        <input
          value={escolhido ? escolhido.rotulo : q}
          onChange={(e) => {
            setEscolhido(null);
            setQ(e.target.value);
          }}
          placeholder="Paciente: digite o nome ou o número do WhatsApp"
          aria-label="Paciente"
          className="h-9 w-full rounded-lg border border-line bg-base/70 px-3 text-[13px] text-ink outline-none focus:border-brand/60"
        />
        {achados.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-base shadow-card">
            {achados.map((a, i) => (
              <li key={i}>
                <button type="button" onClick={() => { setEscolhido(a); setAchados([]); }} className="w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-2/60">
                  {a.rotulo}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTarefa)} aria-label="Tipo" className="h-9 rounded-lg border border-line bg-base/70 px-2 text-[13px] text-ink">
          {(Object.keys(TIPOS) as TipoTarefa[]).map((k) => (
            <option key={k} value={k}>
              {TIPOS[k].emoji} {TIPOS[k].label}
            </option>
          ))}
        </select>
        <select value={canal} onChange={(e) => setCanal(e.target.value as CanalTarefa)} aria-label="Canal" className="h-9 rounded-lg border border-line bg-base/70 px-2 text-[13px] text-ink">
          {(Object.keys(CANAIS) as CanalTarefa[]).map((k) => (
            <option key={k} value={k}>
              {CANAIS[k]}
            </option>
          ))}
        </select>
        <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} aria-label="Quando" className="h-9 rounded-lg border border-line bg-base/70 px-2 text-[13px] text-ink" />
      </div>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={160} placeholder="Motivo (ex.: ficou de ver o valor com o marido)" aria-label="Motivo" className="h-9 rounded-lg border border-line bg-base/70 px-3 text-[13px] text-ink outline-none focus:border-brand/60" />
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} maxLength={2000} placeholder="Mensagem (deixe em branco para usar o texto padrão do tipo)" aria-label="Mensagem" className="resize-y rounded-lg border border-line bg-base/70 px-3 py-2 text-[13px] text-ink outline-none focus:border-brand/60" />
      {erro && <p className="text-[12.5px] text-amber">{erro}</p>}
      <div>
        <button type="submit" disabled={salvando} className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] hover:bg-brand-bright disabled:opacity-50">
          {salvando ? "Criando…" : "Criar tarefa"}
        </button>
      </div>
    </form>
  );
}
