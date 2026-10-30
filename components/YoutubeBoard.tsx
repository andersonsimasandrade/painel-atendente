"use client";

import { useState } from "react";

export interface ComentarioYT {
  comentario_id: string;
  video_id: string | null;
  autor_nome: string | null;
  texto: string | null;
  publicado_em: string | null;
  status: string;
  erro: string | null;
  respondido_em: string | null;
}

const ROTULO: Record<string, string> = {
  novo: "Aguardando o robô",
  respondido: "Respondido (convite)",
  agradecido: "Respondido (agradecimento)",
  ja_respondido: "Já tinha resposta",
  proprio: "Do próprio canal",
  ignorado: "Ignorado (spam ou sem texto)",
  erro: "Erro ao responder",
};

function quando(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
}

function Linha({ c }: { c: ComentarioYT }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const podeResponder = c.status !== "proprio";

  async function enviar() {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch("/api/youtube/responder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.comentario_id, texto }) });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (!d.ok) return setMsg(d.error ?? "Não consegui responder.");
      window.location.reload();
    } catch {
      setMsg("Falha de conexão.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink">{c.autor_nome ?? "Alguém"}</p>
          <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink">{c.texto}</p>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {quando(c.publicado_em)}
            {c.video_id && (
              <>
                {" · "}
                <a className="underline-offset-2 hover:underline" href={`https://www.youtube.com/watch?v=${c.video_id}&lc=${c.comentario_id}`} target="_blank" rel="noopener noreferrer">
                  abrir no YouTube
                </a>
              </>
            )}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.status === "erro" ? "bg-red-400/15 text-red-300" : c.status === "novo" ? "bg-amber-400/15 text-amber-300" : "bg-white/5 text-ink-muted"}`}>{ROTULO[c.status] ?? c.status}</span>
      </div>
      {c.erro && <p className="mt-1 text-[12px] text-red-300">{c.erro}</p>}
      {podeResponder && !aberto && (
        <button type="button" onClick={() => setAberto(true)} className="mt-2 text-[12.5px] font-medium text-brand hover:underline">
          Responder por aqui
        </button>
      )}
      {aberto && (
        <div className="mt-3">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1000} placeholder="Sua resposta pública ao comentário (sem preço e sem promessa de resultado)" className="w-full rounded-xl border border-line bg-base/70 p-3 text-[13.5px] text-ink outline-none focus:border-brand/60" />
          {msg && <p className="mt-1 text-[12.5px] text-red-300">{msg}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button type="button" disabled={ocupado || !texto.trim()} onClick={enviar} className="rounded-xl bg-brand px-4 py-2 text-[13px] font-semibold text-[#04140d] disabled:opacity-50">
              {ocupado ? "Enviando…" : "Publicar resposta"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="text-[12.5px] text-ink-faint hover:text-ink-muted">
              cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function YoutubeBoard({ configurado, conectado, desligado, canal, comentarios }: { configurado: boolean; conectado: boolean; desligado: boolean; canal: string | null; comentarios: ComentarioYT[] }) {
  const [sync, setSync] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function sincronizar() {
    setOcupado(true);
    setSync(null);
    try {
      const r = await fetch("/api/youtube/sincronizar", { method: "POST" });
      const d = (await r.json()) as { ok: boolean; error?: string; lidos?: number; novos?: number; respondidos?: number; motivo?: string };
      if (!d.ok) return setSync(d.error ?? "Não consegui atualizar.");
      setSync(d.motivo ? `Nada a fazer agora: ${d.motivo}.` : `Lidos ${d.lidos}, novos ${d.novos}, respondidos ${d.respondidos}.`);
      if ((d.novos ?? 0) > 0 || (d.respondidos ?? 0) > 0) setTimeout(() => window.location.reload(), 1200);
    } catch {
      setSync("Falha de conexão.");
    } finally {
      setOcupado(false);
    }
  }

  if (!conectado) {
    return (
      <div className="rounded-2xl border border-line p-5 text-[14px] text-ink">
        <p className="font-semibold">O canal ainda não está conectado.</p>
        <p className="mt-1 text-ink-muted">{configurado ? "Abra o endereço abaixo, escolha o canal e autorize." : "Faltam YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET no EasyPanel."}</p>
        {configurado && (
          <a href="/api/youtube/conectar" className="mt-3 inline-block rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-[#04140d]">
            Conectar o YouTube
          </a>
        )}
      </div>
    );
  }

  const novos = comentarios.filter((c) => c.status === "novo").length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
        <div className="text-[13px] text-ink-muted">
          <p>
            Canal <b className="text-ink">{canal}</b> ·{" "}
            {desligado ? <b className="text-amber-300">robô desligado (YOUTUBE_ROBO)</b> : <b className="text-brand">robô ligado</b>} · lê e responde de 15 em 15 minutos, entre 8h e 20h.
          </p>
          <p className="mt-0.5 text-[12px]">Elogios recebem agradecimento; perguntas e interesse recebem o convite para marcar a consulta pelo site (com origem YouTube) e um aviso no seu WhatsApp. {novos > 0 ? `${novos} aguardando.` : ""}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button type="button" onClick={sincronizar} disabled={ocupado} className="rounded-xl border border-line px-3.5 py-2 text-[13px] font-semibold text-ink hover:border-line-strong disabled:opacity-50">
            {ocupado ? "Lendo…" : "Ler comentários agora"}
          </button>
          {sync && <span className="text-[12px] text-ink-muted">{sync}</span>}
        </div>
      </div>
      {comentarios.length === 0 ? (
        <p className="rounded-2xl border border-line p-4 text-[13px] text-ink-muted">Nenhum comentário lido ainda. Publique um vídeo e peça para alguém comentar.</p>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c) => (
            <Linha key={c.comentario_id} c={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
