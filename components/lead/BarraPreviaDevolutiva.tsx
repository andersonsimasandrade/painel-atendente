"use client";

import { useState } from "react";
import Link from "next/link";

const botao = "inline-flex items-center rounded-lg border border-[#C9D9D5] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#354746] transition hover:bg-[#F0F5F4] disabled:opacity-50";

/** Barra da prévia da devolutiva no painel: ver sem senha, baixar o PDF e mandar o PDF direto no WhatsApp. */
export function BarraPreviaDevolutiva({ telefone, id }: { telefone: string; id: string }) {
  const base = `/api/paciente/${encodeURIComponent(telefone)}/devolutiva`;
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviarPdf() {
    if (!window.confirm("Enviar agora este documento em PDF pelo WhatsApp para o paciente (sem link e sem senha)?")) return;
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch(`${base}/enviar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, modo: "pdf" }) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setMsg(r.ok && d.ok ? "PDF enviado pelo WhatsApp." : (d.error ?? "Não consegui enviar o PDF."));
    } catch {
      setMsg("Falha de rede.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div data-no-print className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-[#D8E4E1] bg-[#F5F8F7]/95 px-4 py-2.5 backdrop-blur">
      <Link href={`/leads/${encodeURIComponent(telefone)}#prontuario`} className={botao}>
        ← Voltar à ficha
      </Link>
      <a href={`${base}/pdf?id=${encodeURIComponent(id)}`} className={botao}>
        Baixar PDF
      </a>
      <button type="button" className={botao} disabled={ocupado} onClick={() => void enviarPdf()}>
        {ocupado ? "Enviando…" : "Enviar o PDF no WhatsApp"}
      </button>
      <button type="button" className={botao} onClick={() => window.print()}>
        Imprimir
      </button>
      <span className="text-[12.5px] text-[#5E7371]">Você vê o documento sem senha. O paciente precisa da data de nascimento para abrir o link.</span>
      {msg && <span className="text-[13px] font-semibold text-[#1B8E7D]">{msg}</span>}
    </div>
  );
}
