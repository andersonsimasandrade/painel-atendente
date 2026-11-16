// Gera os totens (A5, para imprimir) com QR Code do WhatsApp e do site, um por consultório e por chamada.
// Uso (na pasta painel-atendente):  node scripts/gerar-totem.mjs
// Saída: ../parcerias/totem/TOTEM-<consultorio>-<chamada>.pdf
// Regras do COFFITO 424/2013 respeitadas: sem preço, sem promessa de resultado, sem depoimento, sem foto de paciente.
// Só nome, profissão, CREFITO, endereço e horário (art. 48).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://andersonandradefisio.com.br";
const SAIDA = join(process.cwd(), "..", "parcerias", "totem");
mkdirSync(SAIDA, { recursive: true });

const LOCAIS = [
  {
    id: "centro",
    codigo: "totem-centro",
    nome: "Consultório Centro",
    endereco: ["Espaço Beira Mar, Sala 06", "R. Altamiro Guimarães, 190 · Centro · Florianópolis/SC"],
  },
  {
    id: "capoeiras",
    codigo: "totem-capoeiras",
    nome: "Consultório Capoeiras",
    endereco: ["Dentro da Estética Arlete", "Rua Joaquim Carneiro, 207 · Capoeiras · Florianópolis/SC"],
  },
];

const CHAMADAS = [
  { id: "a-dor", titulo: ["Você está com dor?", "Converse com um fisioterapeuta."], sub: "Tire suas dúvidas pelo WhatsApp. Sem pressa e sem compromisso." },
  { id: "corpo-pede", titulo: ["Seu corpo pede atenção?", "Vamos conversar sobre isso."], sub: "Fisioterapia com terapia manual, com hora marcada. Pergunte pelo WhatsApp." },
  { id: "coluna-articulacoes", titulo: ["Dor nas costas, no pescoço", "ou nas articulações?"], sub: "Uma avaliação individual pode ajudar a entender o que está acontecendo." },
];

const VERDE = rgb(0.06, 0.32, 0.22);
const VERDE_CLARO = rgb(0.9, 0.96, 0.93);
const TEXTO = rgb(0.09, 0.12, 0.11);
const CINZA = rgb(0.38, 0.42, 0.4);

function quebra(texto, fonte, tam, larguraMax) {
  const palavras = texto.split(/\s+/);
  const linhas = [];
  let atual = "";
  for (const p of palavras) {
    const t = atual ? atual + " " + p : p;
    if (fonte.widthOfTextAtSize(t, tam) <= larguraMax) atual = t;
    else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function desenhaQr(page, texto, x, y, lado) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2; // margem em módulos
  const m = lado / (n + quiet * 2);
  page.drawRectangle({ x, y, width: lado, height: lado, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        page.drawRectangle({ x: x + (c + quiet) * m, y: y + lado - (r + quiet + 1) * m, width: m + 0.15, height: m + 0.15, color: rgb(0, 0, 0) });
      }
    }
  }
}

async function gera(local, chamada) {
  const doc = await PDFDocument.create();
  const W = 419.53;
  const H = 595.28; // A5
  const page = doc.addPage([W, H]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Faixa superior
  page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: VERDE });
  page.drawText("FISIOTERAPIA E TERAPIA MANUAL", { x: 28, y: H - 38, size: 11.5, font: bold, color: rgb(1, 1, 1) });
  page.drawText(local.nome, { x: 28, y: H - 54, size: 9.5, font: reg, color: rgb(0.85, 0.95, 0.9) });

  // Chamada
  let y = H - 118;
  for (const l of chamada.titulo) {
    page.drawText(l, { x: 28, y, size: 24, font: bold, color: TEXTO });
    y -= 30;
  }
  y -= 4;
  for (const l of quebra(chamada.sub, reg, 12.5, W - 56)) {
    page.drawText(l, { x: 28, y, size: 12.5, font: reg, color: CINZA });
    y -= 17;
  }

  // QR Codes
  const lado = 150;
  const topo = y - 22;
  const xs = [28 + (W - 56 - lado * 2 - 22) / 2, 28 + (W - 56 - lado * 2 - 22) / 2 + lado + 22];
  const itens = [
    { titulo: "WhatsApp", dica: "Aponte a câmera do celular", url: `${SITE}/p/${local.codigo}` },
    { titulo: "Site", dica: "Veja como funciona a consulta", url: `${SITE}/?utm_source=totem&utm_medium=qr&utm_campaign=${local.id}` },
  ];
  itens.forEach((it, i) => {
    const x = xs[i];
    page.drawRectangle({ x: x - 8, y: topo - lado - 52, width: lado + 16, height: lado + 52 + 8, color: VERDE_CLARO, borderColor: VERDE, borderWidth: 1 });
    const w = bold.widthOfTextAtSize(it.titulo, 13);
    page.drawText(it.titulo, { x: x + (lado - w) / 2, y: topo - 2, size: 13, font: bold, color: VERDE });
    desenhaQr(page, it.url, x, topo - lado - 10, lado);
    const wd = reg.widthOfTextAtSize(it.dica, 8.5);
    page.drawText(it.dica, { x: x + (lado - wd) / 2, y: topo - lado - 32, size: 8.5, font: reg, color: CINZA });
  });

  // Rodapé
  const base = 118;
  page.drawLine({ start: { x: 28, y: base }, end: { x: W - 28, y: base }, thickness: 0.8, color: VERDE });
  page.drawText("Anderson Simas Andrade", { x: 28, y: base - 20, size: 13, font: bold, color: TEXTO });
  page.drawText("Fisioterapeuta · CREFITO-10 nº 89456-F", { x: 28, y: base - 35, size: 10.5, font: reg, color: CINZA });
  let yy = base - 56;
  for (const l of local.endereco) {
    page.drawText(l, { x: 28, y: yy, size: 10, font: reg, color: TEXTO });
    yy -= 14;
  }
  page.drawText("Atendimento com hora marcada. Combine o horário pelo WhatsApp.", { x: 28, y: yy - 2, size: 9.5, font: reg, color: CINZA });

  const bytes = await doc.save();
  const arq = join(SAIDA, `TOTEM-${local.id}-${chamada.id}.pdf`);
  writeFileSync(arq, bytes);
  console.log("ok", arq);
}

for (const l of LOCAIS) for (const c of CHAMADAS) await gera(l, c);
