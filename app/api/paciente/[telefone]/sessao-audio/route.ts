import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { rascunhoDaSessao, transcreverSessao } from "@/lib/prontuario-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// POST multipart { audio, autorizado: "1" } → transcrição + RASCUNHO da evolução (nada é salvo aqui).
// O áudio é transcrito e descartado; só o Anderson decide o que entra no prontuário.
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const barrado = await barrarSeNaoPode(decodeURIComponent(params.telefone ?? "").trim());
  if (barrado) return barrado;
  let f: FormData;
  try {
    f = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  if (f.get("autorizado") !== "1") {
    return NextResponse.json({ ok: false, error: "Confirme que o paciente autorizou a gravação." }, { status: 400 });
  }
  const a = f.get("audio");
  if (!(a instanceof File) || a.size === 0) return NextResponse.json({ ok: false, error: "Envie o áudio da sessão." }, { status: 400 });
  const tr = await transcreverSessao(Buffer.from(await a.arrayBuffer()), a.type || "audio/webm");
  if (!tr.ok) return NextResponse.json(tr, { status: 422 });
  const rascunho = await rascunhoDaSessao(tr.texto);
  return NextResponse.json({ ok: true, transcricao: tr.texto, rascunho });
}
