"use client";

import { useState } from "react";
import { PhoneField } from "./PhoneField";

// O Anderson marca a sessão aqui depois de combinar o horário com o paciente.
// Grava na agenda do painel, atualiza o funil e (opcional) confirma pelo WhatsApp.
// A agenda do Google é sincronizada por um script, em poucos minutos.
export function NovoAgendamento() {
  const [aberto, setAberto] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [local, setLocal] = useState<"capoeiras" | "centro" | "">("");
  const [confirmar, setConfirmar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const digitos = telefone.replace(/\D/g, "");
  const pronto = digitos.length >= 10 && !!data && !!hora && !!local;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/agenda/novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, nome, data, hora, local, confirmar }),
      });
      const d = (await res.json()) as { ok: boolean; error?: string; quando?: string; confirmado?: boolean };
      if (!res.ok || !d.ok) {
        setErro(d.error ?? "Não consegui marcar.");
        return;
      }
      setOk(
        `Sessão marcada: ${d.quando}.` +
          (confirmar ? (d.confirmado ? " Confirmação enviada ao paciente." : " (A confirmação por WhatsApp não saiu.)") : ""),
      );
      setTelefone("");
      setNome("");
      setData("");
      setHora("");
      setLocal("");
      setTimeout(() => window.location.reload(), 1800);
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "w-full rounded-xl border border-line bg-base/70 px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand/60";

  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Marcar sessão</h3>
          <p className="text-[12px] text-ink-muted">
            Depois de combinar dia e horário com o paciente. Vai para a agenda e para o Google Agenda.
          </p>
        </div>
        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
          >
            Nova sessão
          </button>
        )}
      </div>

      {aberto && (
        <form onSubmit={salvar} className="mt-3.5 grid gap-3 border-t border-line pt-3.5 sm:grid-cols-2">
          <label className="sm:col-span-1">
            <span className="mb-1 block text-[11.5px] font-medium text-ink-muted">WhatsApp do paciente (com DDD) *</span>
            <PhoneField value={telefone} onChange={setTelefone} variant="dark" autoFocus />
          </label>
          <label>
            <span className="mb-1 block text-[11.5px] font-medium text-ink-muted">Nome</span>
            <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do paciente" />
          </label>
          <label>
            <span className="mb-1 block text-[11.5px] font-medium text-ink-muted">Dia *</span>
            <input className={campo} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-[11.5px] font-medium text-ink-muted">Horário *</span>
            <input className={campo} type="time" step={900} value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-[11.5px] font-medium text-ink-muted">Consultório *</span>
            <select className={campo} value={local} onChange={(e) => setLocal(e.target.value as "capoeiras" | "centro" | "")}>
              <option value="">Escolha…</option>
              <option value="capoeiras">Capoeiras</option>
              <option value="centro">Centro</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2.5 text-[12.5px] text-ink-muted">
            <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
            Enviar confirmação por WhatsApp ao paciente
          </label>

          {erro && <p className="sm:col-span-2 text-[12.5px] text-red-300">{erro}</p>}
          {ok && <p className="sm:col-span-2 text-[12.5px] text-brand">{ok}</p>}

          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={!pronto || enviando}
              className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Marcando…" : "Marcar sessão"}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-[12.5px] text-ink-faint transition hover:text-ink-muted"
            >
              cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
