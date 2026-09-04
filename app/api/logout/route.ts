import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearAndRedirect(req: Request) {
  const url = new URL("/login", req.url);
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
