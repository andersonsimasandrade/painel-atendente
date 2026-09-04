"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook de gravação de nota de voz para o composer do inbox (estilo WhatsApp).
 * Sem dependências — usa getUserMedia + MediaRecorder do próprio navegador.
 *
 *  • start()  → pede permissão do microfone e começa a gravar (timer em segundos).
 *  • stop()   → encerra e resolve com o Blob gravado (ou null se nada útil).
 *  • cancel() → descarta a gravação e libera o microfone.
 *  • error    → mensagem amigável (permissão negada / sem suporte).
 *
 * Sempre para as tracks do stream (libera o microfone) em cancel/stop/unmount.
 */

export type AudioRecorder = {
  recording: boolean;
  seconds: number;
  error: string | null;
  clearError: () => void;
  start: () => Promise<boolean>;
  stop: () => Promise<Blob | null>;
  cancel: () => void;
};

export function useAudioRecorder(): AudioRecorder {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canceledRef = useRef(false);

  // Libera o microfone (para as tracks) e o timer.
  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Gravação de áudio não é suportada neste navegador.");
      return false;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Permissão de microfone negada — autorize no navegador para gravar."
          : "Não foi possível acessar o microfone.",
      );
      return false;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    canceledRef.current = false;

    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream);
    } catch {
      cleanup();
      setError("Não foi possível iniciar a gravação.");
      return false;
    }

    recorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return true;
  }, [cleanup]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        cleanup();
        setRecording(false);
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const parts = chunksRef.current;
        chunksRef.current = [];
        recorderRef.current = null;
        cleanup();
        setRecording(false);
        if (canceledRef.current) {
          resolve(null);
          return;
        }
        const blob = new Blob(parts, { type });
        resolve(blob.size > 0 ? blob : null);
      };
      try {
        rec.stop();
      } catch {
        cleanup();
        setRecording(false);
        resolve(null);
      }
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    canceledRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        // ignora — o cleanup abaixo libera o microfone de qualquer forma
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    cleanup();
    setRecording(false);
    setSeconds(0);
  }, [cleanup]);

  // Segurança: libera o microfone se o componente desmontar gravando.
  useEffect(() => {
    return () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // ignora
        }
      }
      cleanup();
    };
  }, [cleanup]);

  return { recording, seconds, error, clearError, start, stop, cancel };
}
