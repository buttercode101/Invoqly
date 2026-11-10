import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      database: "ok",
      commit: process.env.CF_VERSION_METADATA?.id ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("health.database", error);
    return NextResponse.json({
      status: "degraded",
      database: "unavailable",
      commit: process.env.CF_VERSION_METADATA?.id ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
