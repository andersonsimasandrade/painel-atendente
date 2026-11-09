"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResumoPacote, SessaoPaciente } from "@/lib/sessoes-paciente";

const LOCAL: Record<string, string> = { capoeiras: "Capoeiras", centro: "Centro" };
const ROTULO: Record<string, string> = {
  agendado: "Marcada",
  confirmado: "Confirmada",
  compareceu: "Realizada",
  faltou: "Faltou",
  cancelado: "Cancelada",
};
const COR: Record<string, string> = {
  agendado: "#39B7C4",
  confirmado: "#39B7C4",
  compareceu: "#2FE58F",
  faltou: "#E0A23C",
  cancelado: "#8A9A94",
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Sessões do paciente: histórico, saldo do pacote e o botão de agendar a próxima sessão.
 * Sessões que já passaram e continuam "marcadas" pedem a confirmação de presença.
 */
export function SessoesPaciente({
  telefone,
  nome,
  sessoes,
  pacote,
}: {
  telefone: string;
  nome: string | null;
  sessoes: SessaoPaciente[];
  pacote: ResumoPacote;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const agora = Date.now();

  async function presenca(id: string, valor: "compareceu" | "faltou" | "agendado") {
    setOcupado(id);
    setErro(null);
    try {
      const r = await fetch("/api/agenda/presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, presenca: valor }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setErro(d.error ?? "Não consegui salvar.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setOcupado(null);
    }
  }

  const novo = `/agenda?novo=1&telefone=${encodeURIComponent(telefone)}&nome=${encodeURIComponent(nome ?? "")}`;
  const btn = "rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      {pacote.comprado > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-brand/25 bg-brand/[0.06] px-3.5 py-2.5 text-[12.5px] text-ink">
          <span>
            <b>Pacote:</b> {pacote.comprado} {pacote.comprado === 1 ? "sessão" : "sessões"}
          </span>
          <span className="text-ink-muted">{pacote.realizadas} realizada(s)</span>
          <span className="text-ink-muted">{pacote.marcadas} marcada(s)</span>
          <span className={pacote.restantes > 0 ? "font-semibold text-brand" : "text-ink-muted"}>
            {pacote.restantes > 0 ? `${pacote.restantes} ainda sem data` : "todas com data"}
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {sessoes.map((s) => {
          const passou = new Date(s.data_hora).getTime() < agora;
          const aConfirmar = passou && (s.status === "agendado" || s.status === "confirmado");
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5">
              <span
                className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                style={{ color: COR[s.status] ?? "#8A9A94", background: `${COR[s.status] ?? "#8A9A94"}1f` }}
              >
                {ROTULO[s.status] ?? s.status}
              </span>
              <span className="text-[12.5px] font-medium text-ink">{quando(s.data_hora)}</span>
              {s.local && <span className="text-[12px] text-ink-muted">· {LOCAL[s.local]}</span>}
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                {aConfirmar && <span className="text-[11.5px] text-amber">Já passou: o paciente compareceu?</span>}
                {(aConfirmar || s.status === "faltou") && (
                  <button type="button" disabled={ocupado === s.id} className={btn} onClick={() => void presenca(s.id, "compareceu")}>
                    Compareceu
                  </button>
                )}
                {aConfirmar && (
                  <button type="button" disabled={ocupado === s.id} className={btn} onClick={() => void presenca(s.id, "faltou")}>
                    Faltou
                  </button>
                )}
                {s.status === "compareceu" && (
                  <button type="button" disabled={ocupado === s.id} className={btn} onClick={() => void presenca(s.id, "agendado")}>
                    Desfazer
                  </button>
                )}
              </span>
            </li>
          );
        })}
        {!sessoes.length && <li className="text-[12.5px] text-ink-muted">Nenhuma sessão marcada ainda.</li>}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={novo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
        >
          + Agendar próxima sessão
        </Link>
        {pacote.restantes > 0 && (
          <span className="text-[12px] text-ink-muted">
            Ainda há {pacote.restantes} {pacote.restantes === 1 ? "sessão" : "sessões"} do pacote sem data.
          </span>
        )}
      </div>
      {erro && <p className="text-[12px] text-amber">{erro}</p>}
    </div>
  );
}
