import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { destinatariosAlerta } from "@/lib/config";
import { enviarEmail } from "@/lib/email";
import { corpoHtml } from "@/lib/alerta-conexao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST (só administrador) → manda o e-mail de "WhatsApp desconectado" como TESTE para quem recebe os alertas.
export async function POST() {
  const sess = await getSessao();
  if (!sess || sess.papel !== "admin") return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  const emails = destinatariosAlerta().map((d) => d.email).filter((e): e is string => !!e);
  const falta: string[] = [];
  if (!(process.env.RESEND_API_KEY ?? "").trim()) falta.push("RESEND_API_KEY");
  if (!(process.env.EMAIL_REMETENTE ?? "").trim()) falta.push("EMAIL_REMETENTE");
  if (!emails.length) falta.push("ALERTAS_EMAIL");
  if (falta.length) return NextResponse.json({ ok: false, error: `Falta configurar no EasyPanel (Ambiente): ${falta.join(", ")}.`, falta }, { status: 400 });
  const resultados: { email: string; ok: boolean; erro?: string }[] = [];
  for (const e of emails) {
    const r = await enviarEmail(e, "🔴 TESTE: aviso de WhatsApp da Fisioterapia desconectado", corpoHtml("Fisioterapia", "desconectado", true), true);
    resultados.push({ email: e.replace(/^(.).*(@.*)$/, "$1***$2"), ok: r.ok, ...(r.ok ? {} : { erro: r.error }) });
  }
  return NextResponse.json({ ok: resultados.every((r) => r.ok), resultados });
}
