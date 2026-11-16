// Gera a apresentação de 1 página (A4) enviada a quem aceita conhecer a parceria.
// Uso (na pasta painel-atendente):  node scripts/gerar-apresentacao-parceiros.mjs
// Saída: ../parcerias/APRESENTACAO-PARCEIROS.pdf
// Sem preço, sem promessa de resultado, sem depoimento (COFFITO 424/2013).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SAIDA = join(process.cwd(), "..", "parcerias");
mkdirSync(SAIDA, { recursive: true });

const VERDE = rgb(0.06, 0.32, 0.22);
const TEXTO = rgb(0.09, 0.12, 0.11);
const CINZA = rgb(0.38, 0.42, 0.4);
const CLARO = rgb(0.9, 0.96, 0.93);

const doc = await PDFDocument.create();
const W = 595.28;
const H = 841.89;
const page = doc.addPage([W, H]);
const reg = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const M = 44;

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

let y = H;
page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: VERDE });
page.drawText("Fisioterapia e terapia manual", { x: M, y: H - 44, size: 22, font: bold, color: rgb(1, 1, 1) });
page.drawText("Apresentação para parceiros e profissionais da saúde e do movimento", { x: M, y: H - 66, size: 11.5, font: reg, color: rgb(0.85, 0.95, 0.9) });
y = H - 130;

function titulo(t) {
  page.drawText(t, { x: M, y, size: 14, font: bold, color: VERDE });
  y -= 20;
}
function paragrafo(t, tam = 11) {
  for (const l of quebra(t, reg, tam, W - M * 2)) {
    page.drawText(l, { x: M, y, size: tam, font: reg, color: TEXTO });
    y -= tam + 4.5;
  }
  y -= 6;
}
function itens(lista) {
  for (const t of lista) {
    const ls = quebra(t, reg, 11, W - M * 2 - 16);
    page.drawCircle({ x: M + 4, y: y + 3.5, size: 2, color: VERDE });
    for (const l of ls) {
      page.drawText(l, { x: M + 16, y, size: 11, font: reg, color: TEXTO });
      y -= 15.5;
    }
    y -= 2;
  }
  y -= 6;
}

titulo("Quem sou");
paragrafo("Anderson Simas Andrade, fisioterapeuta (CREFITO-10 nº 89456-F). Atendo em Florianópolis, em dois consultórios: Centro (Espaço Beira Mar, Sala 06) e Capoeiras (Rua Joaquim Carneiro, 207). Meu trabalho é a avaliação individual e a terapia manual para dor e limitação de movimento.");

titulo("Como posso ajudar o seu público");
itens([
  "Avaliação individual para quem chega com dor ou limitação que foge do que a sua atividade pode tratar.",
  "Orientação por escrito sobre o caso, quando o paciente autoriza, para você acompanhar a evolução.",
  "Conversa educativa gratuita (15 a 20 minutos) com os seus alunos ou clientes, sobre postura, dor nas costas ou prevenção de lesões.",
  "Material informativo curto com sinais de alerta, para você repassar quando fizer sentido.",
]);

titulo("Como funciona a indicação");
itens([
  "Você passa um link (ou QR Code) só do seu espaço. A pessoa fala comigo pelo WhatsApp do consultório e eu cuido do restante.",
  "Eu nunca atendo o seu cliente sem ele querer: quem decide é ele.",
  "Respeito o seu trabalho: não substituo a sua atividade, complemento quando há dor ou lesão.",
  "Os dados do paciente são tratados com sigilo e conforme a LGPD.",
]);

titulo("Um combinado importante");
paragrafo("O código de ética da fisioterapia (COFFITO) não permite comissão, desconto nem qualquer vantagem por encaminhamento. Por isso a parceria é baseada em informação, troca de conhecimento e cuidado com a pessoa, nunca em pagamento por indicação.");

// Contato
const cy = 150;
page.drawRectangle({ x: M, y: cy - 32, width: W - M * 2, height: 140, color: CLARO, borderColor: VERDE, borderWidth: 1 });
page.drawText("Contato", { x: M + 16, y: cy + 82, size: 13, font: bold, color: VERDE });
const linhas = [
  "WhatsApp: pelo link ou QR Code do seu espaço (ou no site)",
  "Site: andersonandradefisio.com.br",
  "Instagram: @andersonandrade_fisio",
  "Centro: R. Altamiro Guimarães, 190, Espaço Beira Mar, Sala 06",
  "Capoeiras: Rua Joaquim Carneiro, 207 (dentro da Estética Arlete)",
  "Atendimento com hora marcada.",
];
let ly = cy + 62;
for (const l of linhas) {
  page.drawText(l, { x: M + 16, y: ly, size: 10.5, font: reg, color: TEXTO });
  ly -= 15;
}
page.drawText("Anderson Simas Andrade · Fisioterapeuta · CREFITO-10 nº 89456-F", { x: M, y: 70, size: 9.5, font: reg, color: CINZA });

writeFileSync(join(SAIDA, "APRESENTACAO-PARCEIROS.pdf"), await doc.save());
console.log("ok");
