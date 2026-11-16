"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prospecto } from "@/lib/prospeccao";

type Item = Prospecto & { proxima_mensagem: string | null };

const ROTULO: Record<string, string> = {
  fila: "Na fila",
  aguardando: "Aguardando resposta",
  respondeu: "Respondeu",
  parceiro: "Parceiro",
  recusou: "Recusou",
  encerrado: "Encerrado (sem resposta)",
  sem_telefone: "Sem WhatsApp cadastrado",
  sem_whatsapp: "Número sem WhatsApp",
  so_presencial: "Só presencial",
  silenciado: "Silenciado (robô não atende)",
};

const COR: Record<string, string> = {
  respondeu: "text-amber",
  parceiro: "text-brand",
  recusou: "text-ink-faint",
  fila: "text-ink-muted",
  aguardando: "text-ink",
};

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function Linha({ p }: { p: Item }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [tel, setTel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(corpo: Record<string, unknown>) {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/prospeccao/${p.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (d.ok) router.refresh();
      else setMsg(d.error ?? "Não consegui salvar.");
    } catch {
      setMsg("Falha de rede.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="card-surface rounded-xl border border-line px-4 py-3 text-[13px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">
          {p.lugar} <span className="font-normal text-ink-faint">· {p.regiao === "centro" ? "Centro" : "Capoeiras"} · {p.categoria}</span>
        </p>
        <span className={`text-[12px] font-semibold ${COR[p.status] ?? "text-ink-muted"}`}>
          {ROTULO[p.status] ?? p.status}
          {p.passo > 0 ? ` · ${p.passo}/4` : ""}
        </span>
      </div>
      <p className="mt-0.5 text-ink-muted">
        {p.endereco} · {p.telefone_original ?? "sem telefone"}
        {p.ultimo_envio_em && ` · última mensagem ${quando(p.ultimo_envio_em)}`}
        {p.proximo_em && p.status === "aguardando" && ` · próxima ${quando(p.proximo_em)}`}
      </p>
      {p.ultima_resposta && (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-ink">
          <span className="text-ink-faint">Respondeu {quando(p.respondeu_em)}:</span> «{p.ultima_resposta}»
        </p>
      )}
      {p.observacao && <p className="mt-1 text-amber">{p.observacao}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {p.proxima_mensagem && (
          <button type="button" onClick={() => setAberto(!aberto)} className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-muted hover:text-ink">
            {aberto ? "Esconder texto" : "Ver próxima mensagem"}
          </button>
        )}
        {(p.status === "respondeu" || p.status === "aguardando") && (
          <>
            <button type="button" disabled={ocupado} onClick={() => void salvar({ status: "parceiro" })} className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-brand hover:border-brand">
              Marcar como parceiro
            </button>
            <button type="button" disabled={ocupado} onClick={() => window.confirm("Marcar como recusou? Nenhuma mensagem será enviada.") && void salvar({ status: "recusou" })} className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-muted hover:text-ink">
              Recusou
            </button>
          </>
        )}
        {(p.status === "sem_telefone" || p.status === "sem_whatsapp" || p.status === "so_presencial") && (
          <span className="flex items-center gap-1">
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(48) 99999-9999" className="w-36 rounded-lg border border-line bg-transparent px-2 py-1 text-[12px]" />
            <button type="button" disabled={ocupado || !tel.trim()} onClick={() => void salvar({ telefone: tel })} className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-muted hover:text-ink">
              Colocar na fila
            </button>
          </span>
        )}
      </div>
      {aberto && p.proxima_mensagem && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-ink-muted">{p.proxima_mensagem}</p>}
      {msg && <p className="mt-1 text-amber">{msg}</p>}
    </li>
  );
}

export function ProspeccaoBoard({ itens, ativa, dentroDaJanela, intervaloMin, limiteDia }: { itens: Item[]; ativa: boolean; dentroDaJanela: boolean; intervaloMin: number; limiteDia: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState<string>("todos");

  async function alternar() {
    if (!ativa && !window.confirm(`Iniciar o envio? O sistema vai mandar 1 mensagem a cada ${intervaloMin} minutos (segunda a sexta, 9h às 18h), começando pelos de maior prioridade.`)) return;
    setOcupado(true);
    try {
      await fetch("/api/prospeccao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: ativa ? "pausar" : "ativar" }) });
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  const cont = (s: string) => itens.filter((i) => i.status === s).length;
  const visiveis = itens.filter((i) => filtro === "todos" || i.status === filtro);
  const ordem = ["respondeu", "aguardando", "fila", "parceiro", "encerrado", "recusou", "sem_telefone", "sem_whatsapp", "so_presencial", "silenciado"];
  visiveis.sort((a, b) => ordem.indexOf(a.status) - ordem.indexOf(b.status) || a.prioridade - b.prioridade || a.id - b.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="card-surface rounded-xl border border-line px-4 py-3 text-[13px]">
        <p className="font-semibold text-ink">Envio automático: {ativa ? "LIGADO" : "desligado"}</p>
        <p className="mt-1 text-ink-muted">
          1 mensagem a cada {intervaloMin} minutos, de segunda a sexta, das 9h às 18h (no máximo {limiteDia} por dia). Quem responder fica com o robô calado e você é avisado no WhatsApp. Quem disser "não" nunca mais recebe.
          {ativa && !dentroDaJanela && " Agora está fora do horário: o próximo envio sai no próximo dia útil, às 9h."}
        </p>
        <button type="button" disabled={ocupado} onClick={() => void alternar()} className={`mt-2 inline-flex items-center rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${ativa ? "border border-line text-ink-muted hover:text-ink" : "bg-brand text-white"}`}>
          {ativa ? "Pausar envio" : "Iniciar envio"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-[12px]">
        {[["todos", `Todos (${itens.length})`], ["respondeu", `Responderam (${cont("respondeu")})`], ["aguardando", `Aguardando (${cont("aguardando")})`], ["fila", `Na fila (${cont("fila")})`], ["parceiro", `Parceiros (${cont("parceiro")})`], ["sem_telefone", `Sem telefone (${cont("sem_telefone")})`]].map(([k, r]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)} className={`rounded-full border px-3 py-1 font-semibold ${filtro === k ? "border-brand text-brand" : "border-line text-ink-muted"}`}>
            {r}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {visiveis.map((p) => (
          <Linha key={p.id} p={p} />
        ))}
      </ul>
    </div>
  );
}
