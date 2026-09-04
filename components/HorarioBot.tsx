"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import type { HorarioBot } from "@/lib/types";

/**
 * Seção "Horário do bot" (/config): dias e janela em que o robô responde.
 * Fora do horário, o bot envia UMA mensagem de expediente (editável aqui),
 * guarda o que o lead disser e responde tudo assim que o expediente abrir.
 */

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PADRAO: HorarioBot = {
  ativo: false,
  dias: [1, 2, 3, 4, 5, 6],
  inicio: "08:00",
  fim: "17:30",
  mensagem: "",
};

function sessaoExpirada(res: Response): boolean {
  return res.type === "opaqueredirect" || res.status === 0 || res.status === 401;
}

export function SecaoHorarioBot({ onSessaoExpirou }: { onSessaoExpirou: () => void }) {
  const [cfg, setCfg] = useState<HorarioBot>(PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  // Leitura FALHOU — diferente de "nunca foi configurado", em que o PADRÃO é a
  // resposta certa. Sem essa distinção, um 500 renderizava "Desligado — responde
  // 24h" e um Salvar em cima gravava o PADRÃO por cima da janela real.
  const [erroCarga, setErroCarga] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store", redirect: "manual" });
        if (sessaoExpirada(res)) {
          if (vivo) setErroCarga(true);
          onSessaoExpirou();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          config?: { horario_bot?: HorarioBot | null };
        };
        if (!vivo) return;
        if (!res.ok || !data.ok) {
          setErroCarga(true);
          return;
        }
        // horario_bot nulo com ok:true = nunca configurado. O PADRÃO vale.
        if (data.config?.horario_bot) setCfg({ ...PADRAO, ...data.config.horario_bot });
      } catch {
        if (vivo) setErroCarga(true);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onSessaoExpirou]);

  // Enquanto a leitura não for confirmada, o formulário fica travado: qualquer
  // Salvar aqui gravaria um estado que o servidor não confirmou.
  const travado = carregando || erroCarga;

  function toggleDia(d: number) {
    setCfg((c) => ({
      ...c,
      dias: c.dias.includes(d) ? c.dias.filter((x) => x !== d) : [...c.dias, d].sort(),
    }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "manual",
        body: JSON.stringify({ horario_bot: cfg }),
      });
      if (sessaoExpirada(res)) {
        onSessaoExpirou();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg({ tipo: "erro", texto: data.error ?? "Não foi possível salvar." });
        return;
      }
      setMsg({ tipo: "ok", texto: "Pronto! O bot já segue este horário." });
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de rede. Tente de novo." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel
      title="Horário do bot"
      subtitle="Fora da janela, o robô manda a mensagem de expediente e responde tudo quando abrir"
      delay={100}
    >
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Com o horário <strong className="font-semibold text-ink">ligado</strong>, lead que chegar
        de madrugada recebe UMA mensagem de expediente (abaixo), o que ele escrever fica
        guardado, e o bot responde tudo assim que a janela abrir — como um atendente que chegou
        no escritório. Desligado, o bot responde 24h como hoje.
      </p>

      {erroCarga && (
        <p className="mt-3 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-[12.5px] leading-relaxed text-amber">
          Não consegui ler o horário que está no ar — o formulário abaixo mostra o padrão, não o
          que está gravado. Ele fica travado até você recarregar a página, pra não substituir a
          janela real.
        </p>
      )}

      <form onSubmit={salvar} className="mt-4 space-y-4">
        {/* Toggle */}
        <label
          htmlFor="horario-toggle"
          className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3"
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">
              Limitar o bot a um horário de atendimento
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
              {cfg.ativo ? "Ligado — o robô só responde na janela abaixo." : "Desligado — o robô responde 24h."}
            </span>
          </span>
          <button
            id="horario-toggle"
            type="button"
            role="switch"
            aria-checked={cfg.ativo}
            onClick={() => setCfg((c) => ({ ...c, ativo: !c.ativo }))}
            disabled={travado}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60 ${
              cfg.ativo ? "bg-brand" : "bg-surface-3 ring-1 ring-inset ring-line-strong"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition ${
                cfg.ativo ? "translate-x-[22px] bg-[#04140d]" : "translate-x-[2px] bg-ink-muted"
              }`}
            />
          </button>
        </label>

        {/* Dias */}
        <div>
          <p className="text-[12.5px] font-medium text-ink">Dias de funcionamento</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DIAS.map((rotulo, d) => {
              const ligado = cfg.dias.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={ligado}
                  onClick={() => toggleDia(d)}
                  disabled={travado}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition disabled:opacity-60 ${
                    ligado
                      ? "bg-brand/15 text-brand ring-brand/30"
                      : "bg-surface-2/60 text-ink-faint ring-line hover:text-ink"
                  }`}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>
        </div>

        {/* Janela */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="horario-inicio" className="text-[12.5px] font-medium text-ink">
              Abre às
            </label>
            <input
              id="horario-inicio"
              type="time"
              value={cfg.inicio}
              onChange={(e) => setCfg((c) => ({ ...c, inicio: e.target.value }))}
              disabled={travado}
              className="mt-1.5 block h-10 rounded-lg border border-line bg-base/70 px-3 text-[14px] text-ink outline-none transition focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)] disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="horario-fim" className="text-[12.5px] font-medium text-ink">
              Fecha às
            </label>
            <input
              id="horario-fim"
              type="time"
              value={cfg.fim}
              onChange={(e) => setCfg((c) => ({ ...c, fim: e.target.value }))}
              disabled={travado}
              className="mt-1.5 block h-10 rounded-lg border border-line bg-base/70 px-3 text-[14px] text-ink outline-none transition focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)] disabled:opacity-60"
            />
          </div>
          <p className="pb-2 text-[11.5px] text-ink-faint">Fuso de São Paulo.</p>
        </div>

        {/* Mensagem fora do horário */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="horario-msg" className="text-[12.5px] font-medium text-ink">
              Mensagem fora do horário (enviada uma vez por período)
            </label>
            <span className="tnum text-[11px] text-ink-faint">{cfg.mensagem.length}/600</span>
          </div>
          <textarea
            id="horario-msg"
            value={cfg.mensagem}
            onChange={(e) => setCfg((c) => ({ ...c, mensagem: e.target.value }))}
            rows={4}
            maxLength={600}
            disabled={travado}
            placeholder="Ex.: Olá! Nosso atendimento é de segunda a sábado, das 8h às 17h30. Assim que abrir, te respondo por aqui! Me adianta teu nome e de qual cidade você fala?"
            className="scroll-slim mt-1.5 w-full resize-y rounded-lg border border-line bg-base/70 px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)] disabled:opacity-60"
          />
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={salvando || travado}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/40 border-t-[#04140d]" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            Salvar horário
          </button>
          {msg && (
            <p
              className={`text-[12px] ${msg.tipo === "ok" ? "text-brand" : "text-amber"}`}
            >
              {msg.texto}
            </p>
          )}
        </div>
      </form>
    </Panel>
  );
}
