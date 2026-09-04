import { NextResponse } from "next/server";
import {
  reunioesDeHoje,
  diretoriaWhatsApp,
  diretoriaEmail,
  consultorWhatsApp,
  consultorEmail,
} from "@/lib/digest";
import { hojeSP } from "@/lib/trafego";
import { enviarEmail } from "@/lib/email";
import { enviarTextoInstancia } from "@/lib/evolution";
import { destinatariosAlerta, instanciaAlertas, empresaNome } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


// POST/GET /api/cron/agenda-digest?tipo=diretoria|consultor[&dry=1]
// Bearer CRON_SECRET. 6h diretoria (visão geral + sugestão de comparecimento);
// 8h consultor — CADA consultor ativo recebe a agenda DELE.
// Envia por e-mail + WhatsApp para os responsáveis configurados.
//
// Dois valores de `tipo`: sem parâmetro (ou qualquer coisa diferente de
// "consultor") manda a visão geral para os responsáveis; `tipo=consultor`
// manda, para cada consultor ativo, a agenda dele.
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const tipoBruto = url.searchParams.get("tipo") || "diretoria";
  const tipo = tipoBruto;
  const dry = url.searchParams.get("dry") === "1";
  if (tipo !== "diretoria" && tipo !== "consultor") {
    return NextResponse.json(
      { ok: false, error: "tipo inválido (diretoria|consultor)" },
      { status: 400 },
    );
  }

  const hoje = hojeSP();
  const { reunioes, vendedores } = await reunioesDeHoje();

  if (tipo === "consultor") {
    const ativos = [...vendedores.values()].filter((v) => v.ativo);
    if (!ativos.length) {
      return NextResponse.json({ ok: false, tipo, error: "nenhum consultor ativo" }, { status: 502 });
    }

    const relatorio: {
      consultor: string;
      reunioes: number;
      enviados: number;
      skipped?: string;
      texto?: string;
    }[] = [];

    for (let i = 0; i < ativos.length; i++) {
      const v = ativos[i];
      // Agenda DELE — inclusive quando está vazia: "hoje você não tem reunião"
      // é informação útil, e o silêncio seria confundido com falha do sistema.
      const dele = reunioes.filter((r) => r.vendedorSlug === v.slug);
      const texto = consultorWhatsApp(v.nome, dele, hoje);
      const html = consultorEmail(v.nome, dele, hoje);

      if (dry) {
        relatorio.push({ consultor: v.nome, reunioes: dele.length, enviados: 0, texto });
        continue;
      }
      if (!v.telefone_dono && !v.email_dono) {
        relatorio.push({
          consultor: v.nome,
          reunioes: dele.length,
          enviados: 0,
          skipped: "sem telefone_dono/email_dono",
        });
        continue;
      }

      let enviados = 0;
      if (v.email_dono) {
        const em = await enviarEmail(v.email_dono, `Sua agenda de hoje — ${empresaNome()}`, html);
        if (em.ok) enviados++;
        else console.error("[digest/consultor]", v.slug, "email", em.error);
        await sleep(1200);
      }
      const instConsultor = instanciaAlertas() || v.instancia_whatsapp;
      if (v.telefone_dono && instConsultor) {
        const wa = await enviarTextoInstancia(instConsultor, v.telefone_dono, texto);
        if (wa.ok) enviados++;
        else console.error("[digest/consultor]", v.slug, "whatsapp", wa.error);
      }
      relatorio.push({ consultor: v.nome, reunioes: dele.length, enviados });
      if (i < ativos.length - 1) await sleep(1500);
    }

    if (dry) return NextResponse.json({ ok: true, dry: true, tipo, consultores: relatorio });
    // Um consultor sem contato cadastrado não é falha do cron; falha é ninguém
    // ter recebido nada.
    const totalEnviados = relatorio.reduce((s, r) => s + r.enviados, 0);
    return NextResponse.json(
      { ok: totalEnviados > 0, tipo, consultores: relatorio },
      { status: totalEnviados > 0 ? 200 : 502 },
    );
  }

  // diretoria
  const texto = diretoriaWhatsApp(reunioes, hoje);
  const html = diretoriaEmail(reunioes, hoje);
  if (dry) return NextResponse.json({ ok: true, dry: true, tipo, reunioes: reunioes.length, texto });

  const destinos = destinatariosAlerta();
  if (!destinos.length) {
    // Ninguém configurado não é falha: o cron cumpriu o papel dele.
    return NextResponse.json({
      ok: true,
      tipo,
      reunioes: reunioes.length,
      enviados: 0,
      aviso: "Nenhum destinatário configurado (defina ALERTAS_EMAIL e/ou ALERTAS_WHATSAPP).",
    });
  }

  const instancia = instanciaAlertas();
  let enviados = 0;
  for (let i = 0; i < destinos.length; i++) {
    const p = destinos[i];
    if (p.email) {
      const em = await enviarEmail(p.email, `Agenda de hoje — ${empresaNome()}`, html);
      if (!em.ok) console.error("[digest/responsaveis] email", p.email, em.error);
      else enviados++;
      await sleep(1200);
    }
    if (p.whatsapp && instancia) {
      const wa = await enviarTextoInstancia(instancia, p.whatsapp, texto);
      if (!wa.ok) console.error("[digest/responsaveis] whatsapp", p.whatsapp, wa.error);
      else enviados++;
    }
    if (i < destinos.length - 1) await sleep(1500);
  }
  const status = enviados === 0 ? 502 : 200;
  return NextResponse.json({ ok: enviados > 0, tipo, reunioes: reunioes.length, enviados }, { status });
}

export const POST = handler;
export const GET = handler;
