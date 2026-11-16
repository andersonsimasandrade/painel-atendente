import { NextResponse } from "next/server";
import { evolutionState, enviarTextoInstancia } from "@/lib/evolution";
import { enviarEmail } from "@/lib/email";
import { avisouRecentemente, marcarAviso } from "@/lib/ratelimit";
import { listarConsultores } from "@/lib/consultores";
import { destinatariosAlerta, instanciaAlertas } from "@/lib/config";
import { appBaseUrl } from "@/lib/http";
import { corpoHtml } from "@/lib/alerta-conexao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vigia a conexão do WhatsApp de TODOS os consultores ativos. Se uma instância
// não estiver 'open', avisa quem pode religar. Sem isso, o bot daquele número
// fica mudo com anúncio rodando e ninguém percebe.
//
// Antes isto olhava só a instância do .env — o WhatsApp de qualquer consultor
// novo podia cair por dias sem alerta nenhum.
//
// O teto de 1 alerta a cada 30 minutos é POR INSTÂNCIA: duas quedas simultâneas geram
// dois avisos, e uma queda longa não vira spam. Chamado por um workflow n8n a
// cada ~10 min.
//
// ATENÇÃO ao aviso por WhatsApp: quem manda o alerta é uma instância da
// Evolution — e a instância que caiu é justamente a que não consegue avisar.
// Se você tem um segundo número só para avisos, coloque em
// EVOLUTION_INSTANCE_ALERTAS. Com um número só, configure ALERTAS_EMAIL: o
// e-mail é o único caminho que sobrevive à queda.
const paginaConexao = () => `${appBaseUrl().replace(/\/+$/, "")}/conexao`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function corpoTexto(quem: string, estado: string): string {
  return (
    `🔴 *WhatsApp do ${quem} fora do ar*\n\n` +
    `A conexão está *${estado}* — esse número não está recebendo nem respondendo ` +
    `mensagens, e os anúncios continuam rodando.\n\n` +
    `Pra religar: abra ${paginaConexao()} e leia o QR code com o WhatsApp desse número.\n\n` +
    `_Aviso automático do painel. No máximo 1 por hora, por número._`
  );
}

async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const consultores = await listarConsultores(true);
  if (!consultores.length) {
    // Sem tabela legível, vigiar nada seria pior que vigiar o padrão.
    const st = await evolutionState();
    const estado = st.ok ? String(st.state ?? "desconhecido") : "sem resposta";
    return NextResponse.json({
      ok: true,
      aviso: "não foi possível listar consultores; checado só o número padrão",
      instancias: [{ instancia: st.instance ?? "(env)", estado }],
    });
  }

  const relatorio: { consultor: string; instancia: string; estado: string; alertou: boolean }[] = [];
  const avisos: string[] = [];

  for (const c of consultores) {
    const st = await evolutionState(c.instancia_whatsapp);
    // Não conseguir LER o estado também é problema — trata como queda, com
    // rótulo honesto em vez de silêncio.
    const estado = st.ok ? String(st.state ?? "desconhecido") : "sem resposta";
    const caiu = estado !== "open";

    if (!caiu) {
      relatorio.push({ consultor: c.nome, instancia: c.instancia_whatsapp, estado, alertou: false });
      continue;
    }

    if (await avisouRecentemente(`aviso-conexao:${c.instancia_whatsapp}`, 1700)) {
      relatorio.push({ consultor: c.nome, instancia: c.instancia_whatsapp, estado, alertou: false });
      continue;
    }

    await marcarAviso(`aviso-conexao:${c.instancia_whatsapp}`);
    const texto = corpoTexto(c.nome, estado);
    const html = corpoHtml(c.nome, estado);

    // Responsáveis configurados + o próprio consultor (sem duplicar número).
    const destinos = destinatariosAlerta().slice();
    if (c.telefone_dono && !destinos.some((d) => d.whatsapp === c.telefone_dono)) {
      destinos.push({ nome: c.nome, whatsapp: c.telefone_dono, email: null });
    }

    // A instância de alerta é a MESMA que caiu? Então o WhatsApp não vai sair.
    // Melhor dizer isso na resposta do que fingir que avisou.
    const alertas = instanciaAlertas();
    const podeWhats = !!alertas && alertas !== c.instancia_whatsapp;
    if (!podeWhats) {
      avisos.push(
        `A instância de alerta é a mesma que caiu (${c.instancia_whatsapp}): o aviso por ` +
          `WhatsApp não sai. Configure ALERTAS_EMAIL ou um segundo número em ` +
          `EVOLUTION_INSTANCE_ALERTAS.`,
      );
    }

    for (let i = 0; i < destinos.length; i++) {
      const p = destinos[i];
      if (p.whatsapp && podeWhats) {
        const wa = await enviarTextoInstancia(alertas, p.whatsapp, texto);
        if (!wa.ok) console.error("[cron/conexao] whatsapp", c.instancia_whatsapp, p.nome, wa.error);
      }
      if (p.email) {
        await sleep(800);
        const em = await enviarEmail(p.email, `🔴 URGENTE: WhatsApp da Fisioterapia desconectado (${estado}). Reconecte agora`, html, true);
        if (!em.ok) console.error("[cron/conexao] email", p.email, em.error);
      }
      if (i < destinos.length - 1) await sleep(1200);
    }

    if (!destinos.length) {
      avisos.push(
        "Ninguém para avisar: defina ALERTAS_EMAIL e/ou ALERTAS_WHATSAPP, ou preencha o " +
          "telefone do consultor em Ajustes → Consultores.",
      );
    }

    relatorio.push({ consultor: c.nome, instancia: c.instancia_whatsapp, estado, alertou: true });
  }

  return NextResponse.json({
    ok: true,
    instancias: relatorio,
    ...(avisos.length ? { avisos: Array.from(new Set(avisos)) } : {}),
  });
}

export const POST = handler;
export const GET = handler;
