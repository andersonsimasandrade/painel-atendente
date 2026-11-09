import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { atualizarResumo, excluirExame, linkDoArquivo, salvarExame } from "@/lib/prontuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Exames do paciente (prontuário). Só logado e só do próprio escopo (barrarSeNaoPode).
//   GET    ?id=…  → abre o arquivo do exame (redireciona para um link assinado de 2 minutos)
//   POST   multipart: titulo, tipo, data_exame, link_url, laudo_texto, resumo, resumo_por_ia, arquivo(opcional)
//   PATCH  { id, resumo } → edita o resumo do laudo
//   DELETE ?id=…  → apaga o exame (e o arquivo)
const tel = (p: { telefone: string }) => decodeURIComponent(p.telefone ?? "").trim();

export async function GET(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const url = id ? await linkDoArquivo(t, id) : null;
  if (!url) return NextResponse.json({ ok: false, error: "Arquivo não encontrado." }, { status: 404 });
  return NextResponse.redirect(url, 302);
}

export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  let f: FormData;
  try {
    f = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const arq = f.get("arquivo");
  const arquivo =
    arq instanceof File && arq.size > 0
      ? { buffer: Buffer.from(await arq.arrayBuffer()), nome: arq.name || "exame", mime: arq.type }
      : undefined;
  const r = await salvarExame(
    t,
    {
      titulo: f.get("titulo"),
      tipo: f.get("tipo"),
      data_exame: f.get("data_exame"),
      link_url: f.get("link_url"),
      laudo_texto: f.get("laudo_texto"),
      resumo: f.get("resumo"),
      resumo_por_ia: f.get("resumo_por_ia") === "1",
    },
    arquivo,
  );
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function PATCH(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { id?: string; resumo?: string };
  const r = await atualizarResumo(t, String(b.id ?? ""), String(b.resumo ?? ""));
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}

export async function DELETE(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const r = await excluirExame(t, new URL(req.url).searchParams.get("id") ?? "");
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
