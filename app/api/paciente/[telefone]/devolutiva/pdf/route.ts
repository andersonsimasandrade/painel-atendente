import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { pdfDaDevolutiva } from "@/lib/devolutiva-envio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET ?id=… → baixa o PDF da devolutiva (só logado e só do próprio escopo). Sem senha: quem confecciona vê tudo.
export async function GET(req: Request, { params }: { params: { telefone: string } }) {
  const t = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const p = await pdfDaDevolutiva(t, new URL(req.url).searchParams.get("id") ?? "");
  if (!p.ok) return NextResponse.json(p, { status: 404 });
  const ascii = p.arquivo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w. -]/g, "_");
  return new Response(Buffer.from(p.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(p.arquivo)}`,
      "Cache-Control": "no-store",
    },
  });
}
