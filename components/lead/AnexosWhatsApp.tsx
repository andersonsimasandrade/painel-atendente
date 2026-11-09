"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Anexo {
  id: string;
  tipo: "documento" | "imagem";
  nome: string | null;
  mime: string | null;
  legenda: string | null;
  quando: string | null;
  salvo: boolean;
}

const quandoBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/** Documentos e imagens que o paciente mandou na conversa do WhatsApp: guarda no prontuário com um clique. */
export function AnexosWhatsApp({ telefone }: { telefone: string }) {
  const router = useRouter();
  const base = `/api/paciente/${encodeURIComponent(telefone)}/anexos`;
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Anexo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar() {
    setAberto(true);
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(base, { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; itens?: Anexo[]; error?: string };
      if (!r.ok || !d.itens) {
        setErro(d.error ?? "Não consegui buscar os anexos.");
        return;
      }
      setItens(d.itens);
    } catch {
      setErro("Falha de rede.");
    } finally {
      setCarregando(false);
    }
  }

  async function salvar(a: Anexo) {
    setSalvando(a.id);
    setErro(null);
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, nome: a.nome, legenda: a.legenda, data: a.quando ? a.quando.slice(0, 10) : null }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não consegui salvar o anexo.");
        return;
      }
      setItens((l) => (l ?? []).map((x) => (x.id === a.id ? { ...x, salvo: true } : x)));
      router.refresh();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(null);
    }
  }

  const botao = "inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50";

  if (!aberto) {
    return (
      <button type="button" className={botao} onClick={() => void buscar()}>
        📎 Exames enviados no WhatsApp
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">Arquivos que o paciente enviou no WhatsApp</p>
        <div className="flex gap-2">
          <button type="button" className={botao} onClick={() => void buscar()} disabled={carregando}>
            {carregando ? "Buscando…" : "Atualizar"}
          </button>
          <button type="button" className={botao} onClick={() => setAberto(false)}>
            Fechar
          </button>
        </div>
      </div>
      {erro && <p className="text-[12.5px] text-amber">{erro}</p>}
      {itens && !itens.length && !erro && (
        <p className="text-[12.5px] text-ink-muted">Nenhum documento ou imagem encontrado na conversa. Se o paciente mandou um link, use “+ Exame” e cole o link.</p>
      )}
      <ul className="flex flex-col gap-2">
        {(itens ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2">
            <span className="text-[16px]">{a.tipo === "documento" ? "📄" : "🖼"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{a.nome ?? a.legenda ?? (a.tipo === "imagem" ? "Imagem" : "Documento")}</p>
              <p className="text-[11.5px] text-ink-faint">{quandoBR(a.quando)}</p>
            </div>
            {a.salvo ? (
              <span className="text-[12px] font-semibold text-brand">✓ No prontuário</span>
            ) : (
              <button type="button" className={botao} disabled={salvando === a.id} onClick={() => void salvar(a)}>
                {salvando === a.id ? "Salvando…" : "Salvar no prontuário"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
