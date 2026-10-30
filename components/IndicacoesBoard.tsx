"use client";

import { useState } from "react";
import type { Indicacao, LinhaParceiro } from "@/lib/indicacoes";

type Item = Indicacao & { parceiro_nome: string; mensagem: string };

const ROTULO: Record<string, string> = {
  aguardando: "Aguardando",
  pronta: "Pronta",
  contatada: "Contatada",
  respondeu: "Escreveu sozinho(a)",
  ja_contato: "Já era contato",
  descartada: "Descartada",
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function formatarTel(t: string): string {
  const d = t.replace(/\D/g, "");
  return d.startsWith("55") && d.length >= 12 ? `(${d.slice(2, 4)}) ${d.slice(4, d.length - 4)}-${d.slice(-4)}` : t;
}

function Cartao({ i, horasEsfriar }: { i: Item; horasEsfriar: number }) {
  const [texto, setTexto] = useState(i.mensagem);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pronta = i.status === "pronta";
  const horas = (Date.now() - new Date(i.liberar_em).getTime()) / 3600000;
  const esfriando = pronta && horas > horasEsfriar;

  async function agir(acao: "enviar" | "descartar") {
    if (acao === "descartar" && !window.confirm("Descartar esta indicação? Nenhuma mensagem será enviada.")) return;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/indicacoes/${i.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, texto }) });
      const d = (await r.json()) as { ok: boolean; error?: string; erro?: string };
      if (!d.ok) return setMsg(d.error ?? d.erro ?? "Não consegui.");
      window.location.reload();
    } catch {
      setMsg("Falha de conexão.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={`rounded-2xl border p-4 ${esfriando ? "border-amber-400/60" : pronta ? "border-brand/50" : "border-line"} bg-white/[0.02]`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[14.5px] font-semibold text-ink">{i.paciente_nome}</p>
          <p className="text-[12.5px] text-ink-muted">
            {formatarTel(i.paciente_telefone)} · indicado por <b>{i.parceiro_nome}</b>
            {i.quem_indicou ? ` (${i.quem_indicou})` : ""}
          </p>
          {i.observacao && <p className="mt-1 text-[12.5px] text-ink-muted">Recado: {i.observacao}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${esfriando ? "bg-amber-400/20 text-amber-300" : pronta ? "bg-brand/20 text-brand" : "bg-white/5 text-ink-muted"}`}>
          {esfriando ? `Esfriando (${Math.floor(horas)}h)` : pronta ? "Pronta" : `Libera ${quando(i.liberar_em)}`}
        </span>
      </div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} className="mt-3 w-full rounded-xl border border-line bg-base/70 p-3 text-[13.5px] leading-relaxed text-ink outline-none focus:border-brand/60" />
      {msg && <p className="mt-2 text-[12.5px] text-red-300">{msg}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={ocupado || !texto.trim()} onClick={() => agir("enviar")} className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50">
          {ocupado ? "Enviando…" : pronta ? "Enviar mensagem (1 clique)" : "Enviar agora"}
        </button>
        <button type="button" disabled={ocupado} onClick={() => agir("descartar")} className="text-[12.5px] text-ink-faint transition hover:text-ink-muted">
          descartar
        </button>
      </div>
    </div>
  );
}

function CopiarLink({ rotulo, url }: { rotulo: string; url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          window.prompt("Copie o link:", url);
        }
      }}
      className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-muted transition hover:text-ink"
      title={url}
    >
      {ok ? "Copiado ✓" : rotulo}
    </button>
  );
}

export function IndicacoesBoard({
  siteUrl,
  latenciaHoras,
  limiteDia,
  horasEsfriar,
  indicacoes,
  relatorio,
}: {
  siteUrl: string;
  latenciaHoras: number;
  limiteDia: number;
  horasEsfriar: number;
  indicacoes: Item[];
  relatorio: LinhaParceiro[];
}) {
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const abertas = indicacoes.filter((i) => i.status === "aguardando" || i.status === "pronta");
  const historico = indicacoes.filter((i) => i.status !== "aguardando" && i.status !== "pronta");

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const r = await fetch("/api/parceiros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: novo }) });
    const d = (await r.json()) as { ok: boolean; error?: string };
    if (!d.ok) return setErro(d.error ?? "Não consegui cadastrar.");
    window.location.reload();
  }
  async function alternar(id: number, ativo: boolean) {
    await fetch("/api/parceiros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ativo }) });
    window.location.reload();
  }

  const th = "px-3 py-2 text-left text-[11.5px] font-medium text-ink-muted";
  const td = "px-3 py-2.5 text-[13px] text-ink";
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[15px] font-semibold text-ink">Para contatar ({abertas.length})</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          Cada indicação espera {latenciaHoras} h antes de ficar pronta (para a pessoa ter tempo de procurar por conta própria). Você revisa o texto e envia com um clique, entre 8h e 20h, até {limiteDia} por dia.
          Se a pessoa escrever antes, a indicação sai da fila sozinha.
        </p>
        <div className="mt-3 space-y-3">
          {abertas.length === 0 && <p className="rounded-2xl border border-line p-4 text-[13px] text-ink-muted">Nenhuma indicação esperando contato.</p>}
          {abertas.map((i) => (
            <Cartao key={i.id} i={i} horasEsfriar={horasEsfriar} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink">Parceiros e resultados</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          Passe ao parceiro o <b>link do WhatsApp</b> (o paciente chama você) e o <b>link do formulário</b> (o parceiro indica nome e telefone).
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Parceiro</th>
                <th className={th}>Indicações (formulário)</th>
                <th className={th}>Leads</th>
                <th className={th}>Consultas marcadas</th>
                <th className={th}>Compareceram</th>
                <th className={th}>Links</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.map((l) => (
                <tr key={l.parceiro.id} className="border-b border-line/60 last:border-0">
                  <td className={td}>
                    <b>{l.parceiro.nome}</b>
                    {!l.parceiro.ativo && <span className="ml-1.5 text-[11px] text-ink-faint">(desligado)</span>}
                  </td>
                  <td className={td}>
                    {l.indicacoes}
                    {l.aguardando ? <span className="text-ink-faint"> · {l.aguardando} na fila</span> : null}
                  </td>
                  <td className={td}>{l.leads}</td>
                  <td className={td}>{l.agendados}</td>
                  <td className={td}>{l.compareceram}</td>
                  <td className={`${td} space-x-1.5 whitespace-nowrap`}>
                    <CopiarLink rotulo="Link WhatsApp" url={`${siteUrl}/p/${l.parceiro.codigo}`} />
                    <CopiarLink rotulo="Link formulário" url={`${siteUrl}/indicar/${l.parceiro.codigo}`} />
                    <button type="button" onClick={() => alternar(l.parceiro.id, !l.parceiro.ativo)} className="text-[12px] text-ink-faint hover:text-ink-muted">
                      {l.parceiro.ativo ? "desligar" : "ligar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={cadastrar} className="mt-3 flex flex-wrap items-center gap-2">
          <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo parceiro (ex.: Clínica Bem-Estar)" className="min-w-[240px] flex-1 rounded-xl border border-line bg-base/70 px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand/60" />
          <button type="submit" disabled={novo.trim().length < 2} className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-[#04140d] disabled:opacity-50">
            Cadastrar parceiro
          </button>
          {erro && <span className="text-[12.5px] text-red-300">{erro}</span>}
        </form>
      </section>

      {historico.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold text-ink">Histórico</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Paciente</th>
                  <th className={th}>Parceiro</th>
                  <th className={th}>Situação</th>
                  <th className={th}>Quando</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((i) => (
                  <tr key={i.id} className="border-b border-line/60 last:border-0">
                    <td className={td}>{i.paciente_nome}</td>
                    <td className={td}>{i.parceiro_nome}</td>
                    <td className={td}>{ROTULO[i.status] ?? i.status}</td>
                    <td className={td}>{quando(i.contatada_em ?? i.respondeu_em ?? i.criado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
