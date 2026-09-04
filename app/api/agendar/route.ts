import { NextResponse } from "next/server";
import { getVendedorBySlug, getOcupados, criarAgendamento, resolverLead } from "@/lib/agenda";
import { mesmoTelefone, telefoneCanonico } from "@/lib/telefone";
import { gerarSlotsDias, formatarBR } from "@/lib/slots";
import { enviarTextoInstancia } from "@/lib/evolution";
import { getClient } from "@/lib/db";
import { clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";
import { apenasDigitos } from "@/lib/format";
import { verificarConviteEnv } from "@/lib/convite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/agendar { slug, data_hora (ISO), telefone, nome } — grava a reserva.
export async function POST(req: Request) {
  if (await rateLimited(`agendar:${clientIp(req)}`, 15, 600)) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde um pouco." },
      { status: 429 },
    );
  }

  let slug = "";
  let dataHora = "";
  let telefone = "";
  let nome = "";
  let convite = "";
  try {
    const b = (await req.json()) as Record<string, unknown>;
    slug = String(b.slug ?? "");
    dataHora = String(b.data_hora ?? "");
    telefone = apenasDigitos(String(b.telefone ?? ""));
    nome = String(b.nome ?? "").trim().slice(0, 120);
    convite = String(b.convite ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  if (!slug || !dataHora || telefone.length < 10 || telefone.length > 15) {
    return NextResponse.json(
      { ok: false, error: "Preencha nome, WhatsApp e escolha um horário." },
      { status: 400 },
    );
  }

  const vend = await getVendedorBySlug(slug);
  if (!vend) return NextResponse.json({ ok: false, error: "Agenda não encontrada." }, { status: 404 });

  // Convite manual: um token assinado (emitido só atrás do login) autoriza um
  // NÃO-lead a agendar, TRAVADO ao telefone do token. Só pula o gate quando o
  // token é válido E o telefone bate — não reabre o disparo a número arbitrário.
  let autorizado = false;
  if (convite) {
    const v = verificarConviteEnv(convite);
    // Precisa bater telefone E vendedor (o token é assinado p/ um slug).
    // mesmoTelefone tolera o 9º dígito — é a MESMA pessoa, não um bypass.
    if (v.ok && mesmoTelefone(v.telefone, telefone) && v.slug === slug) autorizado = true;
  }

  // GATE (segurança): fora de convite válido, só quem já é lead conhecido pode
  // agendar. Isso evita que um endpoint público dispare WhatsApp a números
  // arbitrários (spam/ban) e impede poisoning do funil/painel com terceiros.
  // resolverLead casa 12 e 13 dígitos: quem digita o número COM o 9 mas está
  // cadastrado SEM (como o WhatsApp entrega) não é mais rejeitado.
  const leadTel = await resolverLead(telefone);
  if (!autorizado && !leadTel) {
    return NextResponse.json(
      { ok: false, error: "Não encontramos seu cadastro. Peça o link de agendamento ao consultor." },
      { status: 403 },
    );
  }
  // Daqui pra frente usa a forma que o sistema conhece (quando for lead), pra
  // o agendamento, o funil e o log caírem na MESMA conversa do bot.
  const tel = leadTel ?? telefone;
  // Teto por número: no máx. 3 agendamentos por telefone por dia (anti-griefing).
  // Fail-closed: protege o número do WhatsApp (ban) mesmo se o rate_events falhar.
  // Bucket na forma canônica: trocar 12<->13 dígitos não dobra a cota.
  if (await rateLimited(`agendar-num:${telefoneCanonico(telefone)}`, 3, 86400, { failClosed: true })) {
    return NextResponse.json(
      { ok: false, error: "Você já tem agendamentos demais hoje. Fale com o consultor." },
      { status: 429 },
    );
  }
  // Teto AGREGADO por vendedor no caminho de convite: limita a largura do spam a
  // muitos números frios (o teto por-número não cobre isso). Fail-closed.
  if (autorizado && (await rateLimited(`agendar-conv:${vend.id}`, 30, 86400, { failClosed: true }))) {
    return NextResponse.json(
      { ok: false, error: "Limite de convites atingido hoje. Tente amanhã." },
      { status: 429 },
    );
  }

  // Revalida que o horário é um slot válido e ainda livre (anti-corrida nível 1).
  let iso: string;
  try {
    iso = new Date(dataHora).toISOString();
  } catch {
    return NextResponse.json({ ok: false, error: "Horário inválido." }, { status: 400 });
  }
  const ocup = await getOcupados(vend.id);
  const validos = new Set(
    gerarSlotsDias(vend.disponibilidade, ocup).flatMap((d) => d.slots.map((s) => s.iso)),
  );
  if (!validos.has(iso)) {
    return NextResponse.json(
      { ok: false, error: "Esse horário não está mais disponível. Escolha outro." },
      { status: 409 },
    );
  }

  // Grava (a UNIQUE garante anti-corrida nível 2).
  const criado = await criarAgendamento({
    vendedorId: vend.id,
    telefone: tel,
    nome: nome || null,
    dataHora: iso,
    origem: autorizado ? "convite" : "link",
  });
  if (!criado.ok) {
    if (criado.conflito) {
      return NextResponse.json(
        { ok: false, error: "Esse horário acabou de ser preenchido. Escolha outro." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: "Não consegui gravar. Tente de novo." }, { status: 500 });
  }

  // Marca o funil 'agendado' (best-effort; não rebaixa quem já está além).
  // Convidados NÃO são leads → não tocam no funil (não poluem o pipeline).
  if (!autorizado) {
    try {
      await getClient()
        .from("ff_contatos")
        .update({ funnel_stage: "agendado", funnel_rank: 4 })
        .eq("telefone", tel)
        .lt("funnel_rank", 4);
    } catch (e) {
      console.error("[agendar] funil:", e);
    }
  }

  // Confirmação no WhatsApp pela instância do vendedor.
  const quando = formatarBR(iso);
  const primeiroNome = nome ? nome.split(" ")[0] : "";
  const texto =
    `*${vend.nome}:*\nShow${primeiroNome ? ", " + primeiroNome : ""}! Sua reunião está marcada para *${quando}*.\n` +
    `Vou te mandar o link do encontro um pouco antes. Qualquer coisa é só me chamar aqui 👊`;
  const env = await enviarTextoInstancia(vend.instancia_whatsapp, tel, texto);
  if (!env.ok) console.error("[agendar] confirmação falhou:", env.error);

  // Loga o marcador na conversa do painel (como agenda/catálogo).
  try {
    await getClient()
      .from("n8n_chat_histories")
      .insert({
        session_id: tel,
        message: {
          type: "ai",
          content: `📅 Reunião agendada: ${quando}.`,
          tool_calls: [],
          additional_kwargs: { via: "sistema" },
          response_metadata: {},
          invalid_tool_calls: [],
        },
      });
  } catch (e) {
    console.error("[agendar] log painel:", e);
  }

  return NextResponse.json({ ok: true, data_hora: iso, quando, confirmado: env.ok });
}
