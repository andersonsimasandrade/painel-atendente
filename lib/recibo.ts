// RECIBO DA FISIOTERAPIA: emitido e enviado pelo WhatsApp DEPOIS da sessão (presença confirmada) e só se o pagamento foi recebido
// (se a sessão for cancelada ou estornada, não há recibo). Cada sessão tem a "caixinha" de enviar ou não o recibo. Tudo fica
// registrado na tabela `recibos`, para o Anderson saber quantos foram e mandar para a contabilidade. Server-only.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { canalDaConversa } from "./consultores";
import { enviarMidiaWhatsApp } from "./evolution";
import { registrarNaConversa } from "./confirmacao-envio";
import { assinaturaProfissional } from "./devolutivas";
import { valorDaSessao } from "./asaas";
import { CONSULTORIOS, CREFITO, MARCA, PROFISSIONAL, SLOGAN } from "./site";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ── Valor por extenso ────────────────────────────────────────────────────────
const U = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(C[c]);
  if (r > 0) {
    if (r < 20) partes.push(U[r]);
    else partes.push(r % 10 ? `${D[Math.floor(r / 10)]} e ${U[r % 10]}` : D[Math.floor(r / 10)]);
  }
  return partes.join(" e ");
}

export function valorPorExtenso(v: number): string {
  const reais = Math.floor(v);
  const cent = Math.round((v - reais) * 100);
  const partes: string[] = [];
  if (reais > 0) {
    let txt: string;
    if (reais >= 1000) {
      const mil = Math.floor(reais / 1000);
      const resto = reais % 1000;
      const milTxt = mil === 1 ? "mil" : `${ate999(mil)} mil`;
      txt = resto ? `${milTxt}${resto < 100 || resto % 100 === 0 ? " e " : " "}${ate999(resto)}` : milTxt;
    } else txt = ate999(reais);
    partes.push(`${txt} ${reais === 1 ? "real" : "reais"}`);
  }
  if (cent > 0) partes.push(`${ate999(cent)} ${cent === 1 ? "centavo" : "centavos"}`);
  return partes.join(" e ") || "zero real";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const cpfFmt = (d: string) => (d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d);
const numFmt = (n: number) => String(n).padStart(6, "0");

// ── PDF ──────────────────────────────────────────────────────────────────────
export interface DadosRecibo {
  numero: number;
  nome: string;
  cpf: string | null;
  valor: number;
  dataSessao: string; // AAAA-MM-DD
  local: "capoeiras" | "centro" | null;
  emitidoEm: string; // ISO
}

export async function gerarPdfRecibo(d: DadosRecibo, assinaturaB64: string | null): Promise<Uint8Array> {
  const ESCURO = rgb(0.208, 0.278, 0.275);
  const TEXTO = rgb(0.247, 0.329, 0.322);
  const MUDO = rgb(0.369, 0.451, 0.443);
  const VERDE = rgb(0.118, 0.706, 0.624);
  const doc = await PDFDocument.create();
  doc.setTitle(`Recibo ${numFmt(d.numero)}`);
  doc.setAuthor(PROFISSIONAL);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 56;
  const page = doc.addPage([W, H]);
  let y = H - 52;

  const limpa = (font: PDFFont, t: string) =>
    [...t]
      .map((ch) => {
        try {
          font.encodeText(ch);
          return ch;
        } catch {
          return "";
        }
      })
      .join("");
  const quebrar = (font: PDFFont, size: number, texto: string, larg: number) => {
    const out: string[] = [];
    let atual = "";
    for (const p of limpa(font, texto).split(/\s+/)) {
      const t = atual ? `${atual} ${p}` : p;
      if (font.widthOfTextAtSize(t, size) <= larg || !atual) atual = t;
      else {
        out.push(atual);
        atual = p;
      }
    }
    if (atual) out.push(atual);
    return out;
  };

  try {
    const logo = await doc.embedPng(await readFile(path.join(process.cwd(), "public", "img", "simbolo.png")));
    page.drawImage(logo, { x: M, y: y - 38, width: 38, height: 38 });
  } catch {
    /* sem o símbolo, só o texto */
  }
  page.drawText(limpa(fb, MARCA), { x: M + 50, y: y - 16, size: 13, font: fb, color: ESCURO });
  page.drawText(limpa(f, SLOGAN), { x: M + 50, y: y - 31, size: 9.5, font: f, color: MUDO });
  y -= 48;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.6, color: VERDE });
  y -= 46;

  page.drawText("RECIBO", { x: M, y, size: 26, font: fb, color: ESCURO });
  const num = `Nº ${numFmt(d.numero)}`;
  page.drawText(num, { x: W - M - fb.widthOfTextAtSize(num, 14), y: y + 4, size: 14, font: fb, color: ESCURO });
  y -= 22;
  page.drawText(limpa(f, `Valor: ${brl(d.valor)}`), { x: M, y, size: 15, font: fb, color: VERDE });
  y -= 36;

  const local = d.local ? `, no ${CONSULTORIOS[d.local].nome}` : "";
  const texto =
    `Recebi de ${d.nome}${d.cpf ? `, CPF ${cpfFmt(d.cpf)}` : ""}, a importância de ${brl(d.valor)} (${valorPorExtenso(d.valor)}), ` +
    `referente a 1 (uma) sessão de fisioterapia realizada em ${dataBR(d.dataSessao)}${local}.`;
  for (const l of quebrar(f, 12, texto, W - 2 * M)) {
    page.drawText(l, { x: M, y, size: 12, font: f, color: TEXTO });
    y -= 19;
  }
  y -= 8;
  page.drawText("Por ser verdade, firmo o presente recibo.", { x: M, y, size: 12, font: f, color: TEXTO });
  y -= 54;
  const emitido = new Date(d.emitidoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
  page.drawText(`Florianópolis/SC, ${emitido}`, { x: M, y, size: 11.5, font: f, color: ESCURO });
  y -= 70;

  if (assinaturaB64) {
    try {
      const img = await doc.embedPng(Buffer.from(assinaturaB64, "base64"));
      const h = 46;
      page.drawImage(img, { x: M + 6, y: y + 2, width: (h * img.width) / img.height, height: h });
    } catch {
      /* fica só a linha */
    }
  }
  page.drawLine({ start: { x: M, y }, end: { x: M + 250, y }, thickness: 0.8, color: ESCURO });
  page.drawText(limpa(fb, PROFISSIONAL), { x: M, y: y - 14, size: 10.5, font: fb, color: ESCURO });
  page.drawText(limpa(f, `Fisioterapeuta · ${CREFITO}`), { x: M, y: y - 27, size: 9.5, font: f, color: MUDO });
  const cpfProf = (process.env.PROFISSIONAL_CPF ?? "").replace(/\D/g, "");
  if (cpfProf.length === 11) page.drawText(`CPF ${cpfFmt(cpfProf)}`, { x: M, y: y - 40, size: 9.5, font: f, color: MUDO });

  return doc.save();
}

// ── Emissão e envio ──────────────────────────────────────────────────────────
interface Ag {
  id: string;
  telefone_lead: string;
  data_hora: string;
  local: string | null;
  status: string;
  enviar_recibo: boolean;
}

async function carregarAg(id: string): Promise<Ag | null> {
  const r = await getClient().from("agendamentos").select("id, telefone_lead, data_hora, local, status, enviar_recibo").eq("id", id).limit(1);
  return (r.data?.[0] as Ag | undefined) ?? null;
}

const diaSP = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Regra do recibo: roda quando a presença é confirmada E quando o pagamento chega (o que vier por último).
 *  - sessão sem presença confirmada: nada;  - "sem recibo" marcado: registra como dispensado;
 *  - pagamento ainda não recebido: espera;   - tudo certo: emite e envia.
 */
export async function processarRecibo(agendamentoId: string): Promise<{ feito: boolean; motivo?: string }> {
  const sb = getClient();
  const ag = await carregarAg(agendamentoId);
  if (!ag || ag.status !== "compareceu") return { feito: false, motivo: "sem presença confirmada" };
  const ja = await sb.from("recibos").select("estado").eq("agendamento_id", agendamentoId).limit(1);
  if (ja.data?.length) return { feito: false, motivo: "já registrado" };
  const cb = await sb.from("cobrancas").select("asaas_id, valor, status").eq("agendamento_id", agendamentoId).neq("status", "CANCELADA").limit(1);
  const cobranca = cb.data?.[0] as { asaas_id: string; valor: number; status: string } | undefined;
  const valor = cobranca ? Number(cobranca.valor) : valorDaSessao();

  if (!ag.enviar_recibo) {
    await sb.from("recibos").insert({ agendamento_id: ag.id, telefone: ag.telefone_lead, valor, data_sessao: diaSP(ag.data_hora), local: ag.local, estado: "dispensado", cobranca_asaas_id: cobranca?.asaas_id ?? null });
    return { feito: true, motivo: "dispensado" };
  }
  if (!cobranca || cobranca.status !== "RECEIVED") return { feito: false, motivo: "pagamento ainda não recebido" };
  const r = await emitirEEnviar(ag, valor, cobranca.asaas_id);
  return r.ok ? { feito: true } : { feito: false, motivo: r.error };
}

/** Botão do painel: emite e envia o recibo agora (também para quem pagou fora do Asaas). */
export async function enviarReciboManual(agendamentoId: string): Promise<R> {
  const ag = await carregarAg(agendamentoId);
  if (!ag) return { ok: false, error: "Sessão não encontrada." };
  if (ag.status !== "compareceu") return { ok: false, error: "Confirme primeiro que o paciente compareceu." };
  const sb = getClient();
  const ex = await sb.from("recibos").select("id, estado").eq("agendamento_id", agendamentoId).limit(1);
  const antigo = ex.data?.[0] as { id: string; estado: string } | undefined;
  if (antigo?.estado === "enviado") return { ok: false, error: "O recibo desta sessão já foi enviado." };
  const cb = await sb.from("cobrancas").select("asaas_id, valor").eq("agendamento_id", agendamentoId).neq("status", "CANCELADA").limit(1);
  const cobranca = cb.data?.[0] as { asaas_id: string; valor: number } | undefined;
  return emitirEEnviar(ag, cobranca ? Number(cobranca.valor) : valorDaSessao(), cobranca?.asaas_id ?? null, antigo?.id);
}

async function emitirEEnviar(ag: Ag, valor: number, asaasId: string | null, reciboId?: string): Promise<R> {
  const sb = getClient();
  const ct = await sb.from("ff_contatos").select("telefone, nome, cnpj_numero").in("telefone", variantesTelefone(ag.telefone_lead)).limit(5);
  const linhas = (ct.data ?? []) as { telefone: string; nome: string | null; cnpj_numero: string | null }[];
  const c = linhas.find((x) => String(x.cnpj_numero ?? "").replace(/\D/g, "").length === 11) ?? linhas[0];
  const nome = (c?.nome ?? "").trim();
  if (!nome) return { ok: false, error: "Falta o nome do paciente no cadastro." };
  const cpfDigitos = String(c?.cnpj_numero ?? "").replace(/\D/g, "");
  const cpf = cpfDigitos.length === 11 ? cpfDigitos : null;

  let numero: number;
  let id = reciboId;
  const base = { telefone: ag.telefone_lead, nome, cpf, valor, data_sessao: diaSP(ag.data_hora), local: ag.local, cobranca_asaas_id: asaasId };
  if (id) {
    const u = await sb.from("recibos").update({ ...base, estado: "emitido", emitido_em: new Date().toISOString() }).eq("id", id).select("numero");
    if (u.error || !u.data?.length) return { ok: false, error: "Não consegui registrar o recibo." };
    numero = Number((u.data[0] as { numero: number }).numero);
  } else {
    const i = await sb.from("recibos").insert({ ...base, agendamento_id: ag.id, estado: "emitido" }).select("id, numero");
    if (i.error || !i.data?.length) return { ok: false, error: "Não consegui registrar o recibo." };
    id = String((i.data[0] as { id: string }).id);
    numero = Number((i.data[0] as { numero: number }).numero);
  }

  const local = ag.local === "capoeiras" || ag.local === "centro" ? ag.local : null;
  const bytes = await gerarPdfRecibo({ numero, nome, cpf, valor, dataSessao: diaSP(ag.data_hora), local, emitidoEm: new Date().toISOString() }, await assinaturaProfissional());
  const primeiro = nome.split(/\s+/)[0];
  const arquivo = `Recibo ${numFmt(numero)} - ${primeiro}.pdf`;
  const caption = `Olá, ${primeiro}! Segue o recibo da sua sessão de fisioterapia do dia ${dataBR(diaSP(ag.data_hora))}. Obrigado! 🙂`;
  const canal = await canalDaConversa(ag.telefone_lead);
  const e = await enviarMidiaWhatsApp(ag.telefone_lead, { mediatype: "document", mimetype: "application/pdf", media: Buffer.from(bytes).toString("base64"), fileName: arquivo, caption }, canal.instancia);
  if (!e.ok) return { ok: false, error: `O recibo nº ${numFmt(numero)} foi emitido, mas não consegui enviar pelo WhatsApp: ${e.error ?? ""}` };
  await sb.from("recibos").update({ estado: "enviado", enviado_em: new Date().toISOString() }).eq("id", id);
  await registrarNaConversa(ag.telefone_lead, [`📄 ${arquivo}\n${caption}`], "sistema");
  return { ok: true };
}

/** Caixinha "enviar recibo depois da sessão" de cada sessão. */
export async function definirEnviarRecibo(agendamentoId: string, enviar: boolean): Promise<R> {
  const r = await getClient().from("agendamentos").update({ enviar_recibo: enviar }).eq("id", agendamentoId).select("id");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Sessão não encontrada." };
}

// ── Registro para a contabilidade ───────────────────────────────────────────
export interface LinhaRecibo {
  numero: number;
  nome: string | null;
  cpf: string | null;
  valor: number;
  data_sessao: string;
  estado: string;
  emitido_em: string;
  enviado_em: string | null;
}

export async function listarRecibos(mes: string): Promise<LinhaRecibo[]> {
  const [a, m] = mes.split("-").map(Number);
  const ini = new Date(Date.UTC(a, m - 1, 1, 3)).toISOString();
  const fim = new Date(Date.UTC(a, m, 1, 3)).toISOString();
  const r = await getClient().from("recibos").select("numero, nome, cpf, valor, data_sessao, estado, emitido_em, enviado_em").gte("emitido_em", ini).lt("emitido_em", fim).order("numero", { ascending: false }).limit(1000);
  return ((r.data ?? []) as Record<string, unknown>[]).map((x) => ({
    numero: Number(x.numero),
    nome: (x.nome as string | null) ?? null,
    cpf: (x.cpf as string | null) ?? null,
    valor: Number(x.valor),
    data_sessao: String(x.data_sessao),
    estado: String(x.estado),
    emitido_em: String(x.emitido_em),
    enviado_em: (x.enviado_em as string | null) ?? null,
  }));
}

export function csvRecibos(linhas: LinhaRecibo[]): string {
  const cab = ["Número", "Emitido em", "Sessão", "Paciente", "CPF", "Valor (R$)", "Situação", "Enviado ao paciente em"];
  const dh = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
  const rotulo: Record<string, string> = { enviado: "Enviado", emitido: "Emitido (não enviado)", dispensado: "Dispensado (sem recibo)" };
  const lin = linhas.map((l) => [numFmt(l.numero), dh(l.emitido_em), dataBR(l.data_sessao), l.nome ?? "", l.cpf ? cpfFmt(l.cpf) : "", l.valor.toFixed(2).replace(".", ","), rotulo[l.estado] ?? l.estado, dh(l.enviado_em)]);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return "﻿" + [cab, ...lin].map((r) => r.map(esc).join(";")).join("\r\n");
}
