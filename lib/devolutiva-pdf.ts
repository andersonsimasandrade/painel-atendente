// PDF da devolutiva (papel timbrado, assinatura, QR codes e consultórios), gerado no servidor para baixar ou mandar pelo WhatsApp
// sem depender do link. Mesmo conteúdo do documento da página; layout próprio para A4. Server-only.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CONSULTORIOS, CREFITO, HORARIO_TEXTO, INSTAGRAM, MARCA, PROFISSIONAL, SITE_HOST, SITE_URL, SLOGAN, whatsappNumero } from "./site";
import { formatPhone } from "./format";
import type { DevolutivaPublica } from "./devolutivas";

const VERDE = rgb(0.118, 0.706, 0.624);
const ESCURO = rgb(0.208, 0.278, 0.275);
const TEXTO = rgb(0.247, 0.329, 0.322);
const MUDO = rgb(0.369, 0.451, 0.443);
const LINHA = rgb(0.847, 0.894, 0.882);
const FUNDO = rgb(0.961, 0.973, 0.969);

const W = 595.28;
const H = 841.89;
const M = 44;
const AREA = W - 2 * M;
const TOPO = H - 46;
const BASE = 54;

const dataBR = (iso: string) => {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00-03:00`) : new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
};

export async function gerarPdfDevolutiva(d: DevolutivaPublica, assinaturaB64: string | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(d.titulo);
  doc.setAuthor(PROFISSIONAL);
  doc.setCreator(MARCA);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([W, H]);
  let y = TOPO;
  const nova = () => {
    page = doc.addPage([W, H]);
    y = TOPO;
  };
  const garantir = (h: number) => {
    if (y - h < BASE) nova();
  };

  // Só caracteres que a fonte padrão do PDF sabe escrever (acentos do português estão incluídos).
  const SUBST: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "✓": "", "\t": " ", "\r": "" };
  const limpa = (font: PDFFont, t: string) =>
    [...t]
      .map((ch) => {
        if (ch === "\n") return ch;
        if (ch in SUBST) return SUBST[ch];
        try {
          font.encodeText(ch);
          return ch;
        } catch {
          return "";
        }
      })
      .join("");

  const quebrar = (font: PDFFont, size: number, texto: string, larg: number): string[] => {
    const out: string[] = [];
    for (const par of limpa(font, texto).split("\n")) {
      if (!par.trim()) {
        out.push("");
        continue;
      }
      let atual = "";
      for (const palavra of par.split(/\s+/)) {
        const tenta = atual ? `${atual} ${palavra}` : palavra;
        if (font.widthOfTextAtSize(tenta, size) <= larg || !atual) atual = tenta;
        else {
          out.push(atual);
          atual = palavra;
        }
      }
      if (atual) out.push(atual);
    }
    return out;
  };

  const paragrafo = (t: string, o: { size?: number; font?: PDFFont; cor?: ReturnType<typeof rgb>; x?: number; larg?: number; gap?: number } = {}) => {
    const size = o.size ?? 10.5;
    const font = o.font ?? f;
    const x = o.x ?? M;
    for (const linha of quebrar(font, size, t, o.larg ?? AREA)) {
      garantir(size * 1.42);
      if (linha) page.drawText(linha, { x, y: y - size, size, font, color: o.cor ?? TEXTO });
      y -= size * 1.42;
    }
    y -= o.gap ?? 6;
  };

  const secao = (titulo: string, quebra = false) => {
    if (quebra && y < TOPO - 1) nova();
    else y -= 14;
    garantir(52);
    page.drawText(limpa(fb, titulo), { x: M, y: y - 13, size: 13, font: fb, color: ESCURO });
    y -= 19;
    page.drawLine({ start: { x: M, y }, end: { x: M + AREA, y }, thickness: 0.7, color: LINHA });
    y -= 9;
  };

  // ── Papel timbrado ─────────────────────────────────────────────────────────
  try {
    const logo = await doc.embedPng(await readFile(path.join(process.cwd(), "public", "img", "simbolo.png")));
    page.drawImage(logo, { x: M, y: y - 38, width: 38, height: 38 });
  } catch {
    /* sem o símbolo, segue só com o texto */
  }
  page.drawText(limpa(fb, MARCA), { x: M + 50, y: y - 16, size: 13.5, font: fb, color: ESCURO });
  page.drawText(limpa(f, SLOGAN), { x: M + 50, y: y - 31, size: 9.5, font: f, color: MUDO });
  y -= 46;
  page.drawLine({ start: { x: M, y }, end: { x: M + AREA, y }, thickness: 1.6, color: VERDE });
  y -= 20;

  paragrafo(d.titulo, { size: 22, font: fb, cor: ESCURO, gap: 2 });
  paragrafo(`${d.primeiroNome ? `Para ${d.primeiroNome} · ` : ""}${dataBR(d.criado_em)} · ${PROFISSIONAL} · ${CREFITO}`, { size: 9.5, cor: MUDO, gap: 4 });

  if (d.relato) {
    secao("O que você nos contou");
    paragrafo(d.relato);
  }
  if (d.exames.length) {
    secao("O que os seus exames descrevem");
    for (const e of d.exames) {
      paragrafo(`${e.titulo}${e.data ? `   ${dataBR(e.data)}` : ""}`, { font: fb, cor: ESCURO, gap: 2 });
      paragrafo(e.resumo, { gap: 9 });
    }
    paragrafo("Resumo do que o laudo descreve. O que cada achado significa no seu caso é visto junto com a avaliação clínica.", { size: 9, cor: MUDO });
  }
  if (d.achados) {
    secao("O que encontramos na avaliação");
    paragrafo(d.achados);
  }
  if (d.plano) {
    secao("Plano de cuidado", true);
    paragrafo(d.plano);
  }

  // ── Gráfico da dor ─────────────────────────────────────────────────────────
  if (d.mostrar_dor && d.dor.length) {
    secao("Como a sua dor tem evoluído");
    paragrafo("Nota de 0 (sem dor) a 10 (a pior dor), registrada em cada sessão.", { size: 9.5, cor: MUDO, gap: 4 });
    garantir(150);
    const gx = M + 24;
    const gw = AREA - 34;
    const gh = 100;
    const gy = y - gh - 4; // base do gráfico
    const n = d.dor.length;
    const px = (i: number) => gx + (n === 1 ? gw / 2 : (i * gw) / (n - 1));
    const py = (v: number) => gy + (v * gh) / 10;
    for (const v of [0, 2, 4, 6, 8, 10]) {
      page.drawLine({ start: { x: gx, y: py(v) }, end: { x: gx + gw, y: py(v) }, thickness: 0.5, color: LINHA });
      page.drawText(String(v), { x: gx - 14, y: py(v) - 3, size: 8, font: f, color: MUDO });
    }
    const serie = (pegar: (p: (typeof d.dor)[number]) => number | null) => d.dor.map((p, i) => ({ i, v: pegar(p) })).filter((q): q is { i: number; v: number } => q.v != null);
    const traco = (s: { i: number; v: number }[], cor: ReturnType<typeof rgb>, esp: number, r: number) => {
      for (let k = 1; k < s.length; k++) page.drawLine({ start: { x: px(s[k - 1].i), y: py(s[k - 1].v) }, end: { x: px(s[k].i), y: py(s[k].v) }, thickness: esp, color: cor });
      for (const q of s) page.drawCircle({ x: px(q.i), y: py(q.v), size: r, color: cor });
    };
    traco(serie((p) => p.inicio), VERDE, 1.8, 3.2);
    traco(serie((p) => p.fim), ESCURO, 1.3, 2.6);
    d.dor.forEach((p, i) => page.drawText(dataBR(p.data).slice(0, 5), { x: px(i) - 10, y: gy - 12, size: 7.5, font: f, color: MUDO }));
    y = gy - 20;
    page.drawCircle({ x: M + 4, y: y - 3, size: 3, color: VERDE });
    page.drawText("início da sessão", { x: M + 12, y: y - 6, size: 8.5, font: f, color: MUDO });
    page.drawCircle({ x: M + 104, y: y - 3, size: 2.6, color: ESCURO });
    page.drawText("fim da sessão", { x: M + 112, y: y - 6, size: 8.5, font: f, color: MUDO });
    y -= 16;
  }

  if (d.prescricao_codigo) {
    secao("Exercícios para fazer em casa");
    paragrafo("Preparei um plano de exercícios com vídeos para você continuar o cuidado em casa:", { gap: 2 });
    paragrafo(`${SITE_URL}/exercicios/${d.prescricao_codigo}`, { cor: VERDE, font: fb });
  }
  if (d.observacoes) {
    secao("Observações");
    paragrafo(d.observacoes);
  }

  // ── Assinatura ─────────────────────────────────────────────────────────────
  garantir(110);
  y -= 30;
  const meio = AREA / 2;
  const local = `Florianópolis/SC${d.local ? `, ${CONSULTORIOS[d.local].bairro}` : ""} · ${dataBR(d.data_sessao ?? d.criado_em)}`;
  page.drawText(limpa(f, local), { x: M, y: y + 4, size: 10.5, font: f, color: ESCURO });
  page.drawLine({ start: { x: M, y }, end: { x: M + meio - 20, y }, thickness: 0.8, color: ESCURO });
  page.drawText("Local e data", { x: M, y: y - 12, size: 8.5, font: f, color: MUDO });
  const sx = M + meio + 10;
  if (assinaturaB64) {
    try {
      const img = await doc.embedPng(Buffer.from(assinaturaB64, "base64"));
      const hAss = 44;
      page.drawImage(img, { x: sx + 4, y: y + 2, width: (hAss * img.width) / img.height, height: hAss });
    } catch {
      /* sem a assinatura, fica só a linha */
    }
  }
  page.drawLine({ start: { x: sx, y }, end: { x: M + AREA, y }, thickness: 0.8, color: ESCURO });
  page.drawText(limpa(fb, PROFISSIONAL), { x: sx, y: y - 12, size: 9.5, font: fb, color: ESCURO });
  page.drawText(limpa(f, `Fisioterapeuta · ${CREFITO}`), { x: sx, y: y - 24, size: 8.5, font: f, color: MUDO });
  y -= 44;

  // ── Rodapé: contato, QR codes e consultórios ──────────────────────────────
  const caixaH = 194;
  garantir(caixaH + 40);
  y -= 8;
  const topoCaixa = y;
  page.drawRectangle({ x: M, y: y - caixaH, width: AREA, height: caixaH, color: FUNDO, borderColor: LINHA, borderWidth: 0.8 });
  page.drawText(limpa(fb, MARCA), { x: M + 12, y: y - 20, size: 11.5, font: fb, color: ESCURO });
  const desc = quebrar(f, 8.5, `${SLOGAN} Terapia manual com osteopatia, quiropraxia, Maitland, Mulligan, Kabat e craniossacral, com hora marcada e atendimento individual.`, AREA - 24);
  desc.slice(0, 2).forEach((l, i) => page.drawText(l, { x: M + 12, y: y - 33 - i * 11, size: 8.5, font: f, color: MUDO }));

  const qr = async (url: string, x: number, yTopo: number, tam: number) => {
    const q = (QRCode as unknown as { create: (t: string, o: object) => { modules: { size: number; get: (r: number, c: number) => number } } }).create(url, { errorCorrectionLevel: "M" });
    const nq = q.modules.size;
    const c = tam / nq;
    page.drawRectangle({ x: x - 3, y: yTopo - tam - 3, width: tam + 6, height: tam + 6, color: rgb(1, 1, 1), borderColor: LINHA, borderWidth: 0.6 });
    for (let r = 0; r < nq; r++) for (let k = 0; k < nq; k++) if (q.modules.get(r, k)) page.drawRectangle({ x: x + k * c, y: yTopo - (r + 1) * c, width: c + 0.15, height: c + 0.15, color: ESCURO });
  };
  const yQr = y - 50;
  const wa = `https://wa.me/${whatsappNumero()}`;
  await qr(wa, M + 14, yQr, 56);
  page.drawText("WhatsApp", { x: M + 22, y: yQr - 70, size: 8, font: fb, color: ESCURO });
  await qr(`${SITE_URL}/agendar`, M + 90, yQr, 56);
  page.drawText("Agendar sessão", { x: M + 90, y: yQr - 70, size: 8, font: fb, color: ESCURO });

  const cx = M + 190;
  const linhas: [string, string][] = [
    ["WhatsApp: ", formatPhone(whatsappNumero()).replace(/^\+55\s*/, "")],
    ["Site: ", SITE_HOST],
    ["Instagram: ", `@${INSTAGRAM}`],
    ["Facebook: ", "/andersonandradefisio"],
    ["YouTube: ", "@andersonandradefisio"],
  ];
  linhas.forEach(([r, v], i) => {
    page.drawText(limpa(fb, r), { x: cx, y: yQr - 12 - i * 13, size: 9, font: fb, color: ESCURO });
    page.drawText(limpa(f, v), { x: cx + fb.widthOfTextAtSize(limpa(fb, r), 9) + 3, y: yQr - 12 - i * 13, size: 9, font: f, color: TEXTO });
  });

  const yc = topoCaixa - 138;
  page.drawLine({ start: { x: M + 12, y: yc + 10 }, end: { x: M + AREA - 12, y: yc + 10 }, thickness: 0.5, color: LINHA });
  (["capoeiras", "centro"] as const).forEach((k, i) => {
    const x = M + 12 + i * (AREA / 2 - 6);
    const c = CONSULTORIOS[k];
    page.drawText(limpa(fb, c.nome), { x, y: yc - 4, size: 8.5, font: fb, color: ESCURO });
    quebrar(f, 8, c.linhaEndereco, AREA / 2 - 30).forEach((l, j) => page.drawText(l, { x, y: yc - 15 - j * 10, size: 8, font: f, color: TEXTO }));
    page.drawText(limpa(f, c.complemento), { x, y: yc - 15 - quebrar(f, 8, c.linhaEndereco, AREA / 2 - 30).length * 10, size: 8, font: f, color: MUDO });
  });
  page.drawText(limpa(f, HORARIO_TEXTO), { x: M + 12, y: topoCaixa - caixaH + 9, size: 8, font: f, color: MUDO });
  y = topoCaixa - caixaH - 12;

  paragrafo(
    "Este documento é informativo, foi feito para o seu caso e não substitui a consulta. Não traz promessa de resultado. Você pode compartilhá-lo com outros profissionais de saúde que cuidam de você.",
    { size: 8.5, cor: MUDO },
  );

  // Numeração das páginas
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    const t = `${i + 1}/${paginas.length}`;
    p.drawText(t, { x: W - M - f.widthOfTextAtSize(t, 8), y: 28, size: 8, font: f, color: MUDO });
  });

  return doc.save();
}
