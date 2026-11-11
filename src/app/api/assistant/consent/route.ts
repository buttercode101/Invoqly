import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "invoqly_ai_consent";
const VERSION = "2026-11-11-v1";

export async function GET() {
  const store = await cookies();
  return NextResponse.json({ accepted: store.get(COOKIE)?.value === VERSION }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "A valid same-origin request is required." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { accepted?: unknown } | null;
  if (!body || typeof body.accepted !== "boolean") return NextResponse.json({ error: "A consent decision is required." }, { status: 422 });
  const response = NextResponse.json({ accepted: body.accepted }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(COOKIE, body.accepted ? VERSION : "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: body.accepted ? 60 * 60 * 24 * 365 : 0
  });
  return response;
}
