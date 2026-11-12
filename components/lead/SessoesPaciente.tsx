"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Remarcar } from "@/components/Remarcar";
import { HistoricoAgendamento } from "@/components/HistoricoAgendamento";
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
  temPlanoAtivo = false,
  cobrancaAtiva = false,
}: {
  telefone: string;
  nome: string | null;
  sessoes: SessaoPaciente[];
  pacote: ResumoPacote;
  temPlanoAtivo?: boolean;
  cobrancaAtiva?: boolean; // Asaas configurado: mostra o botão de cobrança
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [passos, setPassos] = useState(false); // mostra os "próximos passos" depois de registrar uma sessão realizada
  const agora = Date.now();

  async function recibo(id: string, corpo: { acao: "caixinha"; enviar: boolean } | { acao: "enviar" }) {
    if (corpo.acao === "enviar" && !window.confirm("Emitir e enviar agora o recibo desta sessão pelo WhatsApp?")) return;
    setOcupado(id);
    setErro(null);
    try {
      const r = await fetch(`/api/agenda/${encodeURIComponent(id)}/recibo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui agora.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setOcupado(null);
    }
  }

  async function cobrar(id: string) {
    if (!window.confirm("Enviar agora o link de pagamento da sessão (PIX ou cartão) pelo WhatsApp para o paciente?")) return;
    setOcupado(id);
    setErro(null);
    try {
      const r = await fetch(`/api/agenda/${encodeURIComponent(id)}/cobranca`, { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui gerar a cobrança.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setOcupado(null);
    }
  }

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
      if (valor === "compareceu") setPassos(true);
      else if (valor === "agendado") setPassos(false);
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setOcupado(null);
    }
  }

  const novo = `/agenda?novo=1&telefone=${encodeURIComponent(telefone)}&nome=${encodeURIComponent(nome ?? "")}`;
  const btn = "rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";

  const temProxima = sessoes.some((s) => (s.status === "agendado" || s.status === "confirmado") && new Date(s.data_hora).getTime() > agora);

  return (
    <div className="flex flex-col gap-3">
      {passos && (
        <div className="rounded-xl border border-brand/40 bg-brand/[0.08] px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13.5px] font-semibold text-ink">✔ Sessão registrada. Próximos passos:</p>
            <button type="button" onClick={() => setPassos(false)} className="text-[12px] text-ink-faint hover:text-ink-muted" aria-label="Fechar">
              ✕
            </button>
          </div>
          <ul className="mt-2 flex flex-col gap-2 text-[12.5px] text-ink-muted">
            <li className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">
                {temProxima ? "✓ Próxima sessão já marcada." : pacote.restantes > 0 ? `Marcar a próxima sessão (${pacote.restantes} do pacote ainda sem data).` : "Marcar a próxima sessão."}
              </span>
              {!temProxima && (
                <Link href={novo} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-[#04140d] hover:bg-brand-bright">
                  + Agendar próxima sessão
                </Link>
              )}
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">Registrar a evolução desta sessão (relato, achados, manobras, dor).</span>
              <a href="#prontuario" className={btn}>
                Ir para o prontuário
              </a>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">{temPlanoAtivo ? "✓ Há plano de exercícios ativo para casa." : "Prescrever os exercícios para casa e enviar o link."}</span>
              {!temPlanoAtivo && (
                <a href="#exercicios" className={btn}>
                  Ir para exercícios
                </a>
              )}
            </li>
            <li>
              O cuidado do dia seguinte (“como você está depois da sessão?”) aparece sugerido em{" "}
              <Link href="/tarefas" className="underline">
                Tarefas
              </Link>{" "}
              amanhã às 9h, para você aprovar.
            </li>
          </ul>
        </div>
      )}

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
              {s.remarcacoes > 0 && (
                <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber" title="Quantas vezes esta consulta foi remarcada">
                  remarcada {s.remarcacoes}×
                </span>
              )}
              {s.cobranca && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ color: s.cobranca.status === "RECEIVED" ? "#2DD4A0" : s.cobranca.status === "OVERDUE" ? "#E05C5C" : "#E0B050", background: "#ffffff10" }}
                  title={`Cobrança de ${s.cobranca.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, vence em ${s.cobranca.vencimento.split("-").reverse().join("/")}`}
                >
                  {s.cobranca.status === "RECEIVED" ? "Pago ✓" : s.cobranca.status === "OVERDUE" ? "Cobrança vencida" : "Cobrança enviada"}
                </span>
              )}
              {s.recibo && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink-muted" title="Recibo da fisioterapia">
                  {s.recibo.estado === "enviado" ? `Recibo nº ${String(s.recibo.numero).padStart(6, "0")} enviado` : s.recibo.estado === "dispensado" ? "Sem recibo" : "Recibo emitido, não enviado"}
                </span>
              )}
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                {(s.status === "agendado" || s.status === "confirmado") && !passou && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-muted" title="Se desmarcar, o recibo não é enviado depois da sessão">
                    <input type="checkbox" checked={s.enviar_recibo} disabled={ocupado === s.id} onChange={(e) => void recibo(s.id, { acao: "caixinha", enviar: e.target.checked })} />
                    Enviar recibo depois da sessão
                  </label>
                )}
                {s.status === "compareceu" && s.recibo?.estado !== "enviado" && (
                  <button type="button" disabled={ocupado === s.id} className={btn} onClick={() => void recibo(s.id, { acao: "enviar" })}>
                    {s.recibo ? "Enviar recibo mesmo assim" : "Enviar recibo"}
                  </button>
                )}
                {cobrancaAtiva && (s.status === "agendado" || s.status === "confirmado") && !passou && s.cobranca?.status !== "RECEIVED" && (
                  <button type="button" disabled={ocupado === s.id} className={btn} onClick={() => void cobrar(s.id)}>
                    {s.cobranca ? "Reenviar link de pagamento" : "Enviar cobrança"}
                  </button>
                )}
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
                {(s.status === "agendado" || s.status === "confirmado") && !passou && (
                  <Remarcar a={{ id: s.id, data_hora: s.data_hora, local: s.local }} visivel onFeito={() => router.refresh()} />
                )}
                {s.status === "compareceu" && (
                  <button type="button" disabled={ocupado === s.id} className={btn} onClick={() => void presenca(s.id, "agendado")}>
                    Desfazer
                  </button>
                )}
              </span>
              <HistoricoAgendamento id={s.id} />
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
