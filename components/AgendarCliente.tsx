"use client";

import { useState } from "react";
import { SlotDia } from "@/lib/types";
import { PhoneField } from "./PhoneField";

// Paleta clara da página pública: verde, terracota, creme.
// >>> ADAPTE às cores da sua marca <<<
const CARD = "rounded-2xl border border-[#ece6dd] bg-white shadow-[0_10px_40px_-24px_rgba(20,53,31,0.25)]";

export function AgendarCliente({
  empresa,
  consultorNome,
  slug,
  dias,
  nomeInicial,
  telefoneInicial,
  conviteToken,
}: {
  empresa: string;
  consultorNome: string;
  slug: string;
  dias: SlotDia[];
  nomeInicial: string | null;
  telefoneInicial: string;
  conviteToken?: string;
}) {
  const [sel, setSel] = useState<{ iso: string; label: string } | null>(null);
  const [nome, setNome] = useState(nomeInicial ?? "");
  const [telefone, setTelefone] = useState(telefoneInicial ?? "");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function confirmar() {
    if (!sel) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/agendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, data_hora: sel.iso, telefone, nome, convite: conviteToken }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; quando?: string };
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Não foi possível agendar.");
        setSel(null);
        return;
      }
      setSucesso(data.quando ?? "");
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  if (sucesso) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#2f9e5e]/12 text-2xl">
          ✅
        </div>
        <h2 className="text-lg font-semibold text-[#16351f]">Reunião marcada!</h2>
        <p className="mt-1.5 text-[14px] text-[#4b463f]">
          {sucesso ? `Sua reunião está confirmada para ${sucesso}.` : "Agendamento confirmado."}
        </p>
        <p className="mt-2 text-[12.5px] text-[#8a837a]">
          {consultorNome ? ` ${consultorNome}` : " O consultor"} te manda o link do encontro um pouco antes. Já
          te enviamos a confirmação no WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`${CARD} p-4`}>
        {dias.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#7a746c]">
            Sem horários disponíveis no momento.
          </p>
        ) : (
          <div className="grid grid-flow-col auto-cols-[minmax(116px,1fr)] gap-3 overflow-x-auto pb-1">
            {dias.map((d) => (
              <div key={d.dataIso} className="min-w-0">
                <div className="mb-2 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#a0968a]">
                    {d.diaSemana}
                  </p>
                  <p className="text-[15px] font-semibold text-[#16351f]">{d.diaMes}</p>
                </div>
                <div className="flex flex-col gap-2">
                  {d.slots.map((s) => {
                    const ativo = sel?.iso === s.iso;
                    return (
                      <button
                        key={s.iso}
                        type="button"
                        onClick={() => setSel({ iso: s.iso, label: `${d.diaMes} ${s.hora}` })}
                        className={`rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                          ativo
                            ? "border-[#2f9e5e] bg-[#2f9e5e] text-white shadow-sm"
                            : "border-[#d7e6dc] text-[#2f9e5e] hover:border-[#2f9e5e] hover:bg-[#2f9e5e]/[0.07]"
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
        )}
      </div>

      {sel && (
        <div className={`${CARD} flex flex-col gap-3 p-5`}>
          <p className="text-[13.5px] text-[#4b463f]">
            Horário escolhido:{" "}
            <span className="font-semibold text-[#2f9e5e]">{sel.label}</span>
          </p>
          <label className="text-left">
            <span className="mb-1 block text-[12px] font-medium text-[#6f6a63]">Seu nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
              className="w-full rounded-xl border border-[#ddd6cc] bg-white px-4 py-2.5 text-[14px] text-[#2b2b2b] outline-none transition focus:border-[#2f9e5e] focus:ring-2 focus:ring-[#2f9e5e]/15"
            />
          </label>
          <label className="text-left">
            <span className="mb-1 block text-[12px] font-medium text-[#6f6a63]">
              Seu WhatsApp (com DDD)
            </span>
            <PhoneField value={telefone} onChange={setTelefone} variant="light" />
          </label>
          {erro && <p className="text-[12.5px] font-medium text-[#c2410c]">{erro}</p>}
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={loading || !nome || telefone.replace(/\D/g, "").length < 10}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f9e5e] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#268a50] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Agendando…" : "Confirmar agendamento"}
          </button>
        </div>
      )}
      {erro && !sel && <p className="text-center text-[12.5px] font-medium text-[#c2410c]">{erro}</p>}

      <p className="pt-1 text-center text-[11px] text-[#a89f95]">
        {empresa}
      </p>
    </div>
  );
}
