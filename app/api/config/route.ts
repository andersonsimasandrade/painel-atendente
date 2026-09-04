import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { getPainelConfig, setPainelConfig } from "@/lib/db";
import type { HorarioBot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/config — config do painel (atendente + gatilhos + horário do bot). SÓ admin.
export async function GET() {
  if (!(await ehAdmin())) {
    return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  }
  const config = await getPainelConfig();
  return NextResponse.json({ ok: true, config });
}

// POST /api/config — atualização PARCIAL: só as chaves presentes no corpo são
// gravadas ({ atendente_nome?, assinar?, gatilhos?, horario_bot? }). SÓ admin.
//
// Gatilhos: lista VAZIA é recusada de propósito — sem gatilho nenhum o bot
// para de atender contato novo, e o sintoma ("parou de responder") é muito
// difícil de ligar de volta a esta tela.
export async function POST(req: Request) {
  if (!(await ehAdmin())) {
    return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  }

  const patch: {
    atendente_nome?: string | null;
    assinar?: boolean;
    gatilhos?: string[];
    horario_bot?: HorarioBot;
  } = {};

  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.atendente_nome !== undefined) {
      const nome = String(body.atendente_nome ?? "").trim().slice(0, 40);
      patch.atendente_nome = nome || null;
    }
    if (body.assinar !== undefined) {
      patch.assinar = body.assinar !== false;
    }

    if (body.gatilhos !== undefined) {
      if (!Array.isArray(body.gatilhos)) {
        return NextResponse.json({ ok: false, error: "Gatilhos inválidos." }, { status: 400 });
      }
      const limpos = body.gatilhos
        .map((g) => String(g ?? "").trim().slice(0, 200))
        .filter((g, i, arr) => g.length >= 3 && arr.indexOf(g) === i)
        .slice(0, 20);
      if (!limpos.length) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Deixe ao menos um gatilho — sem nenhum, o bot para de atender contato novo.",
          },
          { status: 400 },
        );
      }
      patch.gatilhos = limpos;
    }

    if (body.horario_bot !== undefined) {
      const hb = body.horario_bot as Record<string, unknown> | null;
      if (!hb || typeof hb !== "object") {
        return NextResponse.json({ ok: false, error: "Horário inválido." }, { status: 400 });
      }
      const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
      const dias = Array.isArray(hb.dias)
        ? Array.from(
            new Set(hb.dias.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
          ).sort()
        : [];
      const inicio = String(hb.inicio ?? "");
      const fim = String(hb.fim ?? "");
      const mensagem = String(hb.mensagem ?? "").trim().slice(0, 600);
      const ativo = hb.ativo === true;
      if (ativo) {
        if (!dias.length) {
          return NextResponse.json(
            { ok: false, error: "Escolha ao menos um dia de funcionamento." },
            { status: 400 },
          );
        }
        if (!HHMM.test(inicio) || !HHMM.test(fim)) {
          return NextResponse.json(
            { ok: false, error: "Horários no formato HH:MM (ex.: 08:00)." },
            { status: 400 },
          );
        }
        if (inicio >= fim) {
          return NextResponse.json(
            { ok: false, error: "O início precisa ser antes do fim." },
            { status: 400 },
          );
        }
        if (!mensagem) {
          return NextResponse.json(
            { ok: false, error: "Escreva a mensagem enviada fora do horário." },
            { status: 400 },
          );
        }
      }
      patch.horario_bot = {
        ativo,
        dias: dias.length ? dias : [1, 2, 3, 4, 5, 6],
        inicio: HHMM.test(inicio) ? inicio : "08:00",
        fim: HHMM.test(fim) ? fim : "17:30",
        mensagem,
      };
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, error: "Nada para salvar." }, { status: 400 });
  }

  const r = await setPainelConfig(patch);
  if (!r.ok) return NextResponse.json(r, { status: 500 });
  return NextResponse.json({ ok: true, config: patch });
}
