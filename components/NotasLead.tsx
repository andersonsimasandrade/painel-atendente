"use client";

import { useEffect, useRef, useState } from "react";
import { Nota } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { pausarRefresh } from "@/lib/pausa-refresh";
import { CampoDitado } from "@/components/lead/CampoDitado";

/**
 * Anotações manuais do consultor no Lead 360: separadas das
 * observações do bot. Cada nota guarda autor + data; dá pra excluir.
 */
export interface SessaoParaNota {
  id: string;
  data_hora: string;
  status: string;
  local: string | null;
}

const diaSP = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10);
const dm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const LOCAL: Record<string, string> = { capoeiras: "Capoeiras", centro: "Centro" };
const ROT: Record<string, string> = { compareceu: "realizada", agendado: "marcada", confirmado: "confirmada", faltou: "faltou" };

/** Sessão sugerida para a anotação: a de hoje; senão, a mais recente que já passou. */
function sessaoSugerida(sessoes: SessaoParaNota[]): string {
  const vivas = sessoes.filter((s) => s.status !== "cancelado");
  const hoje = diaSP(new Date().toISOString());
  const dehoje = vivas.find((s) => diaSP(s.data_hora) === hoje);
  if (dehoje) return dehoje.id;
  const passadas = vivas.filter((s) => new Date(s.data_hora).getTime() <= Date.now()).sort((a, b) => b.data_hora.localeCompare(a.data_hora));
  return passadas[0]?.id ?? "";
}

export function NotasLead({
  telefone,
  initial,
  sessoes = [],
}: {
  telefone: string;
  initial: Nota[];
  sessoes?: SessaoParaNota[];
}) {
  const [notas, setNotas] = useState<Nota[]>(initial);
  const [texto, setTexto] = useState("");
  const [sessaoId, setSessaoId] = useState("");
  const [naEvolucao, setNaEvolucao] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const chaveRascunho = `rascunho:nota:${telefone}`;
  const restaurou = useRef(false);

  // Sessão sugerida e rascunho guardado (sobrevive à atualização da página e a horas de pausa).
  useEffect(() => {
    let r: { texto?: string; sessaoId?: string } | null = null;
    try {
      const s = window.localStorage.getItem(chaveRascunho);
      r = s ? (JSON.parse(s) as { texto?: string; sessaoId?: string }) : null;
    } catch {
      r = null;
    }
    setSessaoId(r?.sessaoId && sessoes.some((x) => x.id === r?.sessaoId) ? r.sessaoId : sessaoSugerida(sessoes));
    if (r?.texto) setTexto(r.texto);
    restaurou.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restaurou.current) return;
    try {
      if (texto.trim()) window.localStorage.setItem(chaveRascunho, JSON.stringify({ texto, sessaoId }));
      else window.localStorage.removeItem(chaveRascunho);
    } catch {
      /* sem armazenamento */
    }
  }, [texto, sessaoId, chaveRascunho]);
  useEffect(() => {
    if (!texto.trim()) return;
    pausarRefresh(true); // há texto sendo escrito: a atualização automática da página fica pausada
    return () => pausarRefresh(false);
  }, [texto.trim() === ""]); // eslint-disable-line react-hooks/exhaustive-deps
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/notas`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        notas?: Nota[];
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setErro(d.error ?? "Não consegui salvar.");
        return false;
      }
      if (Array.isArray(d.notas)) setNotas(d.notas);
      setAviso((d as { aviso?: string }).aviso ?? null);
      return true;
    } catch {
      setErro("Falha de rede.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    const sessao = sessoes.find((x) => x.id === sessaoId) ?? null;
    const ok = await chamar("POST", {
      texto,
      agendamento_id: sessao?.id ?? null,
      data_sessao: sessao ? diaSP(sessao.data_hora) : null,
      registrar_evolucao: !!sessao && naEvolucao,
    });
    if (ok) setTexto("");
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={adicionar} className="flex flex-col gap-2">
        {sessoes.filter((x) => x.status !== "cancelado").length > 0 && (
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-ink-faint">
            Sessão desta anotação
            <select
              value={sessaoId}
              onChange={(e) => setSessaoId(e.target.value)}
              className="rounded-lg border border-line bg-base/70 px-2.5 py-1.5 text-[13px] normal-case tracking-normal text-ink outline-none focus:border-brand/60"
            >
              <option value="">Sem ligar a uma sessão</option>
              {sessoes
                .filter((x) => x.status !== "cancelado")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {new Date(x.data_hora).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" })} ·{" "}
                    {new Date(x.data_hora).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                    {x.local ? ` · ${LOCAL[x.local] ?? x.local}` : ""} ({ROT[x.status] ?? x.status})
                  </option>
                ))}
            </select>
          </label>
        )}
        <CampoDitado valor={texto} onChange={setTexto} minAltura={70} placeholder="Anotação sobre esta sessão (use 🎙 Ditar para falar em vez de digitar)…" />
        {sessaoId && (
          <label className="flex items-center gap-2 text-[12px] text-ink-muted">
            <input type="checkbox" checked={naEvolucao} onChange={(e) => setNaEvolucao(e.target.checked)} />
            Registrar também na evolução desta sessão (prontuário)
          </label>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-faint">O texto fica guardado aqui até você salvar.</span>
          <button
            type="submit"
            disabled={salvando || !texto.trim()}
            className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? "…" : "Adicionar nota"}
          </button>
        </div>
      </form>
      {aviso && <p className="text-[12px] text-amber">{aviso}</p>}

      {erro && <p className="text-[12px] text-amber">{erro}</p>}

      {notas.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">
          Nenhuma anotação ainda — o que você escrever aqui fica só para o time.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notas.map((n) => (
            <li
              key={n.id}
              className="group rounded-xl border border-line bg-surface-2/40 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                  {n.autor ?? "—"}
                  {n.data_sessao && (
                    <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[10.5px] font-semibold normal-case tracking-normal text-brand">Sessão de {dm(n.data_sessao)}</span>
                  )}
                  {n.criado_em && (
                    <span className="ml-2 font-normal normal-case tracking-normal">
                      {formatDateTime(n.criado_em)}
                    </span>
                  )}
                </span>
                {/* opacity-60 fixo em vez de opacity-0/group-hover: em tela de
                    toque não existe hover, e a lixeira ficava invisível — porém
                    clicável — no canto de cada nota. */}
                <button
                  type="button"
                  onClick={() => {
                    // Sem desfazer do outro lado: a nota é escrita à mão e não
                    // existe em nenhum outro lugar.
                    const trecho =
                      n.texto.length > 120 ? `${n.texto.slice(0, 120)}…` : n.texto;
                    if (!window.confirm(`Excluir esta anotação?\n\n"${trecho}"`)) return;
                    void chamar("DELETE", { id: n.id });
                  }}
                  disabled={salvando}
                  title="Excluir anotação"
                  aria-label="Excluir anotação"
                  className="rounded p-1 text-ink-faint opacity-60 transition hover:text-danger group-hover:opacity-100 disabled:opacity-40"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-.7 12.1a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                {n.texto}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
