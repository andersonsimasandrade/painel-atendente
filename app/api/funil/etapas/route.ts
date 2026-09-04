import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import {
  atualizarEtapa,
  criarEtapa,
  excluirEtapa,
  getEtapasComMsgs,
  reordenarEtapas,
} from "@/lib/funil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Etapas do funil são configuração GLOBAL do sistema — só admin mexe.
async function barrarNaoAdmin(): Promise<NextResponse | null> {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  if (sess.papel !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  }
  return null;
}

// GET — etapas + sequências (tela de Ajustes).
export async function GET() {
  const barrado = await barrarNaoAdmin();
  if (barrado) return barrado;
  const { etapas, msgs } = await getEtapasComMsgs();
  return NextResponse.json({ ok: true, etapas, msgs });
}

// POST { label, color } — cria etapa personalizada.
export async function POST(req: Request) {
  const barrado = await barrarNaoAdmin();
  if (barrado) return barrado;
  let label = "";
  let color = "";
  try {
    const b = (await req.json()) as { label?: unknown; color?: unknown };
    label = String(b.label ?? "");
    color = String(b.color ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const r = await criarEtapa(label, color);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}

// PATCH { key, label?, color? } — renomeia/recolore.
export async function PATCH(req: Request) {
  const barrado = await barrarNaoAdmin();
  if (barrado) return barrado;
  let key = "";
  let patch: { label?: string; color?: string } = {};
  try {
    const b = (await req.json()) as { key?: unknown; label?: unknown; color?: unknown };
    key = String(b.key ?? "").trim();
    patch = {
      ...(b.label !== undefined ? { label: String(b.label) } : {}),
      ...(b.color !== undefined ? { color: String(b.color) } : {}),
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!key) return NextResponse.json({ ok: false, error: "Etapa obrigatória." }, { status: 400 });
  const r = await atualizarEtapa(key, patch);
  if (!r.ok) return NextResponse.json(r, { status: r.error === "Etapa não encontrada." ? 404 : 400 });
  return NextResponse.json(r);
}

// PUT { ordem: string[] } — reordena as colunas.
export async function PUT(req: Request) {
  const barrado = await barrarNaoAdmin();
  if (barrado) return barrado;
  let ordem: string[] = [];
  try {
    const b = (await req.json()) as { ordem?: unknown };
    ordem = Array.isArray(b.ordem) ? b.ordem.map((k) => String(k)) : [];
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const r = await reordenarEtapas(ordem);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}

// DELETE { key, moverPara } — exclui etapa personalizada movendo os leads.
export async function DELETE(req: Request) {
  const barrado = await barrarNaoAdmin();
  if (barrado) return barrado;
  let key = "";
  let moverPara = "";
  try {
    const b = (await req.json()) as { key?: unknown; moverPara?: unknown };
    key = String(b.key ?? "").trim();
    moverPara = String(b.moverPara ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!key || !moverPara) {
    return NextResponse.json({ ok: false, error: "Etapa e destino obrigatórios." }, { status: 400 });
  }
  const r = await excluirEtapa(key, moverPara);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
