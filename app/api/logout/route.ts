import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { appBaseUrl } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearAndRedirect(req: Request) {
  // Endereço fixo do painel (APP_BASE_URL). O req.url dentro do servidor é o endereço INTERNO (0.0.0.0:3000), que não abre no navegador.
  let base: string;
  try {
    base = appBaseUrl();
  } catch {
    base = req.url;
  }
  const url = new URL("/login", base);
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: Request) {
  return clearAndRedirect(req);
}

export async function GET(req: Request) {
  return clearAndRedirect(req);
}
