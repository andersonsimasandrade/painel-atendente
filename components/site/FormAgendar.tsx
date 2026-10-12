"use client";

import { useState } from "react";
import { DIAS, PERIODOS } from "@/lib/site";
import { lerOrigem } from "@/components/site/CapturaOrigem";

type Cons = "capoeiras" | "centro" | "qualquer";

const OPCOES_CONS: { id: Cons; titulo: string; linha: string }[] = [
  { id: "capoeiras", titulo: "Capoeiras", linha: "Rua Joaquim Carneiro, 207" },
  { id: "centro", titulo: "Centro", linha: "R. Altamiro Guimarães, 190, Sala 06" },
  { id: "qualquer", titulo: "Tanto faz", linha: "O Anderson vê a melhor opção" },
];

function Chip({
  ativo,
  onClick,
  children,
  detalhe,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  detalhe?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-[15px] transition ${
        ativo
          ? "border-[#2f9e5e] bg-[#e7f4ec] font-semibold text-[#14603d]"
          : "border-[#ddd6c9] bg-white text-[#3a4a41] hover:border-[#2f9e5e]/60"
      }`}
    >
      <span className="block">{children}</span>
      {detalhe ? <span className="block text-[12.5px] font-normal text-[#6b7a71]">{detalhe}</span> : null}
    </button>
  );
}

export function FormAgendar() {
  const [cons, setCons] = useState<Cons>("qualquer");
  const [dias, setDias] = useState<string[]>([]);
  const [periodos, setPeriodos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [hp, setHp] = useState("");

  const alterna = (lista: string[], set: (v: string[]) => void, id: string) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  async function enviar(vazio: boolean) {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/site/pedido", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consultorio: vazio ? "qualquer" : cons,
          dias: vazio ? [] : dias,
          periodos: vazio ? [] : periodos,
          origem: lerOrigem() ?? {},
          site_url: hp,
        }),
      });
      const j = (await r.json()) as { ok: boolean; url?: string; error?: string };
      if (!j.ok || !j.url) {
        setErro(j.error ?? "Não foi possível continuar. Tente de novo.");
        setEnviando(false);
        return;
      }
      setLink(j.url);
      window.location.href = j.url;
    } catch {
      setErro("Sem conexão no momento. Tente de novo.");
    }
    setEnviando(false);
  }

  if (link) {
    return (
      <div className="rounded-2xl border border-[#cfe6d6] bg-[#eef8f1] p-6 text-center">
        <p className="font-display text-[20px] font-semibold text-[#14603d]">Tudo certo!</p>
        <p className="mt-2 text-[15px] text-[#3a4a41]">
          Se o WhatsApp não abriu sozinho, toque no botão abaixo e envie a mensagem que já está pronta.
        </p>
        <a
          href={link}
          className="mt-5 inline-flex rounded-2xl bg-[#2f9e5e] px-7 py-4 text-[16px] font-semibold text-white hover:bg-[#278a50]"
        >
          Abrir o WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar(false);
      }}
      className="space-y-8"
    >
      <fieldset>
        <legend className="text-[17px] font-semibold text-[#16351f]">Qual consultório fica melhor?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {OPCOES_CONS.map((o) => (
            <Chip key={o.id} ativo={cons === o.id} onClick={() => setCons(o.id)} detalhe={o.linha}>
              {o.titulo}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[17px] font-semibold text-[#16351f]">Quais dias você pode?</legend>
        <p className="mt-1 text-[13.5px] text-[#6b7a71]">Pode marcar mais de um. Atendemos de segunda a sexta.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {DIAS.map((d) => (
            <Chip key={d.id} ativo={dias.includes(d.id)} onClick={() => alterna(dias, setDias, d.id)}>
              {d.nome}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[17px] font-semibold text-[#16351f]">Em que período?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PERIODOS.map((p) => (
            <Chip
              key={p.id}
              ativo={periodos.includes(p.id)}
              onClick={() => alterna(periodos, setPeriodos, p.id)}
              detalhe={p.detalhe}
            >
              {p.nome}
            </Chip>
          ))}
        </div>
      </fieldset>

      {/* Armadilha para robôs: invisível para pessoas. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Não preencha
          <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
      </div>

      {erro ? (
        <p role="alert" className="rounded-xl bg-[#fdecea] px-4 py-3 text-[14px] text-[#9b2c24]">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center justify-center rounded-2xl bg-[#2f9e5e] px-7 py-4 text-[17px] font-semibold text-white shadow-md transition hover:bg-[#278a50] disabled:opacity-60"
        >
          {enviando ? "Abrindo o WhatsApp…" : "Continuar no WhatsApp"}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => void enviar(true)}
          className="text-[14px] text-[#4b5b51] underline underline-offset-2 hover:text-[#16351f]"
        >
          Prefiro só abrir a conversa
        </button>
      </div>

      <p className="text-[12.5px] leading-relaxed text-[#6b7a71]">
        Ao continuar, você abre uma conversa no WhatsApp com a nossa equipe. Não pedimos nenhum dado de saúde
        neste site. Veja como tratamos os seus dados na página de{" "}
        <a href="/privacidade" className="underline">
          privacidade
        </a>
        .
      </p>
    </form>
  );
}
