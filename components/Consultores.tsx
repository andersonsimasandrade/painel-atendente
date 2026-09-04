"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { EmptyState } from "@/components/EmptyState";
import { formatPhone } from "@/lib/format";

/**
 * Seção "Consultores" dos Ajustes (só admin).
 *
 * Edita o que muda a cara do atendimento sem precisar de SQL: nome (que é a
 * assinatura que o lead lê e a voz que o bot usa pra se apresentar), telefone
 * de aviso, instância do WhatsApp e ativo/inativo.
 *
 * `slug` e `instância` aparecem, mas travados: o slug é chave dos leads e da
 * URL de agendamento, e a instância amarra com o WhatsApp pareado.
 */

type Consultor = {
  slug: string;
  nome: string;
  instancia_whatsapp: string;
  telefone_dono: string | null;
  ativo: boolean;
};

const INPUT =
  "mt-1.5 h-10 w-full rounded-lg border border-line bg-base/70 px-3 text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)] disabled:opacity-60";

function sessaoExpirada(res: Response): boolean {
  return res.type === "opaqueredirect" || res.status === 0 || res.status === 401;
}

export function Consultores({ onSessaoExpirou }: { onSessaoExpirou: () => void }) {
  const [lista, setLista] = useState<Consultor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/consultores", { redirect: "manual", cache: "no-store" });
        if (sessaoExpirada(res)) {
          onSessaoExpirou();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          consultores?: Consultor[];
          error?: string;
        };
        if (!vivo) return;
        if (!res.ok || !data.ok) {
          setErro(data.error ?? "Não foi possível carregar os consultores.");
          return;
        }
        setLista(data.consultores ?? []);
      } catch {
        if (vivo) setErro("Falha de rede ao carregar os consultores.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onSessaoExpirou]);

  return (
    <Panel
      title="Consultores"
      subtitle="Quem o bot diz que é, em cada número de WhatsApp"
      delay={110}
    >
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Cada número tem o seu consultor. O nome aqui é o que o lead lê na assinatura das
        mensagens do bot e como ele se apresenta. Vale para as mensagens{" "}
        <strong className="font-semibold text-ink">daqui pra frente</strong> — o que já foi
        enviado fica como está.
      </p>

      {carregando ? (
        <p className="mt-4 text-[13px] text-ink-faint">Carregando…</p>
      ) : erro ? (
        <p className="mt-4 text-[13px] text-danger">
          {erro}
        </p>
      ) : !lista.length ? (
        <EmptyState
          title="Nenhum consultor cadastrado"
          hint="Cadastre o primeiro consultor para começar a atender."
        />
      ) : (
        <div className="mt-4 space-y-3">
          {lista.map((c) => (
            <Ficha
              key={c.slug}
              inicial={c}
              podeDesativar={lista.filter((v) => v.ativo).length > 1 || !c.ativo}
              onSessaoExpirou={onSessaoExpirou}
            />
          ))}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
        <p className="text-[12.5px] font-medium text-ink">Precisa de um consultor novo?</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
          Não dá pra criar por aqui de propósito: além do cadastro, um consultor novo precisa
          de instância na Evolution, QR pareado, login no painel e a campanha do Meta apontada
          pro número. Um botão que fizesse só o cadastro criaria um consultor mudo. Me chama
          que eu faço o conjunto.
        </p>
      </div>
    </Panel>
  );
}

function Ficha({
  inicial,
  podeDesativar,
  onSessaoExpirou,
}: {
  inicial: Consultor;
  podeDesativar: boolean;
  onSessaoExpirou: () => void;
}) {
  const [nome, setNome] = useState(inicial.nome ?? "");
  const [telefone, setTelefone] = useState(inicial.telefone_dono ?? "");
  const [instancia, setInstancia] = useState(inicial.instancia_whatsapp ?? "");
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const sujo =
    nome.trim() !== (inicial.nome ?? "") ||
    telefone.replace(/\D/g, "") !== (inicial.telefone_dono ?? "") ||
    instancia.trim() !== (inicial.instancia_whatsapp ?? "") ||
    ativo !== inicial.ativo;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/consultores/${encodeURIComponent(inicial.slug)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        redirect: "manual",
        body: JSON.stringify({
          nome: nome.trim(),
          telefone_dono: telefone.replace(/\D/g, ""),
          instancia_whatsapp: instancia.trim(),
          ativo,
        }),
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
      setMsg({ tipo: "ok", texto: "Salvo. Vale para as próximas mensagens." });
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de rede. Tente de novo." });
    } finally {
      setSalvando(false);
    }
  }

  const nomeLimpo = nome.trim();

  return (
    <form
      onSubmit={salvar}
      className={`rounded-xl border px-4 py-4 transition ${
        inicial.ativo ? "border-line bg-white/[0.02]" : "border-line/60 bg-white/[0.01] opacity-70"
      }`}
    >
      {/* Cabeçalho: identidade travada */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] font-semibold text-ink">
          {inicial.nome || inicial.slug}
        </span>
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-ink-faint">
          {inicial.slug}
        </span>
        <span className="text-[11.5px] text-ink-faint">
          instância <span className="font-mono text-ink-muted">{inicial.instancia_whatsapp}</span>
        </span>
        {/* Pendente ≠ gravado. O botão abaixo só mexe no estado local; quem
            persiste é o Salvar. O cartão mostra o que está GRAVADO e o selo
            avisa o que muda quando salvar. */}
        {ativo !== inicial.ativo ? (
          <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[11px] font-medium text-amber">
            {ativo ? "reativa ao salvar" : "desativa ao salvar"}
          </span>
        ) : (
          !ativo && (
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-ink-faint">
              inativo
            </span>
          )
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Nome */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor={`nome-${inicial.slug}`} className="text-[12.5px] font-medium text-ink">
              Nome que o lead vê
            </label>
            <span className="tnum text-[11px] text-ink-faint">{nome.length}/40</span>
          </div>
          <input
            id={`nome-${inicial.slug}`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            autoComplete="off"
            className={INPUT}
          />
        </div>

        {/* Telefone de aviso */}
        <div>
          <label htmlFor={`tel-${inicial.slug}`} className="text-[12.5px] font-medium text-ink">
            WhatsApp pessoal (avisos)
          </label>
          <input
            id={`tel-${inicial.slug}`}
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="numeric"
            placeholder="5511999998888"
            autoComplete="off"
            className={`${INPUT} font-mono`}
          />
          <p className="mt-1 text-[11px] text-ink-faint">
            {telefone.replace(/\D/g, "").length >= 10
              ? `Recebe "quero falar com humano" em ${formatPhone(telefone.replace(/\D/g, ""))}`
              : "Recebe o aviso quando o lead pede pra falar com uma pessoa."}
          </p>
        </div>

        {/* Instância do WhatsApp */}
        <div className="sm:col-span-2">
          <label htmlFor={`inst-${inicial.slug}`} className="text-[12.5px] font-medium text-ink">
            Instância do WhatsApp
          </label>
          <input
            id={`inst-${inicial.slug}`}
            value={instancia}
            onChange={(e) => setInstancia(e.target.value)}
            placeholder="o mesmo nome que está na Evolution API"
            autoComplete="off"
            spellCheck={false}
            className={`${INPUT} font-mono`}
          />
          <p className="mt-1 text-[11px] text-ink-faint">
            É por ela que as mensagens saem. Precisa ser idêntica ao nome da instância na
            Evolution API e à variável <span className="font-mono">EVOLUTION_INSTANCE</span>. Se
            estiver errada, o painel não envia nada.
          </p>
        </div>
      </div>

      {/* Prévia da assinatura */}
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wider text-ink-faint">Prévia</p>
        <div className="mt-1.5 flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink ring-1 ring-inset ring-brand/20">
            {nomeLimpo && <span className="font-semibold text-brand-bright">{nomeLimpo}: </span>}
            Que bom que chegou até aqui!
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={salvando || !sujo}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          {salvando ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/40 border-t-[#04140d]" />
          ) : null}
          Salvar
        </button>

        <button
          type="button"
          onClick={() => {
            if (
              ativo &&
              !window.confirm(
                `Marcar ${inicial.nome} para desativar?\n\n` +
                  "Isto NÃO vale ainda — só depois que você apertar Salvar neste cartão.\n\n" +
                  "Uma vez salvo:\n" +
                  "• Ele perde o acesso ao painel e não consegue mais entrar\n" +
                  "• Some dos filtros de consultor e da tela de Conexão\n" +
                  `• A página /agendar/${inicial.slug} para de abrir\n` +
                  "• Os leads dele NÃO mudam de dono — continuam no nome dele",
              )
            ) {
              return;
            }
            setAtivo((v) => !v);
          }}
          disabled={salvando || (ativo && !podeDesativar)}
          title={
            ativo && !podeDesativar
              ? "É o último consultor ativo — o bot ficaria sem número."
              : undefined
          }
          className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ativo ? "Desativar" : "Reativar"}
        </button>

        {msg && (
          <span className={`text-[12.5px] ${msg.tipo === "ok" ? "" : "text-danger"}`}>
            {msg.texto}
          </span>
        )}
      </div>
    </form>
  );
}
