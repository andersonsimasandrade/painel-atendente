// Resumos diários da agenda: 6h para os responsáveis (visão de todos os
// consultores + sugestão de acompanhamento) e 8h por consultor (a agenda do
// dia dele). Server-only.
// Reusa os resumos de IA já gravados (resumo_ia/temperatura_ia) — sem custo extra.
import { getClient } from "./db";
import { hojeSP, addDias } from "./trafego";
import { empresaNome } from "./config";
import { horaSP } from "./lembretes";
import { formatBRL, maskPhone } from "./format";

// Acima deste valor, o resumo sugere que um gerente sênior acompanhe a reunião.
// Zero = desligado (só a temperatura "quente" dispara a sugestão).
// >>> ADAPTE ao ticket médio do seu negócio <<<
const VALOR_SENIOR = 0;

export interface ReuniaoDigest {
  vendedorSlug: string;
  vendedorNome: string;
  telefone: string;
  hora: string; // HH:MM SP
  data_hora: string; // ISO
  lead: string;
  resumo: string | null;
  temperatura: string | null;
  valor: number | null;
  proximaAcao: string | null;
}

type AgRow = {
  telefone_lead: string;
  nome_lead: string | null;
  data_hora: string;
  vendedor_id: string;
};
type VendRow = {
  id: string;
  slug: string;
  nome: string;
  instancia_whatsapp: string;
  telefone_dono: string | null;
  email_dono: string | null;
  ativo: boolean | null;
};
type ContatoRow = {
  telefone: string;
  nome: string | null;
  resumo_ia: string | null;
  temperatura_ia: string | null;
  valor_investimento: number | null;
  proxima_acao_ia: string | null;
};

export interface Vendedor {
  slug: string;
  nome: string;
  instancia_whatsapp: string;
  telefone_dono: string | null;
  email_dono: string | null;
  ativo: boolean;
}

// Reuniões de HOJE (fuso SP), status ativo, enriquecidas com o resumo de IA.
export async function reunioesDeHoje(): Promise<{ reunioes: ReuniaoDigest[]; vendedores: Map<string, Vendedor> }> {
  const s = getClient();
  const hoje = hojeSP();
  const ini = `${hoje}T00:00:00-03:00`;
  const fim = `${addDias(hoje, 1)}T00:00:00-03:00`;

  const [ag, vend] = await Promise.all([
    s
      .from("agendamentos")
      .select("telefone_lead, nome_lead, data_hora, vendedor_id")
      .in("status", ["agendado", "confirmado"])
      .gte("data_hora", ini)
      .lt("data_hora", fim)
      .order("data_hora", { ascending: true }),
    s.from("vendedores").select("id, slug, nome, instancia_whatsapp, telefone_dono, email_dono, ativo"),
  ]);

  const vmap = new Map<string, Vendedor>();
  const vById = new Map<string, VendRow>();
  for (const v of ((vend.data ?? []) as unknown as VendRow[])) {
    vById.set(v.id, v);
    vmap.set(v.slug, {
      slug: v.slug,
      nome: v.nome,
      instancia_whatsapp: v.instancia_whatsapp,
      telefone_dono: v.telefone_dono,
      email_dono: v.email_dono,
      ativo: v.ativo !== false,
    });
  }

  const rows = (ag.data ?? []) as unknown as AgRow[];
  const telefones = [...new Set(rows.map((r) => r.telefone_lead))];
  const cmap = new Map<string, ContatoRow>();
  if (telefones.length) {
    const cont = await s
      .from("ff_contatos")
      .select("telefone, nome, resumo_ia, temperatura_ia, valor_investimento, proxima_acao_ia")
      .in("telefone", telefones);
    for (const c of ((cont.data ?? []) as unknown as ContatoRow[])) cmap.set(c.telefone, c);
  }

  const reunioes: ReuniaoDigest[] = rows.map((r) => {
    const v = vById.get(r.vendedor_id);
    const c = cmap.get(r.telefone_lead);
    return {
      vendedorSlug: v?.slug ?? "—",
      vendedorNome: v?.nome ?? "—",
      telefone: r.telefone_lead,
      hora: horaSP(r.data_hora),
      data_hora: r.data_hora,
      lead: (c?.nome || r.nome_lead || "Lead sem nome").trim(),
      resumo: c?.resumo_ia ?? null,
      temperatura: c?.temperatura_ia ?? null,
      valor: c?.valor_investimento ?? null,
      proximaAcao: c?.proxima_acao_ia ?? null,
    };
  });

  return { reunioes, vendedores: vmap };
}

// ── Sugestão de comparecimento (PURA) ──────────────────────────────────────
export function sugestaoComparecimento(r: ReuniaoDigest): string {
  const quente = (r.temperatura ?? "").toLowerCase() === "quente";
  const altoValor = (r.valor ?? 0) >= VALOR_SENIOR;
  if (quente || altoValor) return "💡 Vale um gerente sênior acompanhar.";
  return `${r.vendedorNome} conduz.`;
}

const dataBR = (hoje: string) => {
  const [y, m, d] = hoje.split("-");
  return `${d}/${m}/${y}`;
};
const linhaResumo = (r: ReuniaoDigest) => (r.resumo ? ` — ${r.resumo.trim().slice(0, 160)}` : "");

// ── Composição do resumo dos responsáveis (PURA) ───────────────────────────
export function diretoriaWhatsApp(reunioes: ReuniaoDigest[], hoje: string): string {
  const linhas = [`*${empresaNome()} · Agenda de hoje — ${dataBR(hoje)}*`, ``];
  if (!reunioes.length) {
    linhas.push("Nenhuma reunião marcada para hoje.");
    return linhas.join("\n");
  }
  linhas.push(`${reunioes.length} reunião(ões) hoje:`, ``);
  for (const r of reunioes) {
    linhas.push(
      `⏰ *${r.hora}* · ${r.lead} (${r.vendedorNome})${linhaResumo(r)}`,
      `   ${sugestaoComparecimento(r)}`,
    );
  }
  return linhas.join("\n");
}

export function diretoriaEmail(reunioes: ReuniaoDigest[], hoje: string): string {
  const rows = reunioes.length
    ? reunioes
        .map(
          (r) =>
            `<tr><td style="padding:8px 10px;font-size:13px;white-space:nowrap"><b>${r.hora}</b></td><td style="padding:8px 10px;font-size:13px">${esc(r.lead)} <span style="color:#6b7280">· ${esc(r.vendedorNome)}</span>${r.temperatura ? ` · ${esc(r.temperatura)}` : ""}${r.resumo ? `<br><span style="color:#4b5563;font-size:12px">${esc(r.resumo)}</span>` : ""}<br><span style="color:#b45309;font-size:12px">${esc(sugestaoComparecimento(r))}</span>${r.valor ? `<br><span style="color:#6b7280;font-size:11px">Investimento citado: ${formatBRL(r.valor)}</span>` : ""}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="2" style="padding:10px;color:#9ca3af;font-size:13px">Nenhuma reunião marcada para hoje.</td></tr>`;
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#0f1b14">
    <h2 style="margin:0 0 4px;font-size:18px">${empresaNome()} · Agenda de hoje</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#6b7280">${dataBR(hoje)} · ${reunioes.length} reunião(ões)</p>
    <table style="width:100%;border-collapse:collapse;background:#f6faf7;border-radius:10px;overflow:hidden">${rows}</table>
    <p style="margin:16px 0 0;font-size:11px;color:#9ca3af">Sugestão de comparecimento: leads quentes ou de alto valor merecem um gerente sênior. Resumos gerados por IA — confira antes.</p>
  </div>`;
}

// ── Composição CONSULTOR (PURA) ────────────────────────────────────────────
export function consultorWhatsApp(nome: string, reunioes: ReuniaoDigest[], hoje: string): string {
  const linhas = [`*Bom dia, ${nome}! Sua agenda de hoje — ${dataBR(hoje)}*`, ``];
  if (!reunioes.length) {
    linhas.push("Nenhuma reunião marcada para hoje. 👊");
    return linhas.join("\n");
  }
  for (const r of reunioes) {
    linhas.push(`⏰ *${r.hora}* · ${r.lead} (${maskPhone(r.telefone)})${linhaResumo(r)}`);
    if (r.proximaAcao) linhas.push(`   ➜ ${r.proximaAcao.trim().slice(0, 140)}`);
  }
  return linhas.join("\n");
}

export function consultorEmail(nome: string, reunioes: ReuniaoDigest[], hoje: string): string {
  const rows = reunioes.length
    ? reunioes
        .map(
          (r) =>
            `<tr><td style="padding:8px 10px;font-size:13px;white-space:nowrap"><b>${r.hora}</b></td><td style="padding:8px 10px;font-size:13px">${esc(r.lead)}${r.temperatura ? ` <span style="color:#6b7280">· ${esc(r.temperatura)}</span>` : ""}${r.resumo ? `<br><span style="color:#4b5563;font-size:12px">${esc(r.resumo)}</span>` : ""}${r.proximaAcao ? `<br><span style="color:#166534;font-size:12px">➜ ${esc(r.proximaAcao)}</span>` : ""}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="2" style="padding:10px;color:#9ca3af;font-size:13px">Nenhuma reunião marcada para hoje.</td></tr>`;
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#0f1b14">
    <h2 style="margin:0 0 4px;font-size:18px">Bom dia, ${esc(nome)}!</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#6b7280">Sua agenda de hoje · ${dataBR(hoje)}</p>
    <table style="width:100%;border-collapse:collapse;background:#f6faf7;border-radius:10px;overflow:hidden">${rows}</table>
  </div>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

