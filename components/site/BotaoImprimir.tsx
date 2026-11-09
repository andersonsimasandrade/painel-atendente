"use client";

/** Abre a janela de impressão do navegador (de lá dá para salvar em PDF). */
export function BotaoImprimir({ rotulo = "Imprimir ou salvar em PDF" }: { rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#189B89]"
    >
      {rotulo}
    </button>
  );
}
