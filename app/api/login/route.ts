import { NextResponse } from "next/server";
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("isAdmin", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return res;
}
