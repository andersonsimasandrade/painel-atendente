"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Dia {
  dataIso: string;
  diaSemana: string;
  diaMes: string;
  slots: { iso: string; hora: string }[];
}

const CHAVE_LOCAL = "agenda-ultimo-local";

/**
 * Botão rápido DENTRO DA CONVERSA: "Marcou avaliação". Mostra os horários livres (pelas regras de atendimento),
 * você toca no horário, escolhe Capoeiras ou Centro e pronto: vai para a Agenda do painel e, em poucos minutos,
 * para o Google Agenda, com o consultório no evento. O robô não confirma nada: quem confirma é você.
 */
export function MarcarAvaliacaoRapido({ telefone, nome }: { telefone: string; nome: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [dias, setDias] = useState<Dia[] | null>(null);
  const [erroHorarios, setErroHorarios] = useState<string | null>(null);
  const [sel, setSel] = useState<{ data: string; hora: string } | null>(null);
  const [manual, setManual] = useState({ data: "", hora: "" });
  const [local, setLocal] = useState<"capoeiras" | "centro" | "">("");
  const [confirmar, setConfirmar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    try {
      const l = localStorage.getItem(CHAVE_LOCAL);
      if (l === "capoeiras" || l === "centro") setLocal(l);
    } catch {
      /* sem armazenamento: segue */
    }
  }, []);

  useEffect(() => {
    if (!aberto || dias) return;
    let vivo = true;
    fetch("/api/agenda/horarios?dias=21")
      .then((r) => r.json())
      .then((j: { ok: boolean; dias?: Dia[]; error?: string }) => {
        if (!vivo) return;
        if (j.ok && j.dias) setDias(j.dias);
        else setErroHorarios(j.error ?? "Não consegui carregar os horários.");
      })
      .catch(() => vivo && setErroHorarios("Não consegui carregar os horários."));
    return () => {
      vivo = false;
    };
  }, [aberto, dias]);

  const escolha = sel ?? (manual.data && manual.hora ? manual : null);
  const pronto = !!escolha && !!local;

  async function marcar() {
    if (!escolha || !local) return;
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/agenda/novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, nome: nome ?? "", data: escolha.data, hora: escolha.hora, local, confirmar }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string; quando?: string; confirmado?: boolean };
      if (!r.ok || !j.ok) {
        setMsg({ tipo: "erro", texto: j.error ?? "Não consegui marcar." });
        return;
      }
      try {
        localStorage.setItem(CHAVE_LOCAL, local);
      } catch {
        /* segue */
      }
      setMsg({ tipo: "ok", texto: `Avaliação marcada: ${j.quando}.${confirmar ? (j.confirmado ? " Confirmação enviada." : " (A confirmação por WhatsApp não saiu.)") : ""}` });
      setSel(null);
      setDias(null); // recarrega os horários livres na próxima abertura
      router.refresh();
      setTimeout(() => setAberto(false), 2200);
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de rede. Tente de novo." });
    } finally {
      setEnviando(false);
    }
  }

  const campo = "rounded-lg border border-line bg-base/70 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand/60";

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
        title="Marcar a avaliação desta pessoa na agenda"
      >
        📅 Marcou avaliação
      </button>
      {aberto && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface-2 p-3.5 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-ink">Marcar avaliação</p>
              <p className="text-[11.5px] text-ink-muted">Toque no horário livre. Vai para a Agenda e para o Google Agenda.</p>
            </div>
            <button type="button" onClick={() => setAberto(false)} className="text-[12px] text-ink-faint hover:text-ink" aria-label="Fechar">
              ✕
            </button>
          </div>

          <div className="mt-3 max-h-[220px] overflow-y-auto pr-1">
            {!dias && !erroHorarios && <p className="text-[12px] text-ink-muted">Carregando horários…</p>}
            {erroHorarios && <p className="text-[12px] text-red-300">{erroHorarios} Use o dia e a hora abaixo.</p>}
            {dias?.length === 0 && <p className="text-[12px] text-ink-muted">Sem horários livres nos próximos dias. Use o dia e a hora abaixo.</p>}
            {dias?.slice(0, 10).map((d) => (
              <div key={d.dataIso} className="mb-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  {d.diaSemana} {d.diaMes}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {d.slots.map((s) => {
                    const ativo = sel?.data === d.dataIso && sel.hora === s.hora;
                    return (
                      <button
                        key={s.iso}
                        type="button"
                        onClick={() => {
                          setSel({ data: d.dataIso, hora: s.hora });
                          setManual({ data: "", hora: "" });
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset transition ${
                          ativo ? "bg-brand text-[#04140d] ring-brand" : "bg-white/[0.03] text-ink ring-line hover:ring-brand/50"
                        }`}
                      >
                        {s.hora}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
              Outro dia
              <input
                type="date"
                value={manual.data}
                onChange={(e) => {
                  setManual({ ...manual, data: e.target.value });
                  setSel(null);
                }}
                className={campo}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
              Hora
              <input
                type="time"
                value={manual.hora}
                onChange={(e) => {
                  setManual({ ...manual, hora: e.target.value });
                  setSel(null);
                }}
                className={campo}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["capoeiras", "centro"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocal(l)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-inset transition ${
                  local === l ? "bg-brand text-[#04140d] ring-brand" : "bg-white/[0.03] text-ink ring-line hover:ring-brand/50"
                }`}
              >
                {l === "capoeiras" ? "Capoeiras" : "Centro"}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
              Confirmar por WhatsApp
            </label>
          </div>

          {msg && <p className={`mt-2 text-[12px] ${msg.tipo === "ok" ? "text-brand" : "text-red-300"}`}>{msg.texto}</p>}

          <button
            type="button"
            disabled={!pronto || enviando}
            onClick={() => void marcar()}
            className="mt-3 w-full rounded-xl bg-brand px-4 py-2 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "Marcando…" : pronto ? `Marcar ${escolha!.data.split("-").reverse().slice(0, 2).join("/")} às ${escolha!.hora}` : "Escolha horário e consultório"}
          </button>
        </div>
      )}
    </span>
  );
}
