"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";

/**
 * Seção "Gatilhos" dos Ajustes (só admin).
 *
 * São as frases que ACORDAM o bot num contato novo — normalmente o texto que o
 * botão do anúncio já manda escrito ("Vim do Insta…"). Quem já é lead ativo é
 * respondido sempre, independente desta lista; o filtro existe só pra o bot não
 * sair falando com quem chegou por outro caminho.
 *
 * Casam por TRECHO, sem acento e sem caixa: "posso ter mais informações" pega
 * "Olá! Posso ter mais informações sobre isso?".
 */

function sessaoExpirada(res: Response): boolean {
  return res.type === "opaqueredirect" || res.status === 0 || res.status === 401;
}

const normaliza = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function Gatilhos({ onSessaoExpirou }: { onSessaoExpirou: () => void }) {
  const [lista, setLista] = useState<string[]>([]);
  const [novo, setNovo] = useState("");
  const [teste, setTeste] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  // Guarda o que veio do servidor pra saber se há mudança pendente.
  const [original, setOriginal] = useState<string>("[]");
  // Leitura FALHOU (≠ lista vazia de verdade). Sem esta distinção, um 500 ou um
  // blip de rede renderizava o alarme "nenhum gatilho" e um Salvar em cima
  // mandava a lista vazia — apagando os gatilhos que estão no ar.
  const [erroCarga, setErroCarga] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/config", { redirect: "manual", cache: "no-store" });
        if (sessaoExpirada(res)) {
          if (vivo) setErroCarga(true);
          onSessaoExpirou();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          config?: { gatilhos?: string[] };
        };
        if (!vivo) return;
        if (!res.ok || !data.ok) {
          setErroCarga(true);
          return;
        }
        const g = data.config?.gatilhos ?? [];
        setLista(g);
        setOriginal(JSON.stringify(g));
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

  const sujo = JSON.stringify(lista) !== original;

  function adicionar() {
    const g = novo.trim();
    if (g.length < 3) return;
    if (lista.some((x) => normaliza(x) === normaliza(g))) {
      setMsg({ tipo: "erro", texto: "Esse gatilho já está na lista." });
      return;
    }
    setLista((v) => [...v, g]);
    setNovo("");
    setMsg(null);
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      // A rota exige atendente_nome/assinar; buscamos os atuais pra não
      // sobrescrever a seção Atendente sem querer. Se essa leitura falhar,
      // ABORTAMOS: mandar o default apagaria o nome do atendente.
      const atual = await configAtual();
      if (!atual) {
        setMsg({
          tipo: "erro",
          texto: "Não consegui ler a configuração atual. Não salvei, pra não apagar o resto — tente de novo.",
        });
        return;
      }
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "manual",
        body: JSON.stringify({ ...atual, gatilhos: lista }),
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
      setOriginal(JSON.stringify(lista));
      setMsg({ tipo: "ok", texto: "Salvo. Vale para os próximos contatos." });
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de rede. Tente de novo." });
    } finally {
      setSalvando(false);
    }
  }

  const testeNorm = normaliza(teste);
  const casou = teste.trim()
    ? lista.find((g) => testeNorm.includes(normaliza(g))) ?? null
    : null;

  return (
    <Panel
      title="Gatilhos do bot"
      subtitle="As frases que fazem o bot atender um contato novo"
      delay={140}
    >
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Quando alguém <strong className="font-semibold text-ink">novo</strong> escreve, o bot só
        responde se a mensagem contiver uma destas frases — normalmente o texto que o botão do
        anúncio já manda pronto. Quem já é lead do funil é atendido sempre, independente daqui.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
        Casa por <strong className="text-ink-muted">trecho</strong>, ignorando acento e
        maiúscula. Ou seja, <span className="font-mono text-[11.5px]">posso ter mais informações</span>{" "}
        já pega <span className="font-mono text-[11.5px]">“Olá! Posso ter mais informações sobre isso?”</span>.
        Frase mais curta pega mais gente — e também mais gente errada.
      </p>

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {carregando ? (
          <p className="text-[13px] text-ink-faint">Carregando…</p>
        ) : erroCarga ? (
          <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-[13px] leading-relaxed text-amber">
            Não consegui ler os gatilhos agora — isto <strong>não</strong> quer dizer que a lista
            esteja vazia. Recarregue a página antes de mexer, pra não sobrescrever o que está no ar.
          </p>
        ) : !lista.length ? (
          <p className="text-[13px] text-danger">
            Nenhum gatilho — o bot não vai atender ninguém novo.
          </p>
        ) : (
          lista.map((g, i) => (
            <div
              key={`${g}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{g}</span>
              <button
                type="button"
                onClick={() => setLista((v) => v.filter((_, j) => j !== i))}
                aria-label={`Remover gatilho ${g}`}
                className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-ink-faint transition hover:text-ink"
              >
                Remover
              </button>
            </div>
          ))
        )}
      </div>

      {/* Adicionar */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          maxLength={200}
          placeholder="Ex.: Posso ter mais informações sobre isso?"
          aria-label="Novo gatilho"
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-line bg-base/70 px-3 text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={erroCarga || novo.trim().length < 3}
          className="inline-flex h-10 items-center rounded-lg border border-line px-3.5 text-[13px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>

      {/* Testador — evita salvar um gatilho que não pega nada */}
      <div className="mt-4 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
        <label htmlFor="teste-gatilho" className="text-[12.5px] font-medium text-ink">
          Testar uma mensagem
        </label>
        <input
          id="teste-gatilho"
          value={teste}
          onChange={(e) => setTeste(e.target.value)}
          placeholder="Cole aqui a mensagem que o lead manda…"
          className="mt-1.5 h-10 w-full rounded-lg border border-line bg-base/70 px-3 text-[13.5px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60"
        />
        {teste.trim() && (
          <p className="mt-2 text-[12.5px]">
            {casou ? (
              <span className="text-brand-bright">
                ✓ O bot atende — casou com “{casou}”.
              </span>
            ) : (
              <span className="text-danger">
                ✕ O bot ignora esta mensagem (se for um contato novo).
              </span>
            )}
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || carregando || erroCarga || !sujo}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar gatilhos"}
        </button>
        {msg && (
          <span className={`text-[12.5px] ${msg.tipo === "ok" ? "" : "text-danger"}`}>
            {msg.texto}
          </span>
        )}
      </div>
    </Panel>
  );
}

/**
 * Lê a config atual pra o POST não zerar o nome do atendente.
 * Devolve `null` quando a leitura NÃO foi confirmada — quem chama tem de
 * abortar o salvamento. Antes daqui saía `{ atendente_nome: "" }` em caso de
 * falha, e esse default ia junto no POST, apagando a seção Atendente.
 */
async function configAtual(): Promise<{ atendente_nome: string; assinar: boolean } | null> {
  try {
    const res = await fetch("/api/config", { redirect: "manual", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      config?: { atendente_nome?: string | null; assinar?: boolean };
    };
    if (!data.ok) return null;
    return {
      atendente_nome: data.config?.atendente_nome ?? "",
      assinar: data.config?.assinar !== false,
    };
  } catch {
    return null;
  }
}
