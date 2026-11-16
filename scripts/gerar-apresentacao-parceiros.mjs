// Gera a apresentação de parceria (PDF, 3 páginas A4, com links clicáveis e QR Code).
// Uso (na pasta painel-atendente):  node scripts/gerar-apresentacao-parceiros.mjs
// Saída: public/apresentacao-parceiros.pdf (é este arquivo que o painel envia pelo WhatsApp) e ../parcerias/APRESENTACAO-PARCEIROS.pdf
// Regras do COFFITO 424/2013: sem preço, sem promessa de resultado, sem depoimento, sem foto de paciente. Só serviços, formação
// e informações do consultório. Os serviços e técnicas são os mesmos publicados no site.
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://andersonandradefisio.com.br";
const SITE_QR = `${SITE}/?utm_source=parceria&utm_medium=pdf&utm_campaign=apresentacao`;
const INSTAGRAM = "https://www.instagram.com/andersonandrade_fisio/";
const YOUTUBE = "https://www.youtube.com/@andersonandradefisio";

const ESCURO = rgb(0x35 / 255, 0x47 / 255, 0x46 / 255);
const VERDE = rgb(0x0f / 255, 0x7f / 255, 0x70 / 255);
const TEAL = rgb(0x1e / 255, 0xb4 / 255, 0x9f / 255);
const CLARO = rgb(0.9, 0.96, 0.95);
const TEXTO = rgb(0.13, 0.16, 0.16);
const CINZA = rgb(0.38, 0.43, 0.42);
const BRANCO = rgb(1, 1, 1);

const W = 595.28;
const H = 841.89;
const M = 48;

const doc = await PDFDocument.create();
const reg = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

function quebra(texto, fonte, tam, max) {
  const out = [];
  let atual = "";
  for (const p of texto.split(/\s+/)) {
    const t = atual ? atual + " " + p : p;
    if (fonte.widthOfTextAtSize(t, tam) <= max) atual = t;
    else {
      out.push(atual);
      atual = p;
    }
  }
  if (atual) out.push(atual);
  return out;
}

function link(page, url, x, y, w, h) {
  const a = doc.context.register(
    doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, y, x + w, y + h], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } }),
  );
  const atual = page.node.get(PDFName.of("Annots"));
  if (atual && atual.push) atual.push(a);
  else page.node.set(PDFName.of("Annots"), doc.context.obj([a]));
}

function qr(page, texto, x, y, lado) {
  const q = QRCode.create(texto, { errorCorrectionLevel: "M" });
  const n = q.modules.size;
  const quiet = 2;
  const m = lado / (n + quiet * 2);
  page.drawRectangle({ x, y, width: lado, height: lado, color: BRANCO, borderColor: CLARO, borderWidth: 1 });
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (q.modules.get(r, c)) page.drawRectangle({ x: x + (c + quiet) * m, y: y + lado - (r + quiet + 1) * m, width: m + 0.15, height: m + 0.15, color: rgb(0, 0, 0) });
}

function faixa(page, titulo, sub) {
  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: ESCURO });
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 4, color: TEAL });
  page.drawText(titulo, { x: M, y: H - 46, size: 22, font: bold, color: BRANCO });
  if (sub) page.drawText(sub, { x: M, y: H - 68, size: 11, font: reg, color: rgb(0.8, 0.92, 0.9) });
}

function rodape(page, n) {
  page.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.6, color: CLARO });
  page.drawText("Anderson Simas Andrade · Fisioterapeuta · CREFITO-10 nº 89456-F · andersonandradefisio.com.br", { x: M, y: 30, size: 8.5, font: reg, color: CINZA });
  page.drawText(`${n}/3`, { x: W - M - 14, y: 30, size: 8.5, font: reg, color: CINZA });
}

function cursor(page, y0) {
  let y = y0;
  return {
    get y() {
      return y;
    },
    set y(v) {
      y = v;
    },
    titulo(t) {
      page.drawText(t, { x: M, y, size: 14, font: bold, color: VERDE });
      y -= 21;
    },
    par(t, tam = 11, cor = TEXTO, x = M, max = W - M * 2) {
      for (const l of quebra(t, reg, tam, max)) {
        page.drawText(l, { x, y, size: tam, font: reg, color: cor });
        y -= tam + 4.6;
      }
      y -= 5;
    },
    itens(lista, tam = 11) {
      for (const t of lista) {
        page.drawCircle({ x: M + 4, y: y + 3.6, size: 2.1, color: TEAL });
        for (const l of quebra(t, reg, tam, W - M * 2 - 18)) {
          page.drawText(l, { x: M + 16, y, size: tam, font: reg, color: TEXTO });
          y -= tam + 4.6;
        }
        y -= 2.5;
      }
      y -= 5;
    },
  };
}

// ---------------- Página 1: capa ----------------
{
  const p = doc.addPage([W, H]);
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.985, 0.995, 0.99) });
  p.drawRectangle({ x: 0, y: H - 330, width: W, height: 330, color: ESCURO });
  p.drawRectangle({ x: 0, y: H - 334, width: W, height: 4, color: TEAL });
  p.drawText("ANDERSON ANDRADE", { x: M, y: H - 78, size: 12, font: bold, color: TEAL });
  p.drawText("Fisioterapia e", { x: M, y: H - 150, size: 38, font: bold, color: BRANCO });
  p.drawText("terapia manual", { x: M, y: H - 194, size: 38, font: bold, color: BRANCO });
  p.drawText("Apresentação para parceiros", { x: M, y: H - 236, size: 15, font: reg, color: rgb(0.8, 0.92, 0.9) });
  p.drawText("Florianópolis · Centro e Capoeiras", { x: M, y: H - 258, size: 11.5, font: reg, color: rgb(0.8, 0.92, 0.9) });

  const c = cursor(p, H - 372);
  c.titulo("Quem sou");
  c.par("Anderson Simas Andrade, fisioterapeuta (CREFITO-10 nº 89456-F), com atendimento em Florianópolis. Meu trabalho é a avaliação individual e a terapia manual, com sessões de 60 minutos feitas por mim, do começo ao fim.");
  c.titulo("Para quem é esta apresentação");
  c.par("Para profissionais e espaços que cuidam de pessoas: estúdios de Pilates, academias, boxes, escolas de lutas, nutricionistas, clínicas e outros. A ideia é conhecer o seu trabalho, trocar informação e cuidar melhor de quem passa por todos nós, sem que ninguém tenha que mudar o que já faz bem.");

  // links
  const ly = 135;
  p.drawText("Conheça meu trabalho (toque nos links)", { x: M, y: ly + 118, size: 12, font: bold, color: VERDE });
  const itens = [
    ["Site", "andersonandradefisio.com.br", SITE],
    ["Instagram", "@andersonandrade_fisio", INSTAGRAM],
    ["YouTube", "youtube.com/@andersonandradefisio", YOUTUBE],
  ];
  let yy = ly + 92;
  for (const [rot, txt, url] of itens) {
    p.drawRectangle({ x: M, y: yy - 8, width: 300, height: 26, color: CLARO });
    p.drawText(rot, { x: M + 10, y: yy + 1, size: 11, font: bold, color: ESCURO });
    p.drawText(txt, { x: M + 82, y: yy + 1, size: 11, font: reg, color: VERDE });
    link(p, url, M, yy - 8, 300, 26);
    yy -= 32;
  }
  qr(p, SITE_QR, W - M - 130, ly - 6, 130);
  p.drawText("Aponte a câmera para abrir o site", { x: W - M - 138, y: ly - 20, size: 8.5, font: reg, color: CINZA });
  rodape(p, 1);
}

// ---------------- Página 2: serviços e como funciona ----------------
{
  const p = doc.addPage([W, H]);
  faixa(p, "O que faço e como funciona", "Serviços, técnicas e a consulta, em linguagem simples");
  const c = cursor(p, H - 128);
  c.titulo("Regiões que atendo");
  c.par("Coluna (lombar, cervical, hérnia de disco, dor ciática), ombro, cotovelo, punho e mão, quadril, joelho, pé e tornozelo. Cada plano começa pela avaliação, e o atendimento vale para todas as articulações.");
  c.titulo("Técnicas");
  c.itens([
    "Quiropraxia e osteopatia, aplicadas por fisioterapeuta, conforme a avaliação.",
    "Terapia manual: Conceito Maitland, Mulligan, Kabat e craniossacral.",
    "Orientações para o dia a dia, para o movimento e para o retorno à atividade.",
    "Atendimento domiciliar, mediante consulta.",
  ]);
  c.titulo("Como é a consulta");
  c.itens([
    "Cada sessão tem 60 minutos, com o próprio fisioterapeuta, e reúne a avaliação e as técnicas na mesma hora.",
    "Atendimento com hora marcada, em dois consultórios: Centro (Espaço Beira Mar, Sala 06, R. Altamiro Guimarães, 190) e Capoeiras (Rua Joaquim Carneiro, 207).",
    "A pessoa fala comigo pelo WhatsApp, escolhe o horário e recebe as orientações de chegada.",
  ]);

  // passo a passo
  c.titulo("O caminho do seu aluno ou cliente");
  const passos = [
    ["1", "Ele fala comigo", "pelo link ou QR Code do seu espaço, no WhatsApp."],
    ["2", "Agenda a avaliação", "no consultório mais próximo, com hora marcada."],
    ["3", "É avaliado e tratado", "em sessões individuais de 60 minutos."],
    ["4", "Você é informado", "com a autorização dele, eu devolvo uma orientação por escrito."],
  ];
  const y0 = c.y - 4;
  const larg = (W - M * 2 - 3 * 12) / 4;
  passos.forEach(([n, t, d], i) => {
    const x = M + i * (larg + 12);
    p.drawRectangle({ x, y: y0 - 104, width: larg, height: 104, color: CLARO });
    p.drawCircle({ x: x + 18, y: y0 - 20, size: 11, color: VERDE });
    p.drawText(n, { x: x + 14.5, y: y0 - 24, size: 12, font: bold, color: BRANCO });
    p.drawText(t, { x: x + 10, y: y0 - 48, size: 10.5, font: bold, color: ESCURO });
    let ty = y0 - 62;
    for (const l of quebra(d, reg, 9, larg - 18)) {
      p.drawText(l, { x: x + 10, y: ty, size: 9, font: reg, color: TEXTO });
      ty -= 12;
    }
  });
  c.y = y0 - 128;
  c.par("Informações com finalidade educativa. Cada pessoa é avaliada individualmente e os resultados variam de caso para caso.", 9, CINZA);
  rodape(p, 2);
}

// ---------------- Página 3: parceria ----------------
{
  const p = doc.addPage([W, H]);
  faixa(p, "Como podemos trabalhar juntos", "Uma parceria baseada em informação, cuidado e confiança");
  const c = cursor(p, H - 128);
  c.titulo("O que eu posso oferecer ao seu espaço");
  c.itens([
    "Conversa educativa gratuita (15 a 20 minutos) com seus alunos ou clientes: postura, dor nas costas, prevenção de lesões.",
    "Material informativo curto com sinais de alerta, para você repassar quando fizer sentido.",
    "Orientação por escrito sobre o caso do seu aluno, quando ele autoriza, para você acompanhar a evolução.",
    "Link e QR Code próprios do seu espaço: quem quiser falar comigo chega direto, e eu cuido do resto.",
    "Indicação de volta: quando um paciente meu precisar do seu serviço, é você que eu indico.",
  ]);
  c.titulo("Um combinado transparente");
  c.par("O código de ética da fisioterapia (COFFITO) não permite comissão, desconto nem qualquer vantagem por encaminhamento de pacientes. Por isso a parceria não envolve pagamento por indicação: ela se baseia em troca de conhecimento, respeito ao trabalho de cada um e cuidado com a pessoa. Quem decide procurar a fisioterapia é sempre o aluno ou o cliente.");
  c.titulo("Próximo passo: uma conversa rápida");
  c.par("Gostaria de marcar uma ligação ou um café de uns 10 a 15 minutos, no horário que for melhor para você, para conhecer o seu serviço, entender como posso cuidar bem das pessoas que você atende e saber como posso indicar o seu trabalho. Responda a mensagem com o melhor dia e horário.");

  // caixa de contato
  const by = 118;
  p.drawRectangle({ x: M, y: by, width: W - M * 2, height: 150, color: CLARO, borderColor: VERDE, borderWidth: 1 });
  p.drawText("Contato e redes", { x: M + 16, y: by + 124, size: 13, font: bold, color: VERDE });
  const linhas = [
    ["Site", "andersonandradefisio.com.br", SITE],
    ["Instagram", "@andersonandrade_fisio", INSTAGRAM],
    ["YouTube", "youtube.com/@andersonandradefisio", YOUTUBE],
  ];
  let ly = by + 98;
  for (const [rot, txt, url] of linhas) {
    p.drawText(rot, { x: M + 16, y: ly, size: 11, font: bold, color: ESCURO });
    p.drawText(txt, { x: M + 92, y: ly, size: 11, font: reg, color: VERDE });
    link(p, url, M + 16, ly - 4, 300, 18);
    ly -= 22;
  }
  p.drawText("WhatsApp do consultório: o link ou QR Code do seu espaço, ou o site.", { x: M + 16, y: by + 20, size: 10, font: reg, color: TEXTO });
  p.drawText("Atendimento com hora marcada.", { x: M + 16, y: by + 6, size: 10, font: reg, color: CINZA });
  qr(p, SITE_QR, W - M - 16 - 100, by + 24, 100);
  rodape(p, 3);
}

const bytes = await doc.save();
const base = process.cwd();
mkdirSync(join(base, "public"), { recursive: true });
mkdirSync(join(base, "..", "parcerias"), { recursive: true });
writeFileSync(join(base, "public", "apresentacao-parceiros.pdf"), bytes);
writeFileSync(join(base, "..", "parcerias", "APRESENTACAO-PARCEIROS.pdf"), bytes);
console.log("ok", bytes.length);
