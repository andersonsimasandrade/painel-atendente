import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { barrarSemSessao } from "@/lib/ig-dados";
import { enviarDM } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HUMANO_HORAS = 48;

// POST /api/instagram/enviar { id, texto } — resposta do time pelo direct do Instagram.
// Grava a mensagem como "humano" e PAUSA o robô nessa conversa por 48 h (igual a quando o Anderson responde pelo app).
// Limite da Meta: só dá para responder até 24 h depois da última mensagem da pessoa.
export async function POST(req: Request) {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  let id = "";
  let texto = "";
  try {
    const b = (await req.json()) as { id?: unknown; texto?: unknown };
    id = String(b.id ?? "").replace(/\D/g, "");
    texto = String(b.texto ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!id || !texto) return NextResponse.json({ ok: false, error: "Mensagem vazia." }, { status: 400 });
  if (texto.length > 1000) return NextResponse.json({ ok: false, error: "Máximo de 1000 caracteres." }, { status: 400 });

  const sb = getClient();
  const c = await sb.from("ig_contatos").select("ig_id").eq("ig_id", id).limit(1);
  if (!c.data?.length) return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });

  const env = await enviarDM(id, texto);
  if (!env.ok) {
    const janela = /24|window|outside|allowed/i.test(env.erro ?? "");
    return NextResponse.json(
      {
        ok: false,
        error: janela
          ? "O Instagram só permite responder em até 24 h depois da última mensagem da pessoa. Peça para ela escrever de novo, ou chame pelo WhatsApp."
          : `Não consegui enviar: ${(env.erro ?? "erro").slice(0, 160)}`,
      },
      { status: 502 },
    );
  }
  await sb.from("ig_mensagens").insert({ ig_id: id, papel: "humano", texto, mid: env.id ?? null });
  await sb
    .from("ig_contatos")
    .update({ estado: "humano", humano_ate: new Date(Date.now() + HUMANO_HORAS * 3600 * 1000).toISOString() })
    .eq("ig_id", id);
  return NextResponse.json({ ok: true });
}
