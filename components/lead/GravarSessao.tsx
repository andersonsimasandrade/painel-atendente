"use client";

import { useEffect, useRef, useState } from "react";
import type { RascunhoEvolucao } from "@/lib/prontuario-ia";

type Estado = "parado" | "gravando" | "pausado" | "enviando" | "erro";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Grava a conversa da sessão pelo microfone (funciona no celular, sem instalar nada), transcreve e entrega um RASCUNHO
 * da evolução para o Anderson revisar. O áudio é descartado depois da transcrição; só entra no prontuário o que ele salvar.
 */
export function GravarSessao({
  telefone,
  onRascunho,
}: {
  telefone: string;
  onRascunho: (r: RascunhoEvolucao | null, transcricao: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [estado, setEstado] = useState<Estado>("parado");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const mimeRef = useRef("audio/webm");
  const blobRef = useRef<Blob | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const [baixar, setBaixar] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (relogio.current) clearInterval(relogio.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void wake.current?.release().catch(() => undefined);
      if (baixar) URL.revokeObjectURL(baixar);
    };
  }, [baixar]);

  async function manterTelaLigada() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wake.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      /* sem wake lock: o aviso na tela cobre */
    }
  }

  async function iniciar() {
    setErro(null);
    if (!autorizado) {
      setErro("Marque que o paciente autorizou a gravação.");
      return;
    }
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não grava áudio. Use o Chrome (Android) ou o Safari atualizado (iPhone).");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const tipos = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
      const mime = tipos.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
      mimeRef.current = (rec.mimeType || mime || "audio/webm").split(";")[0];
      pedacos.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) pedacos.current.push(e.data);
      };
      rec.start(5000);
      recRef.current = rec;
      setSegundos(0);
      relogio.current = setInterval(() => setSegundos((s) => s + 1), 1000);
      await manterTelaLigada();
      setEstado("gravando");
    } catch {
      setErro("Não consegui usar o microfone. Permita o acesso ao microfone no navegador e tente de novo.");
    }
  }

  function pausar() {
    recRef.current?.pause();
    if (relogio.current) clearInterval(relogio.current);
    setEstado("pausado");
  }

  function continuar() {
    recRef.current?.resume();
    relogio.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    setEstado("gravando");
  }

  async function parar() {
    const rec = recRef.current;
    if (!rec) return;
    if (relogio.current) clearInterval(relogio.current);
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void wake.current?.release().catch(() => undefined);
    const blob = new Blob(pedacos.current, { type: mimeRef.current });
    blobRef.current = blob;
    setBaixar((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return URL.createObjectURL(blob);
    });
    await enviar();
  }

  async function enviar() {
    const blob = blobRef.current;
    if (!blob) return;
    setEstado("enviando");
    setErro(null);
    try {
      const f = new FormData();
      f.set("audio", blob, "sessao");
      f.set("autorizado", "1");
      const r = await fetch(`/api/paciente/${encodeURIComponent(telefone)}/sessao-audio`, { method: "POST", body: f });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; transcricao?: string; rascunho?: RascunhoEvolucao | null };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui transcrever a gravação.");
        setEstado("erro");
        return;
      }
      blobRef.current = null;
      setEstado("parado");
      setAberto(false);
      onRascunho(d.rascunho ?? null, d.transcricao ?? "");
    } catch {
      setErro("Falha de rede ao enviar a gravação. Ela continua aqui: tente de novo.");
      setEstado("erro");
    }
  }

  const botao = "inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";
  const prim = "inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:opacity-50";

  if (!aberto) {
    return (
      <button type="button" className={botao} onClick={() => setAberto(true)}>
        🎙 Gravar a sessão
      </button>
    );
  }

  return (
    <div className="flex w-full basis-full flex-col gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
      <p className="text-[13px] font-semibold text-ink">Gravar a sessão</p>

      {estado === "parado" || estado === "erro" ? (
        <>
          <label className="flex items-start gap-2 text-[12.5px] text-ink-muted">
            <input type="checkbox" checked={autorizado} onChange={(e) => setAutorizado(e.target.checked)} className="mt-0.5" />
            <span>
              O paciente foi informado e <b>autorizou a gravação</b> do áudio para o registro do prontuário. O áudio é transformado em texto e descartado; só entra no
              prontuário o que você revisar e salvar.
            </span>
          </label>
          {estado === "erro" && blobRef.current ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={prim} onClick={() => void enviar()}>
                Tentar enviar de novo
              </button>
              {baixar && (
                <a className={botao} href={baixar} download="sessao-audio">
                  Baixar o áudio
                </a>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" className={prim} onClick={() => void iniciar()}>
                ● Iniciar gravação
              </button>
              <button type="button" className={botao} onClick={() => setAberto(false)}>
                Fechar
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 text-[15px] font-semibold ${estado === "gravando" ? "text-[#E05C5C]" : "text-ink-muted"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${estado === "gravando" ? "animate-pulse bg-[#E05C5C]" : "bg-ink-faint"}`} />
              {estado === "enviando" ? "Transcrevendo… pode levar 1 a 2 minutos" : estado === "pausado" ? `Pausado ${mmss(segundos)}` : `Gravando ${mmss(segundos)}`}
            </span>
          </div>
          {(estado === "gravando" || estado === "pausado") && (
            <>
              <p className="text-[11.5px] text-ink-faint">Deixe a tela ligada e o navegador aberto durante a gravação. Coloque o celular perto de vocês.</p>
              <div className="flex flex-wrap gap-2">
                {estado === "gravando" ? (
                  <button type="button" className={botao} onClick={pausar}>
                    ❚❚ Pausar
                  </button>
                ) : (
                  <button type="button" className={botao} onClick={continuar}>
                    ▶ Continuar
                  </button>
                )}
                <button type="button" className={prim} onClick={() => void parar()}>
                  ■ Parar e gerar rascunho
                </button>
              </div>
            </>
          )}
        </>
      )}

      {erro && <p className="text-[12.5px] text-amber">{erro}</p>}
    </div>
  );
}
