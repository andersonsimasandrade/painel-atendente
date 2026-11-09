import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { resumirLaudo } from "@/lib/prontuario";
import { resumirArquivoExame } from "@/lib/prontuario-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { texto } → rascunho de resumo do laudo colado (a IA só resume o que o laudo descreve; o Anderson revisa).
// POST { id } → lê o ARQUIVO do exame (PDF/imagem) e guarda o resumo como rascunho no exame.
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const barrado = await barrarSeNaoPode(decodeURIComponent(params.telefone ?? "").trim());
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { texto?: string; id?: string };
  if (b.id) {
    const r = await resumirArquivoExame(decodeURIComponent(params.telefone ?? "").trim(), String(b.id));
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  }
  const resumo = await resumirLaudo(String(b.texto ?? ""));
  if (!resumo) return NextResponse.json({ ok: false, error: "Não consegui resumir agora. Cole o texto do laudo (mínimo de algumas linhas) e tente de novo, ou escreva o resumo à mão." }, { status: 422 });
  return NextResponse.json({ ok: true, resumo });
}
