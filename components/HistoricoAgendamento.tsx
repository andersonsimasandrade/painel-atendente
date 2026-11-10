"use client";

import { useState } from "react";
import type { EntradaHistorico } from "@/lib/agenda";

const LOCAL: Record<string, string> = { capoeiras: "Capoeiras", centro: "Centro" };

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const registro = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const lugar = (l: string | null) => (l ? ` · ${LOCAL[l] ?? l}` : "");
const ORIGEM: Record<string, string> = { painel: "pelo painel", robo: "pelo robô", site: "pelo site", manual: "pelo painel" };

function texto(e: EntradaHistorico): { icone: string; titulo: string; detalhe?: string } {
  switch (e.tipo) {
    case "criado":
      return { icone: "📅", titulo: `Marcada para ${e.para_data_hora ? quando(e.para_data_hora) : "—"}${lugar(e.para_local)}`, detalhe: e.origem ? ORIGEM[e.origem] ?? e.origem : undefined };
    case "remarcado":
      return {
        icone: "🔁",
        titulo: `Remarcada de ${e.de_data_hora ? quando(e.de_data_hora) : "—"}${lugar(e.de_local)} para ${e.para_data_hora ? quando(e.para_data_hora) : "—"}${lugar(e.para_local)}`,
        detalhe: e.paciente_avisado === true ? "Paciente avisado pelo WhatsApp" : e.paciente_avisado === false ? "Paciente NÃO foi avisado pelo WhatsApp" : undefined,
      };
    case "cancelado":
      return { icone: "✖", titulo: `Cancelada${e.de_data_hora ? ` (era ${quando(e.de_data_hora)}${lugar(e.de_local)})` : ""}` };
    case "compareceu":
      return { icone: "✔", titulo: "Marcada como realizada (paciente compareceu)" };
    case "faltou":
      return { icone: "✖", titulo: "Marcada como falta (paciente não compareceu)" };
    case "desfeito":
      return { icone: "↩", titulo: "Presença desfeita: voltou a ficar como marcada" };
  }
}

/** O que aconteceu com esta consulta: marcada, remarcada (de/para), cancelada, realizada, faltou. Carrega ao abrir. */
export function HistoricoAgendamento({ id, rotulo = "Histórico" }: { id: string; rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<EntradaHistorico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    const abrir = !aberto;
    setAberto(abrir);
    if (!abrir || lista) return;
    setErro(null);
    try {
      const r = await fetch(`/api/agenda/${encodeURIComponent(id)}/historico`, { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { historico?: EntradaHistorico[]; error?: string };
      if (!r.ok || !d.historico) setErro(d.error ?? "Não consegui carregar o histórico.");
      else setLista(d.historico);
    } catch {
      setErro("Falha de rede.");
    }
  }

  return (
    <div className="w-full">
      <button type="button" onClick={() => void alternar()} className="text-[11.5px] text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline">
        {aberto ? "ocultar histórico" : rotulo}
      </button>
      {aberto && (
        <div className="mt-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
          {erro && <p className="text-[12px] text-amber">{erro}</p>}
          {!lista && !erro && <p className="text-[12px] text-ink-faint">Carregando…</p>}
          {lista && !lista.length && <p className="text-[12px] text-ink-faint">Sem registros ainda.</p>}
          {lista && lista.length > 0 && (
            <ol className="flex flex-col gap-1.5">
              {lista.map((e) => {
                const t = texto(e);
                return (
                  <li key={e.id} className="flex gap-2 text-[12.5px] text-ink-muted">
                    <span aria-hidden>{t.icone}</span>
                    <span>
                      <span className="text-ink-faint">{registro(e.criado_em)} · </span>
                      {t.titulo}
                      {t.detalhe && <span className={`block text-[11.5px] ${e.paciente_avisado === false ? "text-amber" : "text-ink-faint"}`}>{t.detalhe}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
