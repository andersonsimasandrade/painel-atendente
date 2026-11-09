import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { baixarMidia, listarMidiasRecebidas } from "@/lib/evolution-midia";
import { salvarExame } from "@/lib/prontuario";
import { anexosJaSalvos, tipoPeloNome } from "@/lib/prontuario-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

// Anexos que o paciente mandou pelo WhatsApp.
//   GET  → lista os documentos e imagens da conversa (com a marca de "já salvo")
//   POST { id } → baixa o arquivo do WhatsApp e guarda no prontuário como exame
const tel = (p: { telefone: string }) => decodeURIComponent(p.telefone ?? "").trim();

export async function GET(_req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const [lista, salvos] = await Promise.all([listarMidiasRecebidas(t), anexosJaSalvos(t).catch(() => new Set<string>())]);
  if (!lista.ok) return NextResponse.json(lista, { status: 502 });
  return NextResponse.json({ ok: true, itens: lista.itens.map((m) => ({ ...m, salvo: salvos.has(m.id) })) });
}

export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { id?: string; nome?: string | null; legenda?: string | null; data?: string | null };
  const id = String(b.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Anexo não informado." }, { status: 400 });
  if ((await anexosJaSalvos(t).catch(() => new Set<string>())).has(id)) {
    return NextResponse.json({ ok: false, error: "Este anexo já foi salvo no prontuário." }, { status: 409 });
  }
  const dl = await baixarMidia(t, id);
  if (!dl.ok) return NextResponse.json(dl, { status: 502 });
  const nome = dl.nome ?? (typeof b.nome === "string" ? b.nome : null) ?? `exame-${id.slice(0, 8)}`;
  const titulo = (typeof b.legenda === "string" && b.legenda.trim()) || nome.replace(/\.[A-Za-z0-9]{2,4}$/, "").replace(/[_]+/g, " ");
  const r = await salvarExame(
    t,
    { titulo: titulo.slice(0, 140), tipo: tipoPeloNome(`${nome} ${b.legenda ?? ""}`), data_exame: b.data ?? null, origem_msg_id: id },
    { buffer: dl.buffer, nome, mime: dl.mime },
  );
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
