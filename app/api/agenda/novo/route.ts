import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { criarAgendamento, getCompromissos, getVendedorBySlug, listarVendedores, resolverLead } from "@/lib/agenda";
import { avisoDeslocamento, conflitoDeslocamento } from "@/lib/deslocamento";
import { enviarTextoInstancia } from "@/lib/evolution";
import { formatarBR } from "@/lib/slots";
import { apenasDigitos } from "@/lib/format";
import { partesConfirmacao } from "@/lib/confirmacao";
import { enviarPartes, registrarNaConversa } from "@/lib/confirmacao-envio";
import { variantesTelefone } from "@/lib/telefone";
import { CONSULTORIOS, ORIENTACAO_ESTACIONAMENTO_CENTRO } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/agenda/novo { telefone, nome, data (YYYY-MM-DD), hora (HH:MM), local, confirmar }
// O Anderson marca a sessão depois de combinar o horário com o paciente.
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
  const digitado = apenasDigitos(String(b.telefone ?? ""));
  // Usa o número na forma que o cadastro (e o robô) conhece: com ou sem o 9, é a mesma pessoa.
  const telefone = (digitado.length >= 10 && digitado.length <= 15 ? await resolverLead(digitado) : null) ?? digitado;
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

  // Deslocamento entre consultórios: só AVISA (o Anderson decide), nunca bloqueia a marcação manual.
  const choque = conflitoDeslocamento(new Date(iso).getTime(), local, await getCompromissos(vend.id));
  const aviso = [
    choque ? avisoDeslocamento(choque, local) : "",
    local === "centro" ? "Lembre de reservar a sala no Centro." : "",
  ]
    .filter(Boolean)
    .join(" ");

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
      { ok: false, error: criado.conflito ? "Já existe uma sessão nesse horário." : "Não consegui gravar." },
      { status: criado.conflito ? 409 : 500 },
    );
  }

  // Número novo: a marcação já cadastra o lead (assim ele aparece em Leads e no funil).
  try {
    if (!(await resolverLead(telefone))) {
      await getClient()
        .from("ff_contatos")
        .insert({ telefone, nome, ultima_instancia: (process.env.EVOLUTION_INSTANCE ?? "").trim() || null });
    }
  } catch (e) {
    console.error("[agenda/novo] cadastro do lead:", e);
  }

  // Funil: agendado (sem rebaixar quem já está além).
  try {
    await getClient()
      .from("ff_contatos")
      .update({ funnel_stage: "agendado", funnel_rank: 4 })
      .eq("telefone", telefone)
      .lt("funnel_rank", 4);
    // Lead sem nome no cadastro ganha o nome informado na marcação (nunca sobrescreve um nome existente).
    if (nome) await getClient().from("ff_contatos").update({ nome }).eq("telefone", telefone).is("nome", null);
  } catch (e) {
    console.error("[agenda/novo] funil:", e);
  }

  const quando = formatarBR(iso);
  const cons = CONSULTORIOS[local];
  let confirmado = false;
  let enviadas: string[] = []; // o que de fato foi ao paciente (aparece na conversa do painel)
  if (confirmar) {
    // Primeira vez = sem consulta anterior (fora a que acabou de ser marcada) e sem conversa registrada.
    const variantes = variantesTelefone(telefone);
    const [anteriores, cadastro] = await Promise.all([
      getClient().from("agendamentos").select("id", { count: "exact", head: true }).in("telefone_lead", variantes).neq("status", "cancelado").neq("id", criado.id),
      getClient().from("ff_contatos").select("total_mensagens").in("telefone", variantes).limit(1),
    ]);
    const msgs = Number((cadastro.data?.[0] as { total_mensagens: number | null } | undefined)?.total_mensagens ?? 0);
    const partes = partesConfirmacao({ nome, iso, local, primeiraVez: (anteriores.count ?? 0) === 0 && msgs === 0 });
    const env = await enviarPartes(vend.instancia_whatsapp, telefone, partes);
    confirmado = env.ok;
    enviadas = env.enviadas;
    if (!env.ok) console.error("[agenda/novo] confirmação falhou:", env.erro);
  }

  await registrarNaConversa(telefone, enviadas.length ? enviadas : [`📅 Consulta agendada: ${quando} (${cons.bairro}).`]);

  return NextResponse.json({ ok: true, id: criado.id, quando, local: cons.bairro, confirmado, aviso: aviso || undefined });
}
