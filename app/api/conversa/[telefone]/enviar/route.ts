import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { getPainelConfig, inserirMensagemPainel } from "@/lib/db";
import { enviarTextoInstancia } from "@/lib/evolution";
import { canalDaConversa } from "@/lib/consultores";
import { chamarPausaWebhook } from "@/lib/painel-pausa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEN = 4096;

// POST /api/conversa/[telefone]/enviar  { texto }
// Envia uma resposta do agente humano pelo WhatsApp (Evolution) e registra a
// mensagem para (a) aparecer na conversa como "Você" e (b) manter a memória do
// bot. Protegido pelo MESMO cookie de sessão do middleware (verifyToken) — sem
// sessão válida => 401, igual a /api/fechar.
export async function POST(
  req: Request,
  { params }: { params: { telefone: string } },
) {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!(await verifyToken(token))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  // Escopo (multi-consultor): consultor só age sobre lead DELE. 403 caso contrário.
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json(
      { ok: false, error: "Telefone obrigatório." },
      { status: 400 },
    );
  }

  let texto = "";
  try {
    const body = (await req.json()) as { texto?: unknown };
    texto = String(body.texto ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  if (!texto) {
    return NextResponse.json({ ok: false, error: "Mensagem vazia." }, { status: 400 });
  }
  if (texto.length > MAX_LEN) {
    return NextResponse.json(
      { ok: false, error: `Mensagem muito longa (máx. ${MAX_LEN} caracteres).` },
      { status: 400 },
    );
  }

  // IMPORTANTE: envios via API da Evolution NÃO geram o webhook do bot (só
  // mensagens de device), então NÃO existe auto-pausa por eco. Esta chamada é a
  // ÚNICA pausa — por isso é AWAITED e seu resultado volta no campo `pausa`.

  // 1) Pausa o bot PRIMEIRO (fecha a janela de resposta antes da msg sair).
  const pausa = await chamarPausaWebhook(telefone, "pause");

  // 2) De qual número esta conversa fala, e com que nome assina. O nome de
  //    plantão (Ajustes) vence quando preenchido; sem ele, assina com o
  //    consultor DO NÚMERO que atende este lead — nunca um nome fixo.
  const [cfg, canal] = await Promise.all([getPainelConfig(), canalDaConversa(telefone)]);
  const assinatura = (cfg.atendente_nome ?? "").trim() || canal.nome;
  const textoEnvio = cfg.assinar && assinatura ? `*${assinatura}:*\n${texto}` : texto;

  // 3) Envia PELO NÚMERO DA CONVERSA. Mandar pela instância do env faria o lead
  //    de um consultor receber resposta pelo WhatsApp de outro. Se falhar, NÃO registra.
  const envio = await enviarTextoInstancia(canal.instancia, telefone, textoEnvio);
  if (!envio.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: envio.error ?? "Falha ao enviar pela Evolution.",
        pausa: pausa.ok,
      },
      { status: 502 },
    );
  }

  // 3) Registra na memória do bot (n8n_chat_histories, sent_by:'painel'). Como o
  //    eco via API não recria a linha, este é o ÚNICO registro; se falhar,
  //    sinalizamos (persisted:false) e logamos — é um buraco na memória do bot.
  const rec = await inserirMensagemPainel(telefone, texto);
  if (!rec.ok) {
    console.error(
      "[/enviar] falha ao registrar msg do painel em n8n_chat_histories:",
      rec.error,
    );
  }

  return NextResponse.json({
    ok: true,
    pausa: pausa.ok, // false → o painel avisa que o bot pode não estar pausado
    persisted: rec.ok, // false → o painel marca a bolha como "não registrada"
    ...(pausa.ok ? {} : { pausaErro: pausa.error }),
    message: {
      ...(rec.ok && rec.id != null ? { id: rec.id } : {}),
      autor: "ia" as const,
      via: "painel" as const,
      texto,
    },
  });
}
