// Telefone brasileiro e o problema do NONO DÍGITO.
//
// O WhatsApp entrega o JID de muitos números antigos SEM o 9 extra
// (55 51 9240-8820 = 12 dígitos), enquanto a pessoa digita COM ele
// (55 51 99240-8820 = 13 dígitos). O bot grava a forma do JID; formulários
// gravam a forma digitada. Sem casar as duas, o mesmo lead vira dois cadastros,
// o histórico se parte em duas conversas e o gate de agendamento rejeita quem
// é lead de verdade.
//
// Estas funções são PURAS (sem I/O) e testadas em docs/scripts/telefone.test.mjs.

export function soDigitos(s: string | null | undefined): string {
  return String(s ?? "").replace(/\D/g, "");
}

/**
 * Todas as formas pelas quais ESTE número pode estar gravado no sistema.
 * Sempre inclui o próprio número; acrescenta a variante com/sem o 9 quando o
 * formato é de celular brasileiro. Ordem: a forma recebida primeiro.
 *
 *   "5511999998888" -> ["5511999998888", "551199998888"]
 *   "551199998888"  -> ["551199998888", "5511999998888"]
 *   "5511999998888" -> ["5511999998888", "551199998888"]
 */
export function variantesTelefone(tel: string | null | undefined): string[] {
  const d = soDigitos(tel);
  if (!d) return [];
  const out = [d];

  // Só mexe em número brasileiro (55 + DDD de 2 dígitos).
  if (!d.startsWith("55")) return out;
  const ddd = d.slice(2, 4);
  const local = d.slice(4);

  if (local.length === 9 && local.startsWith("9")) {
    // 13 dígitos (com o 9 extra) -> forma legada de 12
    out.push(`55${ddd}${local.slice(1)}`);
  } else if (local.length === 8 && /^[6-9]/.test(local)) {
    // 12 dígitos de CELULAR (local começa em 6-9) -> forma nova de 13.
    // Fixo (local começa em 2-5) não ganha o 9 — seria um número inexistente.
    out.push(`55${ddd}9${local}`);
  }
  return out;
}

/**
 * Forma canônica p/ COMPARAR dois telefones (sem o 9 extra). Use só para
 * igualdade — nunca para enviar mensagem ou gravar.
 */
export function telefoneCanonico(tel: string | null | undefined): string {
  const vs = variantesTelefone(tel);
  if (!vs.length) return "";
  // A menor variante é a forma legada (sem o 9).
  return vs.reduce((a, b) => (b.length < a.length ? b : a));
}

/** true se os dois números são a mesma pessoa (tolerando o 9º dígito). */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = telefoneCanonico(a);
  return !!ca && ca === telefoneCanonico(b);
}
