import { toNextJsHandler } from "better-auth/next-js";
import { createAuth } from "@/lib/auth";
import { withDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request, method: "GET" | "POST") {
  return withDb(async db => {
    const handlers = toNextJsHandler(createAuth(db));
    return handlers[method](request);
  });
}

export async function GET(request: Request) {
  return handle(request, "GET");
}

export async function POST(request: Request) {
  return handle(request, "POST");
}
