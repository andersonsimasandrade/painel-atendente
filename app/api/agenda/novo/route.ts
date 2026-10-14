import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { criarAgendamento, getVendedorBySlug, listarVendedores } from "@/lib/agenda";
import { enviarTextoInstancia } from "@/lib/evolution";
import { formatarBR } from "@/lib/slots";
import { apenasDigitos } from "@/lib/format";
import { CONSULTORIOS } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/agenda/novo { telefone, nome, data (YYYY-MM-DD), hora (HH:MM), local, confirmar }
// O Anderson marca a avaliação depois de combinar o horário com o paciente.
// Só quem está logado no painel chama (o middleware exige sessão).
export async function POST(req: Request) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const telefone = apenasDigitos(String(b.telefone ?? ""));
  const nome = String(b.nome ?? "").trim().slice(0, 120) || null;
  const data = String(b.data ?? "");
  const hora = String(b.hora ?? "");
  const local = b.local === "capoeiras" || b.local === "centro" ? b.local : null;
  const confirmar = b.confirmar === true;

  if (telefone.length < 10 || telefone.length > 15)
    return NextResponse.json({ ok: false, error: "Informe o WhatsApp com DDD." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora))
    return NextResponse.json({ ok: false, error: "Informe dia e horário." }, { status: 400 });
  if (!local) return NextResponse.json({ ok: false, error: "Escolha o consultório." }, { status: 400 });

  const iso = new Date(`${data}T${hora}:00-03:00`).toISOString();
  if (!Number.isFinite(new Date(iso).getTime()))
    return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });

  // Consultor dono da agenda: o da sessão, ou o primeiro ativo.
  let slug = sess.papel === "vendedor" ? sess.vslug ?? "" : "";
  if (!slug) slug = (await listarVendedores())[0]?.slug ?? "";
  const vend = slug ? await getVendedorBySlug(slug) : null;
  if (!vend) return NextResponse.json({ ok: false, error: "Nenhum consultor ativo." }, { status: 400 });

  const criado = await criarAgendamento({
    vendedorId: vend.id,
    telefone,
    nome,
    dataHora: iso,
    origem: "manual",
    local,
  });
  if (!criado.ok) {
    return NextResponse.json(
      { ok: false, error: criado.conflito ? "Já existe uma avaliação nesse horário." : "Não consegui gravar." },
      { status: criado.conflito ? 409 : 500 },
    );
  }

  // Funil: agendado (sem rebaixar quem já está além).
  try {
    await getClient()
      .from("ff_contatos")
      .update({ funnel_stage: "agendado", funnel_rank: 4 })
      .eq("telefone", telefone)
      .lt("funnel_rank", 4);
  } catch (e) {
    console.error("[agenda/novo] funil:", e);
  }

  const quando = formatarBR(iso);
  const cons = CONSULTORIOS[local];
  let confirmado = false;
  if (confirmar) {
    const primeiro = nome ? nome.split(" ")[0] : "";
    const texto =
      `Olá${primeiro ? ", " + primeiro : ""}! Sua avaliação está agendada para *${quando}*, no ${cons.nome}.\n` +
      `📍 ${cons.linhaEndereco}\n\n` +
      `Se tiver exames, leve para o atendimento, e use roupa confortável e folgada. ` +
      `Para remarcar, avise com 48 horas de antecedência. Até lá! 😊`;
    const env = await enviarTextoInstancia(vend.instancia_whatsapp, telefone, texto);
    confirmado = env.ok;
    if (!env.ok) console.error("[agenda/novo] confirmação falhou:", env.error);
  }

  try {
    await getClient()
      .from("n8n_chat_histories")
      .insert({
        session_id: telefone,
        message: {
          type: "ai",
          content: `📅 Avaliação agendada: ${quando} (${cons.bairro}).`,
          tool_calls: [],
          additional_kwargs: { via: "sistema" },
          response_metadata: {},
          invalid_tool_calls: [],
        },
      });
  } catch (e) {
    console.error("[agenda/novo] log painel:", e);
  }

  return NextResponse.json({ ok: true, id: criado.id, quando, local: cons.bairro, confirmado });
}
