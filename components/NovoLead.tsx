"use client";

import { useEffect, useState } from "react";
import { guardarRascunho, lerRascunho, pausarRefresh } from "@/lib/pausa-refresh";
import { PhoneField } from "./PhoneField";
import { AvisoTelefone } from "./AvisoTelefone";

// Cadastro manual de lead (quem ligou, indicação, conversa pelo celular). Opcionalmente já marca a consulta.
// Fluxo: cadastra o lead → (se marcou dia e horário) grava a consulta na agenda → recarrega a lista.
export function NovoLead({ parceiros = [] }: { parceiros?: { codigo: string; nome: string }[] }) {
  const [parceiro, setParceiro] = useState("");
  const [chaveTel, setChaveTel] = useState(0); // remonta o campo de telefone quando o rascunho é restaurado
  const [aberto, setAberto] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState("");
  const [obs, setObs] = useState("");
  const [marcar, setMarcar] = useState(false);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [local, setLocal] = useState<"capoeiras" | "centro" | "">("");
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Rascunho: se a página recarregar (comum no celular ao abrir o calendário), o formulário volta como estava.
  const [carregado, setCarregado] = useState(false);
  useEffect(() => {
    const r = lerRascunho<Record<string, unknown>>("novo-lead");
    if (r) {
      setAberto(r.aberto === true);
      setTelefone(String(r.telefone ?? ""));
      setNome(String(r.nome ?? ""));
      setOrigem(String(r.origem ?? ""));
      setParceiro(String(r.parceiro ?? ""));
      setObs(String(r.obs ?? ""));
      setMarcar(r.marcar === true);
      setData(String(r.data ?? ""));
      setHora(String(r.hora ?? ""));
      setLocal(r.local === "capoeiras" || r.local === "centro" ? r.local : "");
      setConfirmar(r.confirmar === true);
      setChaveTel((n) => n + 1);
    }
    setCarregado(true);
  }, []);
  useEffect(() => {
    if (!carregado) return;
    guardarRascunho("novo-lead", aberto ? { aberto, telefone, nome, origem, parceiro, obs, marcar, data, hora, local, confirmar } : null);
  }, [carregado, aberto, telefone, nome, origem, parceiro, obs, marcar, data, hora, local, confirmar]);
  // Com o formulário aberto, a atualização automática da página fica pausada.
  useEffect(() => {
    if (!aberto) return;
    pausarRefresh(true);
    return () => pausarRefresh(false);
  }, [aberto]);

  const digitos = telefone.replace(/\D/g, "");
  const pronto = digitos.length >= 10 && (!marcar || (!!data && !!hora && !!local));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    setEnviando(true);
    try {
      const r1 = await fetch("/api/lead/novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, nome, origem, observacoes: obs, parceiro: origem === "indicacao" ? parceiro : "" }),
      });
      const d1 = (await r1.json()) as { ok: boolean; error?: string; jaExistia?: boolean };
      if (!r1.ok || !d1.ok) return setErro(d1.error ?? "Não consegui cadastrar.");
      let msg = d1.jaExistia ? "Esse número já estava cadastrado; completei os dados." : "Lead cadastrado.";
      if (marcar) {
        const r2 = await fetch("/api/agenda/novo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefone, nome, data, hora, local, confirmar }),
        });
        const d2 = (await r2.json()) as { ok: boolean; error?: string; quando?: string; confirmado?: boolean };
        if (!r2.ok || !d2.ok) return setErro(`${msg} Mas a consulta não foi marcada: ${d2.error ?? "erro"}`);
        msg += ` Consulta marcada: ${d2.quando}.` + (confirmar ? (d2.confirmado ? " Confirmação enviada." : " (A confirmação por WhatsApp não saiu.)") : "");
      }
      setOk(msg);
      guardarRascunho("novo-lead", null);
      setTimeout(() => window.location.reload(), 1600);
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const campo = "w-full rounded-xl border border-line bg-base/70 px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand/60";
  const rotulo = "mb-1 block text-[11.5px] font-medium text-ink-muted";

  return (
    <div className="mb-4 rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Novo lead</h3>
          <p className="text-[12px] text-ink-muted">Cadastre quem ligou ou chamou por fora do robô e, se quiser, já marque a consulta.</p>
        </div>
        {!aberto && (
          <button type="button" onClick={() => setAberto(true)} className="rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright">
            + Cadastrar lead
          </button>
        )}
      </div>

      {aberto && (
        <form onSubmit={salvar} className="mt-3.5 grid gap-3 border-t border-line pt-3.5 sm:grid-cols-2">
          <label>
            <span className={rotulo}>WhatsApp (com DDD) *</span>
            <PhoneField key={chaveTel} value={telefone} onChange={setTelefone} variant="dark" autoFocus />
          </label>
          <AvisoTelefone telefone={telefone} modo="aviso" />
          <label>
            <span className={rotulo}>Nome</span>
            <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da pessoa" />
          </label>
          <label>
            <span className={rotulo}>Como chegou até você?</span>
            <select className={campo} value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Não sei / direto</option>
              <option value="indicacao">Indicação</option>
              <option value="instagram">Instagram</option>
              <option value="google">Google</option>
              <option value="meta">Anúncio no Facebook/Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="site">Site</option>
            </select>
          </label>
          {origem === "indicacao" && parceiros.length > 0 && (
            <label>
              <span className={rotulo}>Indicado por qual parceiro?</span>
              <select className={campo} value={parceiro} onChange={(e) => setParceiro(e.target.value)}>
                <option value="">Pessoa física / outro</option>
                {parceiros.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className={rotulo}>Observação</span>
            <input className={campo} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: ligou pedindo horário" />
          </label>

          <label className="flex items-center gap-2 text-[13px] text-ink sm:col-span-2">
            <input type="checkbox" checked={marcar} onChange={(e) => setMarcar(e.target.checked)} />
            Já marcar a consulta agora
          </label>

          {marcar && (
            <>
              <label>
                <span className={rotulo}>Dia *</span>
                <input className={campo} type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label>
                <span className={rotulo}>Horário *</span>
                <input className={campo} type="time" step={900} value={hora} onChange={(e) => setHora(e.target.value)} />
              </label>
              <label>
                <span className={rotulo}>Consultório *</span>
                <select className={campo} value={local} onChange={(e) => setLocal(e.target.value as "capoeiras" | "centro" | "")}>
                  <option value="">Escolha…</option>
                  <option value="capoeiras">Capoeiras</option>
                  <option value="centro">Centro</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2.5 text-[12.5px] text-ink-muted">
                <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
                Enviar confirmação por WhatsApp
              </label>
            </>
          )}

          {erro && <p className="text-[12.5px] text-red-300 sm:col-span-2">{erro}</p>}
          {ok && <p className="text-[12.5px] text-brand sm:col-span-2">{ok}</p>}

          <div className="flex items-center gap-2 sm:col-span-2">
            <button type="submit" disabled={!pronto || enviando} className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50">
              {enviando ? "Salvando…" : marcar ? "Cadastrar e marcar consulta" : "Cadastrar lead"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="text-[12.5px] text-ink-faint transition hover:text-ink-muted">
              cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
