"use client";

import { useEffect } from "react";
import { chaveParaBytes, preferencia } from "@/lib/push-cliente";

/**
 * Ao abrir o painel, religa sozinho os avisos deste aparelho quando a assinatura caiu (o serviço de avisos do navegador
 * troca ou invalida o endereço de tempos em tempos, e aí o aviso parava sem ninguém perceber). Só age em aparelho que já
 * tinha ativado os avisos, com a permissão concedida, e nunca em quem desligou de propósito. Não mostra nada na tela.
 */
export function ReligaAvisos() {
  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
        if (Notification.permission !== "granted" || preferencia() === "desligado") return;
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (!reg) return; // nunca ativou neste aparelho
        let sub = await reg.pushManager.getSubscription();
        const url = sub ? `/api/push?endpoint=${encodeURIComponent(sub.endpoint)}` : "/api/push";
        const r = await fetch(url, { cache: "no-store", redirect: "manual" });
        if (!r.ok) return; // sem login (ou tela pública): nada a fazer
        const d = (await r.json()) as { ok?: boolean; chave?: string; conhecido?: boolean };
        if (!d.ok || !d.chave || (sub && d.conhecido)) return;
        if (sub) await sub.unsubscribe(); // endereço velho, que o servidor já descartou
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(d.chave) as BufferSource });
        await fetch("/api/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          redirect: "manual",
          body: JSON.stringify({ acao: "assinar", subscription: sub.toJSON(), aparelho: navigator.userAgent }),
        });
      } catch {
        /* tentamos de novo na próxima abertura */
      }
    })();
  }, []);
  return null;
}
