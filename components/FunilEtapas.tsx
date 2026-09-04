"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Editor das etapas do funil (Ajustes, só admin): renomear/recolorir/reordenar
 * colunas, criar/excluir etapas personalizadas e montar a SEQUÊNCIA de
 * mensagens de cada etapa (dispara quando alguém MOVE o lead pra ela no
 * painel; cancela sozinha se o lead responder ou mudar de etapa antes).
 * As 7 etapas do robô não podem ser excluídas — o bot grava nelas.
 */

interface Etapa {
  key: string;
  label: string;
  color: string;
  position: number;
  rank: number;
  sistema: boolean;
}

interface Msg {
  atraso_min: number;
  texto: string;
  /** Unidade escolhida no editor (só local — persiste enquanto digita). */
  u?: "min" | "h" | "d";
}

const PALETA = [
  "#2FE58F", "#18A57C", "#39B7C4", "#4EA8DE",
  "#A78BFA", "#E0A63C", "#E05C5C", "#8D9A93",
];

// Nome legível de cada cor. O aria-label era `Cor ${c}`, ou seja, quem usa
// leitor de tela ouvia oito códigos hexadecimais em sequência ("Cor #2FE58F").
const NOME_COR: Record<string, string> = {
  "#2FE58F": "Verde",
  "#18A57C": "Verde-escuro",
  "#39B7C4": "Turquesa",
  "#4EA8DE": "Azul",
  "#A78BFA": "Roxo",
  "#E0A63C": "Âmbar",
  "#E05C5C": "Vermelho",
  "#8D9A93": "Cinza",
};

// atraso_min → {valor, unidade} pra edição amigável
function praUnidade(min: number): { v: number; u: "min" | "h" | "d" } {
  if (min >= 1440 && min % 1440 === 0) return { v: min / 1440, u: "d" };
  if (min >= 60 && min % 60 === 0) return { v: min / 60, u: "h" };
  return { v: min, u: "min" };
}
const praMin = (v: number, u: string): number =>
  Math.round(v * (u === "d" ? 1440 : u === "h" ? 60 : 1));

export function FunilEtapas({
  initialEtapas,
  initialMsgs,
}: {
  initialEtapas: Etapa[];
  initialMsgs: Record<string, Msg[]>;
}) {
  const router = useRouter();
  const [etapas, setEtapas] = useState<Etapa[]>(initialEtapas);
  const [msgs, setMsgs] = useState<Record<string, Msg[]>>(initialMsgs);
  const [aberta, setAberta] = useState<string | null>(null); // etapa com sequência aberta
  const [corDe, setCorDe] = useState<string | null>(null); // etapa escolhendo cor
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [destino, setDestino] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(PALETA[3]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // O aviso de sucesso só era limpo na próxima chamada a chamar(): ficava
  // pendurado no topo indefinidamente, sugerindo que ações posteriores também
  // tinham dado certo. O de erro fica — quem erra precisa ler com calma.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function chamar(
    method: string,
    body: Record<string, unknown>,
    url = "/api/funil/etapas",
  ): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) {
        setErro(d.error ?? "Não consegui salvar.");
        return false;
      }
      return true;
    } catch {
      setErro("Falha de rede.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  // Ressincroniza as ETAPAS com o servidor; as sequências locais só são
  // substituídas para a etapa `syncMsgsDe` (recém-salva) — senão uma edição
  // não salva de OUTRA etapa seria apagada.
  async function recarregar(syncMsgsDe?: string) {
    try {
      const res = await fetch("/api/funil/etapas", { cache: "no-store" });
      const d = (await res.json()) as {
        ok?: boolean;
        etapas?: Etapa[];
        msgs?: Record<string, Msg[]>;
      };
      if (d.ok && d.etapas) {
        setEtapas(d.etapas);
        if (syncMsgsDe) {
          setMsgs((prev) => ({ ...prev, [syncMsgsDe]: d.msgs?.[syncMsgsDe] ?? [] }));
        }
      }
    } catch {
      /* mantém o estado local */
    }
    router.refresh();
  }

  async function renomear(key: string, label: string) {
    const atual = etapas.find((e) => e.key === key);
    if (!atual || atual.label === label.trim() || !label.trim()) return;
    if (await chamar("PATCH", { key, label })) await recarregar();
  }

  async function recolorir(key: string, color: string) {
    setCorDe(null);
    if (await chamar("PATCH", { key, color })) await recarregar();
  }

  async function moverPos(key: string, delta: -1 | 1) {
    const ordem = etapas.map((e) => e.key);
    const i = ordem.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ordem.length) return;
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    setEtapas((prev) =>
      [...prev].sort((a, b) => ordem.indexOf(a.key) - ordem.indexOf(b.key)),
    );
    // Sucesso OU falha: ressincroniza com o servidor (falha reverte o otimista).
    await chamar("PUT", { ordem });
    await recarregar();
  }

  async function criar() {
    if (!novoNome.trim()) return;
    if (await chamar("POST", { label: novoNome, color: novaCor })) {
      setNovoNome("");
      setAviso("Etapa criada — ela já aparece no kanban.");
      await recarregar();
    }
  }

  async function excluir(key: string) {
    if (!destino) {
      setErro("Escolha pra onde vão os leads dessa etapa.");
      return;
    }
    if (await chamar("DELETE", { key, moverPara: destino })) {
      setExcluindo(null);
      setDestino("");
      await recarregar();
    }
  }

  async function salvarSequencia(key: string) {
    const lista = (msgs[key] ?? [])
      .filter((m) => m.texto.trim())
      .map((m) => ({ atraso_min: m.atraso_min, texto: m.texto }));
    if (await chamar("POST", { key, msgs: lista }, "/api/funil/etapas/msgs")) {
      setAviso("Sequência salva.");
      await recarregar(key);
    }
  }

  function mudarMsg(key: string, i: number, patch: Partial<Msg>) {
    setMsgs((prev) => {
      const lista = [...(prev[key] ?? [])];
      lista[i] = { ...lista[i], ...patch };
      return { ...prev, [key]: lista };
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        As colunas do kanban (<span className="text-ink">/funil</span>) e o seletor de
        etapa nascem daqui. Etapas com o selo{" "}
        <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[10.5px] text-ink-faint">robô</span>{" "}
        são usadas pelo robô e não podem ser excluídas. A <strong>sequência</strong> de uma
        etapa dispara quando alguém <em>move</em> um lead pra ela no painel — e cancela
        sozinha se o lead responder ou sair da etapa antes da hora.
      </p>

      {erro && (
        <p
          role="alert"
          className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-[12.5px] text-amber"
        >
          {erro}
        </p>
      )}
      {aviso && (
        <p
          role="status"
          className="rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-[12.5px] text-brand"
        >
          {aviso}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {etapas.map((e, idx) => {
          const seq = msgs[e.key] ?? [];
          const seqAberta = aberta === e.key;
          return (
            <li key={e.key} className="rounded-xl border border-line bg-surface-2/40 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* cor */}
                <button
                  type="button"
                  onClick={() => setCorDe(corDe === e.key ? null : e.key)}
                  title="Mudar a cor"
                  aria-label={`Cor da etapa ${e.label}`}
                  className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white/10 transition hover:scale-110"
                  style={{ backgroundColor: e.color }}
                />
                {/* nome (key inclui o label: rename que falhar volta ao valor real) */}
                <input
                  key={`${e.key}:${e.label}`}
                  defaultValue={e.label}
                  maxLength={30}
                  onBlur={(ev) => void renomear(e.key, ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                  }}
                  aria-label="Nome da etapa"
                  className="w-[180px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] font-medium text-ink outline-none transition hover:border-line focus:border-brand/50"
                />
                {e.sistema && (
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] text-ink-faint" title="Etapa usada pelo bot — não pode ser excluída">
                    robô
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAberta(seqAberta ? null : e.key);
                    setErro(null);
                    setAviso(null);
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium leading-none ring-1 ring-inset transition ${
                    seq.length
                      ? "bg-brand/10 text-brand ring-brand/25"
                      : "bg-surface-2/60 text-ink-muted ring-line hover:text-ink"
                  }`}
                >
                  Sequência{seq.length ? ` · ${seq.length}` : ""}
                </button>

                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void moverPos(e.key, -1)}
                    disabled={ocupado || idx === 0}
                    title="Mover pra esquerda no kanban"
                    aria-label="Subir etapa"
                    className="rounded p-1 text-ink-faint transition hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => void moverPos(e.key, 1)}
                    disabled={ocupado || idx === etapas.length - 1}
                    title="Mover pra direita no kanban"
                    aria-label="Descer etapa"
                    className="rounded p-1 text-ink-faint transition hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                  {!e.sistema && (
                    <button
                      type="button"
                      onClick={() => {
                        setExcluindo(excluindo === e.key ? null : e.key);
                        setDestino("");
                      }}
                      disabled={ocupado}
                      title="Excluir etapa"
                      aria-label="Excluir etapa"
                      className="rounded p-1 text-ink-faint transition hover:text-red-300 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>

              {corDe === e.key && (
                <div className="mt-2 flex items-center gap-1.5 pl-6">
                  {PALETA.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => void recolorir(e.key, c)}
                      aria-label={NOME_COR[c] ?? c}
                      aria-pressed={c === e.color}
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 ${
                        c === e.color ? "ring-2 ring-white/60" : "ring-1 ring-white/10"
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {/* A seleção só existia na espessura do anel (1px vs 2px).
                          Um check dá um segundo canal, além da cor. */}
                      {c === e.color && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="m5 13 4 4L19 7"
                            stroke="#0b1a12"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {excluindo === e.key && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                  <span className="text-[12px] text-ink-muted">Mover os leads dela para:</span>
                  <select
                    value={destino}
                    onChange={(ev) => setDestino(ev.target.value)}
                    className="rounded-lg border border-line bg-base/70 px-2 py-1 text-[12px] text-ink outline-none focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/50"
                  >
                    <option value="">— escolha —</option>
                    {etapas
                      .filter((o) => o.key !== e.key)
                      .map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void excluir(e.key)}
                    disabled={ocupado}
                    className="rounded-lg bg-red-400/15 px-2.5 py-1 text-[12px] font-semibold text-red-300 ring-1 ring-inset ring-red-400/30 transition hover:bg-red-400/25 disabled:opacity-50"
                  >
                    Excluir etapa
                  </button>
                </div>
              )}

              {seqAberta && (
                <div className="mt-2.5 flex flex-col gap-2 border-t border-line pt-2.5">
                  {seq.length === 0 && (
                    <p className="text-[12px] text-ink-faint">
                      Nenhuma mensagem — mover um lead pra cá não dispara nada.
                    </p>
                  )}
                  {seq.map((m, i) => {
                    // A unidade escolhida persiste mesmo com o número zerado
                    // (senão limpar o campo voltava pra "min" em silêncio).
                    const derivado = praUnidade(m.atraso_min);
                    const u = m.u ?? derivado.u;
                    const v = m.u ? m.atraso_min / (u === "d" ? 1440 : u === "h" ? 60 : 1) : derivado.v;
                    return (
                      <div key={i} className="flex flex-wrap items-start gap-2">
                        <span className="mt-2 text-[11px] text-ink-faint">
                          {i + 1}ª ·{" "}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={9999}
                          value={Number.isFinite(v) ? v : 0}
                          onChange={(ev) =>
                            mudarMsg(e.key, i, {
                              atraso_min: praMin(Number(ev.target.value) || 0, u),
                              u,
                            })
                          }
                          aria-label="Atraso"
                          className="tnum h-8 w-[64px] rounded-lg border border-line bg-base/70 px-2 text-[12.5px] text-ink outline-none focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/50"
                        />
                        <select
                          value={u}
                          onChange={(ev) =>
                            mudarMsg(e.key, i, {
                              atraso_min: praMin(v, ev.target.value),
                              u: ev.target.value as Msg["u"],
                            })
                          }
                          aria-label="Unidade do atraso"
                          className="h-8 rounded-lg border border-line bg-base/70 px-1.5 text-[12px] text-ink outline-none focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/50"
                        >
                          <option value="min">min depois</option>
                          <option value="h">horas depois</option>
                          <option value="d">dias depois</option>
                        </select>
                        <textarea
                          value={m.texto}
                          onChange={(ev) => mudarMsg(e.key, i, { texto: ev.target.value })}
                          rows={2}
                          maxLength={2000}
                          placeholder="Mensagem (use {nome} pro primeiro nome do lead)…"
                          aria-label="Texto da mensagem da sequência" className="min-w-[220px] flex-1 resize-y rounded-lg border border-line bg-base/70 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-brand/50"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMsgs((prev) => ({
                              ...prev,
                              [e.key]: (prev[e.key] ?? []).filter((_, j) => j !== i),
                            }))
                          }
                          title="Remover mensagem"
                          aria-label="Remover mensagem"
                          className="mt-1.5 rounded p-1 text-ink-faint transition hover:text-red-300"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMsgs((prev) => ({
                          ...prev,
                          [e.key]: [
                            ...(prev[e.key] ?? []),
                            { atraso_min: (prev[e.key] ?? []).length ? 60 : 0, texto: "" },
                          ],
                        }))
                      }
                      disabled={(msgs[e.key] ?? []).length >= 10}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-40"
                    >
                      + mensagem
                    </button>
                    <button
                      type="button"
                      onClick={() => void salvarSequencia(e.key)}
                      disabled={ocupado}
                      className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50"
                    >
                      {ocupado ? "…" : "Salvar sequência"}
                    </button>
                    <span className="text-[11px] text-ink-faint">
                      O atraso conta a partir do momento em que o lead entra na etapa.
                    </span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* nova etapa */}
      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void criar();
          }}
          maxLength={30}
          placeholder="Nova etapa (ex.: Proposta enviada)…"
          aria-label="Nome da nova etapa" className="h-9 min-w-[200px] rounded-lg border border-line bg-base/70 px-3 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-brand/50"
        />
        <span className="flex items-center gap-1.5">
          {PALETA.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNovaCor(c)}
              aria-label={NOME_COR[c] ?? c}
              aria-pressed={c === novaCor}
              className={`flex h-6 w-6 items-center justify-center rounded-full transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 ${
                c === novaCor ? "ring-2 ring-white/60" : "ring-1 ring-white/10"
              }`}
              style={{ backgroundColor: c }}
            >
              {c === novaCor && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m5 13 4 4L19 7"
                    stroke="#0b1a12"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => void criar()}
          disabled={ocupado || !novoNome.trim()}
          className="h-9 rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          Adicionar etapa
        </button>
      </div>
    </div>
  );
}
