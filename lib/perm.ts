// Permissões por papel. Um 'vendedor' só acessa suas seções de trabalho (leads,
// agenda, conversas, prioridades) e as APIs que essas telas usam — nada de
// dashboard geral, tráfego, ajustes ou conexão. PURA (Edge + client).

// Páginas liberadas pro vendedor. /conexao entra porque o vendedor é quem
// percebe primeiro que o WhatsApp caiu ("os leads pararam") — e precisa poder
// reler o QR pra religar o próprio número de trabalho.
const VENDEDOR_PAGINAS = ["/leads", "/agenda", "/conversas", "/prioridades", "/conexao", "/atendimento", "/funil"];
// APIs que essas páginas consomem.
const VENDEDOR_APIS = [
  "/api/conversas",
  "/api/conversa",
  "/api/prioridades",
  "/api/lead",
  "/api/agenda",
  "/api/respostas-rapidas",
  "/api/fechar",
  "/api/evolution", // status + connect (QR) da própria instância
];

const bate = (path: string, p: string) => path === p || path.startsWith(p + "/");

export function vendedorPodeAcessar(pathname: string): boolean {
  return (
    VENDEDOR_PAGINAS.some((p) => bate(pathname, p)) || VENDEDOR_APIS.some((p) => bate(pathname, p))
  );
}

// Não existe uma segunda lista de "abas só de admin": duas fontes de verdade
// para permissão de menu é como se esconde ou se expõe a aba errada sem
// ninguém perceber. A permissão do menu vive só na flag `admin` de cada item
// em components/NavLinks.tsx; esta lista aqui é a do servidor (middleware).
