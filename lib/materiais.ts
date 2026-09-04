/**
 * Materiais prontos do inbox: os arquivos que o time manda com um clique na
 * tela de Conversas — de preferência os MESMOS que o robô envia sozinho.
 *
 * Eles vão por URL pública, não por upload: assim não passam pelo limite de
 * tamanho de corpo da requisição, e um PDF de 8 MB funciona igual a um de 200 KB.
 *
 * >>> ADAPTE: liste aqui os PDFs do seu negócio (catálogo, tabela de preços,
 *     proposta, condições). Suba os arquivos onde preferir — Supabase Storage,
 *     um bucket S3, uma pasta pública — e cole o link DIRETO para o arquivo.
 *     Com a lista vazia, o botão de materiais simplesmente não aparece. <<<
 *
 * Exemplo:
 *   { rotulo: "Catálogo", url: "https://exemplo.com/catalogo.pdf", fileName: "Catalogo.pdf" }
 *
 *   rotulo   — o que aparece escrito no botão
 *   url      — link direto e público para o arquivo
 *   fileName — o nome com que o cliente recebe o arquivo no WhatsApp
 */
export interface Material {
  rotulo: string;
  url: string;
  fileName: string;
}

export const MATERIAIS: ReadonlyArray<Material> = [];
