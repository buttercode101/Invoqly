import { deleteReceiptObject, getReceiptObject, putReceiptObject } from "@/lib/receipts";
import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { getCurrentUser, getOrCreateWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredReceipt = {
  body: ReadableStream<Uint8Array>;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function detectImage(bytes: Uint8Array): { type: string; extension: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { type: "image/png", extension: "png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { type: "image/webp", extension: "webp" };
  return null;
}

async function workspaceId() {
  return withDb(async db => {
    const user = await getCurrentUser(db);
    if (!user) return null;
    const workspace = await getOrCreateWorkspace(db, user.id);
    return workspace.id;
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("multipart/form-data")) return NextResponse.json({ error: "Choose a receipt image to upload." }, { status: 415 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a JPEG, PNG or WebP receipt image." }, { status: 422 });
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Receipt images must be smaller than 5 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = detectImage(bytes);
  if (!image || image.type !== file.type) return NextResponse.json({ error: "The selected file is not a valid JPEG, PNG or WebP image." }, { status: 415 });

  try {
    const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ error: "Sign in to attach receipt photos to cloud expenses." }, { status: 401 });
    const key = workspace + "/expenses/" + crypto.randomUUID() + "." + image.extension;
    await putReceiptObject(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), image.type, workspace);
    return NextResponse.json({ objectKey: key }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The receipt image could not be saved. Your expense has not been created." }, { status: 503 });
  }
}

export async function GET(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  try {
    const workspace = await workspaceId();
    if (!workspace) return new Response("Sign in required", { status: 401 });
    const key = new URL(request.url).searchParams.get("key") ?? "";
    if (!key.startsWith(workspace + "/expenses/") || key.includes("..")) return new Response("Not found", { status: 404 });
    const object = await getReceiptObject(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Disposition", "inline");
    return new Response(object.body, { headers });
  } catch {
    return new Response("Receipt storage is temporarily unavailable", { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  try {
    const workspace = await workspaceId();
    if (!workspace) return new Response("Sign in required", { status: 401 });
    const key = new URL(request.url).searchParams.get("key") ?? "";
    if (!key.startsWith(workspace + "/expenses/") || key.includes("..")) return new Response(null, { status: 404 });
    await deleteReceiptObject(key);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
