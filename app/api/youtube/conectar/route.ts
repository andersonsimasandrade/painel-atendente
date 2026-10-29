import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { urlDeAutorizacao, youtubeConfigurado } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// Abre a tela do Google para o dono autorizar o painel a ler e responder os comentários do canal.
// Só funciona logado no painel (o middleware protege /api/youtube/*).
export async function GET() {
  if (!youtubeConfigurado()) {
    return new NextResponse("YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET ainda não foram colocados no EasyPanel.", { status: 503 });
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(urlDeAutorizacao(state));
  res.cookies.set("yt_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/youtube" });
  return res;
}
