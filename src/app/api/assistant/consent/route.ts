import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "invoqly_ai_consent";
const VERSION = "2026-11-11-v1";

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin) {
    try {
      const parsedOrigin = new URL(origin).origin;
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const expectedOrigin = host ? (forwardedProto ?? requestUrl.protocol.slice(0, -1)) + "://" + host : requestUrl.origin;
      return parsedOrigin === requestUrl.origin || parsedOrigin === expectedOrigin;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}


export async function GET() {
  const store = await cookies();
  return NextResponse.json({ accepted: store.get(COOKIE)?.value === VERSION }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
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
