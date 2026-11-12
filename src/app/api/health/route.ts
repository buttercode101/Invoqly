import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { withDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await withDb(async db => {
      await db.execute(sql`select 1`);
      try {
        // A connectivity-only probe can pass while the app's actual schema is unusable.
        // Check every newer column used by the signed-in workspace before reporting healthy.
        await db.execute(sql`select vat_registered, vat_number, business_address, opening_cash_balance_minor, cash_reserve_minor from workspaces limit 0`);
        await db.execute(sql`select receipt_object_key from expenses limit 0`);
        await db.execute(sql`select line_items, converted_invoice_id from quotes limit 0`);
      } catch (error) {
        console.error("health.schema", error);
        return NextResponse.json({
          status: "degraded",
          database: "ok",
          schema: "out_of_date",
          commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({
        status: "ok",
        database: "ok",
        schema: "ok",
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) {
    console.error("health.database", error);
    return NextResponse.json({
      status: "degraded",
      database: "unavailable",
      schema: "unverified",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
