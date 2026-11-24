import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { gravarSenha, usuarioParaSenha } from "@/lib/magiclink";
import { rateLimited } from "@/lib/ratelimit";
import { hashSenha, validarSenhaNova, verificarSenha } from "@/lib/senha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/conta/senha → { email, temSenha }  (para a tela "Minha senha")
// POST /api/conta/senha { atual?, nova } → troca a senha de quem está logado (pede a atual se já existir uma).
export async function GET() {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  if (!sess.email) return NextResponse.json({ ok: true, email: null, temSenha: false });
  const u = await usuarioParaSenha(sess.email);
  return NextResponse.json({ ok: true, email: sess.email, temSenha: !!u?.hash });
}

export async function POST(req: Request) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  if (!sess.email) {
    return NextResponse.json({ ok: false, error: "Você entrou com a senha geral do servidor. Saia e entre pelo seu e-mail para ter uma senha própria." }, { status: 400 });
  }
  if (await rateLimited(`trocasenha:${sess.email}`, 8, 900)) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 });
  }
  let atual = "";
  let nova = "";
  try {
    const b = (await req.json()) as { atual?: unknown; nova?: unknown };
    atual = String(b.atual ?? "");
    nova = String(b.nova ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const erro = validarSenhaNova(nova);
  if (erro) return NextResponse.json({ ok: false, error: erro }, { status: 400 });

  const u = await usuarioParaSenha(sess.email);
  if (!u) return NextResponse.json({ ok: false, error: "Acesso não encontrado." }, { status: 403 });
  if (u.hash && !(await verificarSenha(atual, u.hash))) {
    return NextResponse.json({ ok: false, error: "A senha atual não confere." }, { status: 400 });
  }
  if (!(await gravarSenha(sess.email, await hashSenha(nova)))) {
    return NextResponse.json({ ok: false, error: "Não consegui salvar agora. Tente de novo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
