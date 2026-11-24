"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";

function sessaoExpirada(res: Response): boolean {
  return res.type === "opaqueredirect" || res.status === 0 || res.status === 401;
}

function chaveParaBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type Estado = "carregando" | "sem_suporte" | "iphone_sem_app" | "bloqueado" | "desligado" | "ligado";

/** Ajustes → "Avisos no celular": liga ou desliga a notificação deste aparelho (mensagens novas e sessão em 30 min). */
export function SecaoAvisosCelular({ onSessaoExpirou }: { onSessaoExpirou: () => void }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const conferir = useCallback(async () => {
    if (typeof window === "undefined") return;
    const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setEstado(iphone && !instalado ? "iphone_sem_app" : "sem_suporte");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub && Notification.permission === "granted" ? "ligado" : "desligado");
    } catch {
      setEstado("desligado");
    }
  }, []);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  async function ligar() {
    setOcupado(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setEstado(perm === "denied" ? "bloqueado" : "desligado");
        setMsg({ tipo: "erro", texto: "Sem a sua permissão o celular não deixa o painel avisar." });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const rc = await fetch("/api/push", { cache: "no-store", redirect: "manual" });
      if (sessaoExpirada(rc)) {
        onSessaoExpirou();
        return;
      }
      const dc = (await rc.json().catch(() => ({}))) as { ok?: boolean; chave?: string; error?: string };
      if (!rc.ok || !dc.ok || !dc.chave) {
        setMsg({ tipo: "erro", texto: dc.error ?? "Não consegui preparar os avisos." });
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(dc.chave) as BufferSource });
      }
      const rs = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "manual",
        body: JSON.stringify({ acao: "assinar", subscription: sub.toJSON(), aparelho: navigator.userAgent }),
      });
      const ds = (await rs.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!rs.ok || !ds.ok) {
        setMsg({ tipo: "erro", texto: ds.error ?? "Não consegui salvar este aparelho." });
        return;
      }
      setEstado("ligado");
      setMsg({ tipo: "ok", texto: "Ligado neste aparelho. Toque em “Enviar um aviso de teste”." });
    } catch (e) {
      setMsg({ tipo: "erro", texto: `Não deu para ligar: ${e instanceof Error ? e.message : "erro desconhecido"}.` });
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "cancelar", endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setEstado("desligado");
      setMsg({ tipo: "ok", texto: "Avisos desligados neste aparelho." });
    } catch {
      setMsg({ tipo: "erro", texto: "Não consegui desligar agora. Tente de novo." });
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    setMsg(null);
    try {
      const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "teste" }) });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setMsg(res.ok && d.ok ? { tipo: "ok", texto: "Enviei! O aviso deve aparecer em instantes." } : { tipo: "erro", texto: d.error ?? "Não consegui enviar o teste." });
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de rede. Tente de novo." });
    } finally {
      setOcupado(false);
    }
  }

  const BOTAO = "inline-flex h-10 items-center rounded-lg px-4 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Panel title="Avisos no celular" subtitle="Notificação quando chega mensagem e 1 hora antes de cada sessão" delay={0}>
      <p className="text-[13px] leading-relaxed text-ink-muted">
        O aviso mostra só o nome (ex.: “💬 Humberto · Nova mensagem”), sem o texto, para ninguém ler a conversa na tela bloqueada. Ao tocar, abre a conversa. Ative em cada aparelho que quiser receber.
      </p>
      <div className="mt-4 space-y-3">
        {estado === "carregando" && <p className="text-[12.5px] text-ink-faint">Verificando…</p>}
        {estado === "sem_suporte" && (
          <p className="text-[12.5px] leading-relaxed text-amber">Este navegador não tem avisos. No Android use o Chrome; no computador, Chrome ou Edge.</p>
        )}
        {estado === "iphone_sem_app" && (
          <p className="text-[12.5px] leading-relaxed text-amber">
            No iPhone os avisos só funcionam com o painel instalado: toque em Compartilhar → “Adicionar à Tela de Início”, abra o painel pelo ícone novo e volte aqui.
          </p>
        )}
        {estado === "bloqueado" && (
          <p className="text-[12.5px] leading-relaxed text-amber">
            As notificações deste site estão bloqueadas no aparelho. Libere em Configurações do navegador → Notificações → este endereço, e volte aqui.
          </p>
        )}
        {estado === "desligado" && (
          <button type="button" onClick={ligar} disabled={ocupado} className={`${BOTAO} bg-brand text-[#04140d] hover:bg-brand-bright`}>
            {ocupado ? "Ligando…" : "Ativar avisos neste aparelho"}
          </button>
        )}
        {estado === "ligado" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-brand/15 px-3 py-1 text-[12px] font-medium text-brand ring-1 ring-inset ring-brand/30">Ligado neste aparelho</span>
            <button type="button" onClick={testar} disabled={ocupado} className={`${BOTAO} border border-line text-ink hover:bg-white/[0.05]`}>
              Enviar um aviso de teste
            </button>
            <button type="button" onClick={desligar} disabled={ocupado} className="text-[12.5px] font-medium text-ink-faint hover:text-ink-muted disabled:opacity-50">
              Desligar
            </button>
          </div>
        )}
        {msg && <p className={`text-[12.5px] ${msg.tipo === "ok" ? "text-brand" : "text-amber"}`}>{msg.texto}</p>}
      </div>
    </Panel>
  );
}
