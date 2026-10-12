"use client";

import { useEffect } from "react";

// Guarda, NO NAVEGADOR do visitante, de onde ele veio (clique do Google, da
// Meta, busca orgânica...). Só é enviado ao servidor quando a pessoa pede o
// agendamento — não há rastreador de terceiros nem pixel de remarketing.
// Validade de 30 dias; um clique de anúncio novo substitui o anterior.

export const CHAVE_ORIGEM = "site-origem-v1";
const TRINTA_DIAS = 30 * 24 * 3600 * 1000;

export interface OrigemSalva {
  gclid?: string;
  fbclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing?: string;
  t: number;
}

export function lerOrigem(): OrigemSalva | null {
  try {
    const raw = localStorage.getItem(CHAVE_ORIGEM);
    if (!raw) return null;
    const o = JSON.parse(raw) as OrigemSalva;
    if (!o || typeof o.t !== "number" || Date.now() - o.t > TRINTA_DIAS) return null;
    return o;
  } catch {
    return null;
  }
}

export function CapturaOrigem() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const pega = (k: string) => (p.get(k) ?? "").slice(0, 200);
      const novo: OrigemSalva = {
        gclid: pega("gclid") || undefined,
        fbclid: pega("fbclid") || undefined,
        utm_source: pega("utm_source") || undefined,
        utm_medium: pega("utm_medium") || undefined,
        utm_campaign: pega("utm_campaign") || undefined,
        utm_term: pega("utm_term") || undefined,
        utm_content: pega("utm_content") || undefined,
        t: Date.now(),
      };
      const temSinal = !!(novo.gclid || novo.fbclid || novo.utm_source);
      const atual = lerOrigem();
      if (temSinal) {
        novo.referrer = (document.referrer || "").slice(0, 300) || undefined;
        novo.landing = window.location.pathname;
        localStorage.setItem(CHAVE_ORIGEM, JSON.stringify(novo));
      } else if (!atual) {
        // Sem clique pago: guarda só a referência (busca orgânica, Instagram, direto).
        novo.referrer = (document.referrer || "").slice(0, 300) || undefined;
        novo.landing = window.location.pathname;
        localStorage.setItem(CHAVE_ORIGEM, JSON.stringify(novo));
      }
    } catch {
      /* navegador sem localStorage: segue sem origem */
    }
  }, []);
  return null;
}
