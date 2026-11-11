"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StatusCadastro } from "@/lib/cadastro";

const botao = "inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";
const botaoPrim = "inline-flex items-center rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50";

const dh = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const nascBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/**
 * Cadastro preenchido pelo próprio paciente (nome completo, e-mail, nascimento, CPF, endereço): o painel pede por WhatsApp,
 * os dados caem nos campos da ficha e aqui o Anderson só confere. A data de nascimento é também a senha da devolutiva.
 */
export function CadastroPaciente({ telefone, status }: { telefone: string; status: StatusCadastro }) {
  const router = useRouter();
  const url = `/api/lead/${encodeURIComponent(telefone)}/cadastro`;
  const [nasc, setNasc] = useState(nascBR(status.nascimento));
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(corpo: Record<string, unknown>, ok: string, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setErro(null);
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui agora.");
        return;
      }
      setMsg(ok);
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 text-[13px]">
      {status.recebidoEm && !status.conferidoEm && (
        <div className="rounded-lg border border-brand/30 bg-brand/[0.08] px-3 py-2.5">
          <p className="text-ink">
            O paciente preencheu o cadastro em <b>{dh(status.recebidoEm)}</b>. Os dados já estão nos campos acima (nome, e-mail, CPF, endereço). Confira e confirme.
          </p>
          <button type="button" className={`${botaoPrim} mt-2`} disabled={ocupado} onClick={() => void chamar({ acao: "conferido" }, "Cadastro conferido.")}>
            ✓ Está tudo certo
          </button>
        </div>
      )}
      {status.recebidoEm && status.conferidoEm && <p className="text-ink-muted">Cadastro preenchido pelo paciente e conferido em {dh(status.conferidoEm)}.</p>}
      {!status.recebidoEm && status.conviteEnviadoEm && <p className="text-ink-muted">Pedido de cadastro enviado em {dh(status.conviteEnviadoEm)}. Aguardando o paciente preencher.</p>}

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          className={botao}
          disabled={ocupado}
          onClick={() => void chamar({ acao: "pedir" }, "Pedido enviado pelo WhatsApp.", "Enviar agora ao paciente o link para ele preencher o próprio cadastro (nome completo, e-mail, nascimento, CPF e endereço)?")}
        >
          {status.recebidoEm || status.conviteEnviadoEm ? "Pedir de novo pelo WhatsApp" : "Pedir cadastro pelo WhatsApp"}
        </button>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-ink-faint">Data de nascimento (senha da devolutiva)</span>
          <span className="flex gap-2">
            <input
              className="w-36 rounded-lg border border-line bg-base/70 px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand/60"
              inputMode="numeric"
              placeholder="dd/mm/aaaa"
              value={nasc}
              onChange={(e) => setNasc(e.target.value)}
            />
            <button type="button" className={botao} disabled={ocupado || nasc === nascBR(status.nascimento)} onClick={() => void chamar({ acao: "nascimento", nascimento: nasc }, "Data salva.")}>
              Salvar
            </button>
          </span>
        </label>
      </div>
      {msg && <p className="text-brand">{msg}</p>}
      {erro && <p className="text-amber">{erro}</p>}
    </div>
  );
}
