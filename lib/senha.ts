// SENHA PRÓPRIA DE CADA USUÁRIO DO PAINEL. Só guarda o "hash" (embaralhado, sem volta) com scrypt e um sal aleatório:
// nem o dono do banco consegue ler a senha. Server-only.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as unknown as (senha: string, sal: Buffer, tamanho: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const TAM = 64;

export const SENHA_MIN = 8;
export const SENHA_MAX = 100;

/** Mensagem de erro em português se a senha nova não serve; null se está boa. */
export function validarSenhaNova(senha: string): string | null {
  if (senha.length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  if (/^(.)\1+$/.test(senha)) return "Escolha uma senha menos óbvia (não repita o mesmo caractere).";
  if (/^(0123456789|1234567890|12345678|123456789|87654321|abcdefgh|qwertyui|password|senha123|12341234)/i.test(senha) && senha.length <= 12)
    return "Essa senha é muito fácil de adivinhar. Misture letras e números.";
  return null;
}

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(senha, sal, TAM, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${h.toString("base64")}`;
}

const SAL_FALSO = Buffer.alloc(16, 7);

/** Confere a senha. Se não houver hash, faz o mesmo trabalho mesmo assim (o tempo de resposta não revela se o e-mail existe). */
export async function verificarSenha(senha: string, guardado: string | null | undefined): Promise<boolean> {
  const partes = String(guardado ?? "").split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") {
    await scrypt(senha, SAL_FALSO, TAM, { N, r: R, p: P }).catch(() => undefined);
    return false;
  }
  try {
    const n = Number(partes[1]);
    const r = Number(partes[2]);
    const p = Number(partes[3]);
    const sal = Buffer.from(partes[4], "base64");
    const esperado = Buffer.from(partes[5], "base64");
    const h = await scrypt(senha, sal, esperado.length, { N: n, r, p });
    return h.length === esperado.length && timingSafeEqual(new Uint8Array(h), new Uint8Array(esperado));
  } catch {
    return false;
  }
}
