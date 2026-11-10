import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthHandlers = ReturnType<typeof toNextJsHandler>;
let handlers: AuthHandlers | undefined;

function getHandlers(): AuthHandlers {
  return handlers ?? (handlers = toNextJsHandler(getAuth()));
}

export async function GET(request: Request) {
  return getHandlers().GET(request);
}

export async function POST(request: Request) {
  return getHandlers().POST(request);
}
