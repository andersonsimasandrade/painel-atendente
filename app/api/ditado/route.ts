import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { transcreverSessao } from "@/lib/prontuario-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST multipart { audio } → { texto }. Ditado: o Anderson fala, o texto entra no campo que ele está preenchendo.
// Só logado. O áudio é transcrito e descartado (não fica guardado).
export async function POST(req: Request) {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  let f: FormData;
  try {
    f = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const a = f.get("audio");
  if (!(a instanceof File) || a.size === 0) return NextResponse.json({ ok: false, error: "Envie o áudio." }, { status: 400 });
  if (a.size > 12 * 1024 * 1024) return NextResponse.json({ ok: false, error: "O ditado passou do limite (cerca de 12 minutos). Fale em partes." }, { status: 413 });
  const r = await transcreverSessao(Buffer.from(await a.arrayBuffer()), a.type || "audio/webm", 1);
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
