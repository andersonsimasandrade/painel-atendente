"use client";

import { useEffect, useRef, useState } from "react";

const botaoCls = "inline-flex items-center rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";
const campoCls = "w-full rounded-lg border border-line bg-base/70 px-2.5 py-2 text-[13px] text-ink outline-none focus:border-brand/60";

/**
 * Caixa de texto com botão de ditado: toque em 🎙, fale, toque em ■ e o texto é transcrito e entra no fim do campo.
 * Funciona no celular e no computador. (O microfone do próprio teclado do celular também funciona em qualquer campo.)
 */
export function CampoDitado({
  valor,
  onChange,
  minAltura = 80,
  placeholder,
  contexto = "geral",
}: {
  valor: string;
  onChange: (v: string) => void;
  minAltura?: number;
  placeholder?: string;
  /** Tipo do campo (relato, achados, conduta, plano, observacoes, devolutiva_*...): orienta o ajuste por IA. */
  contexto?: string;
}) {
  const [estado, setEstado] = useState<"parado" | "gravando" | "enviando">("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [ajustando, setAjustando] = useState(false);
  const [original, setOriginal] = useState<string | null>(null); // texto de antes do ajuste (para voltar)
  const [ajustado, setAjustado] = useState<string | null>(null); // texto que a IA devolveu (o botão de voltar some se você editar depois)
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const mime = useRef("audio/webm");
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const [suportado, setSuportado] = useState(false);
  useEffect(() => {
    setSuportado(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  useEffect(
    () => () => {
      if (relogio.current) clearInterval(relogio.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function ajustar() {
    setErro(null);
    setAjustando(true);
    try {
      const antes = valorRef.current;
      const r = await fetch("/api/ajustar-texto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: antes, contexto }) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; texto?: string; error?: string };
      if (!r.ok || !d.texto) {
        setErro(d.error ?? "Não consegui ajustar agora.");
        return;
      }
      setOriginal(antes);
      setAjustado(d.texto);
      onChange(d.texto);
    } catch {
      setErro("Falha de rede ao ajustar o texto.");
    } finally {
      setAjustando(false);
    }
  }

  async function iniciar() {
    setErro(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.current = s;
      const tipos = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
      const m = tipos.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const r = new MediaRecorder(s, { ...(m ? { mimeType: m } : {}), audioBitsPerSecond: 32000 });
      mime.current = (r.mimeType || m || "audio/webm").split(";")[0];
      pedacos.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size > 0) pedacos.current.push(e.data);
      };
      r.start(3000);
      rec.current = r;
      setSegundos(0);
      relogio.current = setInterval(() => setSegundos((x) => x + 1), 1000);
      setEstado("gravando");
    } catch {
      setErro("Não consegui usar o microfone. Permita o acesso no navegador.");
    }
  }

  async function parar() {
    const r = rec.current;
    if (!r) return;
    if (relogio.current) clearInterval(relogio.current);
    await new Promise<void>((resolve) => {
      r.onstop = () => resolve();
      r.stop();
    });
    stream.current?.getTracks().forEach((t) => t.stop());
    setEstado("enviando");
    try {
      const f = new FormData();
      f.set("audio", new Blob(pedacos.current, { type: mime.current }), "ditado");
      const res = await fetch("/api/ditado", { method: "POST", body: f });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; texto?: string; error?: string };
      if (!res.ok || !d.texto) {
        setErro(d.error ?? "Não consegui transcrever. Tente de novo.");
      } else {
        const atual = valorRef.current;
        onChange(atual ? `${atual}${/\s$/.test(atual) ? "" : " "}${d.texto}` : d.texto);
      }
    } catch {
      setErro("Falha de rede ao enviar o ditado.");
    } finally {
      setEstado("parado");
    }
  }

  return (
    <div>
      <textarea className={campoCls} style={{ minHeight: minAltura }} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {suportado && estado === "parado" && (
          <button type="button" onClick={() => void iniciar()} className={botaoCls}>
            🎙 Ditar
          </button>
        )}
        {suportado && estado === "gravando" && (
          <button type="button" onClick={() => void parar()} className="inline-flex items-center gap-2 rounded-lg bg-[#E05C5C] px-2.5 py-1 text-[12px] font-semibold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />■ Parar ({String(Math.floor(segundos / 60)).padStart(2, "0")}:{String(segundos % 60).padStart(2, "0")})
          </button>
        )}
        {estado === "enviando" && <span className="text-[12px] text-ink-muted">Transcrevendo…</span>}
        {estado === "parado" && valor.trim().length >= 15 && (
          <button type="button" onClick={() => void ajustar()} disabled={ajustando} className={botaoCls} title="A IA organiza o texto: clareza, gramática e ortografia, sem acrescentar informação">
            {ajustando ? "Ajustando…" : "✨ Ajustar com IA"}
          </button>
        )}
        {original !== null && ajustado === valor && !ajustando && (
          <>
            <button
              type="button"
              onClick={() => {
                onChange(original);
                setOriginal(null);
              }}
              className={botaoCls}
            >
              ↩ Voltar ao texto original
            </button>
            <span className="text-[11.5px] text-ink-faint">Ajustado pela IA: leia e corrija o que for preciso.</span>
          </>
        )}
        {erro && <span className="text-[12px] text-amber">{erro}</span>}
      </div>
    </div>
  );
}
