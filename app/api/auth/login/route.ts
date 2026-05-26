import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_USERNAME = "synapse";
const DEFAULT_PASSWORD = "synapse123";
const COOKIE_NAME = "synpase_demo_auth";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON" },
      { status: 400 },
    );
  }

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "username and password are both required strings" },
      { status: 400 },
    );
  }

  const validUsername = process.env.AUTH_USERNAME ?? DEFAULT_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD ?? DEFAULT_PASSWORD;

  if (username !== validUsername || password !== validPassword) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true, username });
  res.cookies.set(COOKIE_NAME, username, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_SECONDS,
    path: "/",
  });
  return res;
}
