"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { lerOrigem } from "@/components/site/CapturaOrigem";

// Medição PRÓPRIA do site: manda ao nosso servidor (nunca a terceiros) o que o
// visitante fez — visita, rolagem, tempo e cliques em WhatsApp/telefone/mapa/
// agendar — junto com a origem do clique (Google, Meta, UTM). O visitante é um
// código aleatório guardado no próprio navegador: sem nome, sem IP, sem dado de
// saúde. Quem ativa "Não rastrear" no navegador não envia nada.

const CHAVE_VISITANTE = "site-visitante-v1";
const CHAVE_SESSAO = "site-sessao-v1";

function sorteio(): string {
  try {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("");
  } catch {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
}

function lerOuCriar(storage: Storage | null, chave: string): string {
  try {
    if (!storage) return sorteio();
    const atual = storage.getItem(chave);
    if (atual && /^[A-Za-z0-9_-]{8,64}$/.test(atual)) return atual;
    const novo = sorteio();
    storage.setItem(chave, novo);
    return novo;
  } catch {
    return sorteio();
  }
}

/** Código do visitante neste navegador (usado também no pedido de agendamento). */
export function idVisitante(): string {
  try {
    return lerOuCriar(window.localStorage, CHAVE_VISITANTE);
  } catch {
    return sorteio();
  }
}

function enviar(tipo: string, extra: Record<string, unknown> = {}) {
  try {
    const o = lerOrigem();
    const corpo = JSON.stringify({
      v: idVisitante(),
      s: lerOuCriar(window.sessionStorage, CHAVE_SESSAO),
      tipo,
      caminho: window.location.pathname,
      origem: o ?? {},
      ...extra,
    });
    const blob = new Blob([corpo], { type: "application/json" });
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/site/evento", blob))) {
      void fetch("/api/site/evento", { method: "POST", headers: { "content-type": "application/json" }, body: corpo, keepalive: true });
    }
  } catch {
    /* sem medição: o site segue normal */
  }
}

function destinoDoLink(href: string): string {
  const h = href.toLowerCase();
  if (h.includes("wa.me") || h.includes("api.whatsapp.com") || h.includes("whatsapp.com/send")) return "whatsapp";
  if (h.startsWith("tel:")) return "telefone";
  if (h.includes("google.com/maps") || h.includes("maps.app.goo.gl")) return "mapa";
  if (h.includes("instagram.com")) return "instagram";
  if (h.includes("facebook.com")) return "facebook";
  if (h.startsWith("/agendar") || h.includes("/agendar")) return "agendar";
  return "outro";
}

export function Rastreio() {
  const caminho = usePathname();

  // Uma visita por página (inclui navegação interna do site).
  useEffect(() => {
    try {
      if (navigator.doNotTrack === "1") return;
    } catch {
      /* segue */
    }
    enviar("visita");

    let m50 = false;
    let m90 = false;
    const onScroll = () => {
      const alto = document.documentElement.scrollHeight - window.innerHeight;
      if (alto <= 0) return;
      const p = window.scrollY / alto;
      if (!m50 && p >= 0.5) {
        m50 = true;
        enviar("rolagem_50");
      }
      if (!m90 && p >= 0.9) {
        m90 = true;
        enviar("rolagem_90");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = window.setTimeout(() => {
      if (document.visibilityState === "visible") enviar("tempo_30s");
    }, 30000);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
    };
  }, [caminho]);

  // Cliques em links importantes e início do preenchimento do formulário.
  useEffect(() => {
    try {
      if (navigator.doNotTrack === "1") return;
    } catch {
      /* segue */
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const destino = destinoDoLink(a.getAttribute("href") ?? "");
      if (destino === "outro") return;
      enviar("clique", { detalhe: { destino, local: a.dataset.local ?? null } });
    };
    let formIniciado = false;
    const onFocus = (e: FocusEvent) => {
      if (formIniciado) return;
      const f = (e.target as HTMLElement | null)?.closest?.("form");
      if (!f) return;
      formIniciado = true;
      enviar("form_inicio");
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  return null;
}
