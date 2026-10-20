"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "@/components/site/gtm-tipos";

const CHAVE = "site-consent-v1";

// Aviso simples de cookies. "Aceitar" libera a medição e a conversão dos anúncios
// (Google Tag Manager); "Recusar" mantém tudo negado. Personalização de anúncios
// nunca é liberada. A escolha vale neste navegador.
export function AvisoCookies() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CHAVE)) setVisivel(true);
    } catch {
      setVisivel(true);
    }
  }, []);

  function escolher(aceitou: boolean) {
    try {
      localStorage.setItem(CHAVE, aceitou ? "granted" : "denied");
    } catch {
      /* segue sem guardar */
    }
    if (aceitou) {
      window.gtag?.("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        analytics_storage: "granted",
      });
    }
    setVisivel(false);
  }

  if (!visivel) return null;
  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DCE8E5] bg-white/98 px-4 py-3 shadow-[0_-4px_18px_rgba(0,0,0,0.08)] sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13.5px] leading-snug text-[#3F5452]">
          Usamos cookies para entender quais páginas ajudam e se os nossos anúncios funcionam. Não coletamos dados de saúde e
          não usamos remarketing.{" "}
          <Link href="/privacidade" className="font-semibold text-[#0F7F70] underline underline-offset-2">
            Saiba mais
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => escolher(false)}
            className="rounded-xl border border-[#BFD3CF] px-4 py-2 text-[13.5px] font-semibold text-[#354746] hover:bg-[#F0F6F4]"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => escolher(true)}
            className="rounded-xl bg-[#0F7F70] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#0B6B5E]"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
