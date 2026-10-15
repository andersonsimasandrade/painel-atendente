// Depoimentos de pacientes que podem aparecer no site.
//
// REGRA (Resolução COFFITO 532/2021): só entra aqui o texto de quem AUTORIZOU por escrito
// (Termo de Consentimento Livre e Esclarecido). Sem nome nem iniciais, a menos que a pessoa
// tenha autorizado a identificação. Cada item leva a data e, se possível, o link da avaliação
// original. Sem promessa de resultado: não entram relatos de "cura" ou "resultado garantido".
export type Depoimento = {
  /** Como a pessoa autorizou ser identificada (ex.: "Paciente" ou "Neusa F."). */
  nome: string;
  texto: string;
  /** Data do depoimento, em texto (ex.: "outubro de 2026"). */
  data: string;
  /** Link da avaliação original no Google, para conferência (opcional). */
  link?: string;
};

export const DEPOIMENTOS_AUTORIZADOS: Depoimento[] = [];
