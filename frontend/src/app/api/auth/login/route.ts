import { NextRequest, NextResponse } from "next/server";

const APP_PASSWORD = process.env.APP_PASSWORD || "SeattleDenver12##";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (password === APP_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("kalinda_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      sameSite: "lax",
    });
    return res;
  }

  return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
}
