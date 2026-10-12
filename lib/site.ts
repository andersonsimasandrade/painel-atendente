// Dados públicos do site (anderson­andradefisio.com.br). Tudo aqui é informação
// que já aparece nos anúncios e no Google Meu Negócio — não há segredo.
// Mudou endereço, horário ou texto? Altere SÓ este arquivo.

export const SITE_HOST = "andersonandradefisio.com.br";
export const SITE_URL = `https://${SITE_HOST}`;

export const MARCA = "Anderson Andrade Fisio";
export const PROFISSIONAL = "Anderson Simas Andrade";
export const CREFITO = "CREFITO-10 nº 89456-F";
export const INSTAGRAM = "andersonandrade_fisio";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM}/`;

/** Quem atende no WhatsApp do site HOJE: o próprio Anderson, direto no número
 *  dele, sem robô (o número do robô foi banido em 12/10/2026). Quando o robô
 *  voltar: ASSISTENTE_ATIVO = true e WHATSAPP_PADRAO = número do robô. */
export const ASSISTENTE_ATIVO = false;
export const WHATSAPP_PADRAO = "5548984223242";

/** Número do WhatsApp do site. Só dígitos, com DDI. SITE_WHATSAPP (env) sobrepõe. */
export function whatsappNumero(): string {
  return (process.env.SITE_WHATSAPP ?? "").replace(/\D/g, "") || WHATSAPP_PADRAO;
}

export type ConsultorioId = "capoeiras" | "centro";

export interface Consultorio {
  id: ConsultorioId;
  nome: string;
  bairro: string;
  linhaEndereco: string;
  cep: string | null;
  complemento: string;
  mapaUrl: string;
  comoChegar: string[];
}

export const CONSULTORIOS: Record<ConsultorioId, Consultorio> = {
  capoeiras: {
    id: "capoeiras",
    nome: "Consultório Capoeiras",
    bairro: "Capoeiras",
    linhaEndereco: "Rua Joaquim Carneiro, 207 — Capoeiras, Florianópolis/SC",
    cep: "88085-120",
    complemento: "Dentro da Estética Arlete",
    mapaUrl: "https://maps.app.goo.gl/pXTEfzfJ7HohzvcT8",
    comoChegar: [
      "Fica dentro da Estética Arlete, na Rua Joaquim Carneiro, 207.",
      "Atendimento com hora marcada: combine o horário antes pelo WhatsApp.",
    ],
  },
  centro: {
    id: "centro",
    nome: "Consultório Centro",
    bairro: "Centro",
    linhaEndereco: "R. Altamiro Guimarães, 190 — Espaço Beira Mar, Sala 06, Centro, Florianópolis/SC",
    cep: null,
    complemento: "Espaço Beira Mar, Sala 06",
    mapaUrl:
      "https://www.google.com/maps/search/?api=1&query=R.+Altamiro+Guimar%C3%A3es%2C+190%2C+Florian%C3%B3polis%2C+SC",
    comoChegar: [
      "Espaço Beira Mar, Sala 06, na R. Altamiro Guimarães, 190.",
      "Atendimento com hora marcada: combine o horário antes pelo WhatsApp.",
    ],
  },
};

export const HORARIO_TEXTO = "Segunda a sexta, das 8h às 19h";

export const DIAS = [
  { id: "seg", nome: "Segunda" },
  { id: "ter", nome: "Terça" },
  { id: "qua", nome: "Quarta" },
  { id: "qui", nome: "Quinta" },
  { id: "sex", nome: "Sexta" },
] as const;

export const PERIODOS = [
  { id: "manha", nome: "Manhã", detalhe: "8h às 12h" },
  { id: "tarde", nome: "Tarde", detalhe: "12h às 17h" },
  { id: "fim-do-dia", nome: "Fim do dia", detalhe: "17h às 19h" },
] as const;

export const CANAIS_VALIDOS = ["google", "meta", "organico", "direto", "outro"] as const;
export type CanalSite = (typeof CANAIS_VALIDOS)[number];

/** Descobre de qual canal veio o visitante a partir do que o navegador guardou
 *  na chegada (gclid, fbclid, utm_*, referrer). Roda no SERVIDOR: o navegador
 *  não decide sozinho. */
export function derivarCanal(o: {
  gclid?: string | null;
  fbclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  referrer?: string | null;
}): CanalSite {
  const src = (o.utm_source ?? "").toLowerCase();
  const med = (o.utm_medium ?? "").toLowerCase();
  const ref = (o.referrer ?? "").toLowerCase();
  if (o.gclid) return "google";
  if (o.fbclid) return "meta";
  if (src === "google" && (med === "cpc" || med === "ppc" || med === "paid")) return "google";
  if (["facebook", "fb", "instagram", "ig", "meta"].includes(src)) return "meta";
  if (src === "google" || ref.includes("google.")) return "organico";
  if (src) return "outro";
  if (ref.includes("instagram.com") || ref.includes("facebook.com")) return "meta";
  if (ref) return "organico";
  return "direto";
}

export function nomeDosDias(ids: string[]): string {
  const nomes = DIAS.filter((d) => ids.includes(d.id)).map((d) => d.nome.toLowerCase());
  if (nomes.length === 0) return "";
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
}
