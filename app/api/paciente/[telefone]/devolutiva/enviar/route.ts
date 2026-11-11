import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { enviarDevolutivaPdf, enviarDevolutivaWhatsApp } from "@/lib/devolutiva-envio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { id, nascimento?, modo? } → envia por WhatsApp as 2 mensagens da devolutiva (link) ou, com modo:"pdf", o PDF direto (sem link e sem senha). Só logado e só do próprio escopo.
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const t = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { id?: string; nascimento?: string; modo?: string };
  const r = b.modo === "pdf" ? await enviarDevolutivaPdf(t, String(b.id ?? "")) : await enviarDevolutivaWhatsApp(t, String(b.id ?? ""), b.nascimento);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
