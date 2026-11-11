import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import WorkspaceClient from "@/app/workspace-client";
import GuestWorkspaceClient from "@/app/guest-workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";
  // Avoid initializing the database-backed auth adapter for ordinary guest visits.
  const hasSessionCookie = /(?:__Secure-)?invoqly\.session_token=/.test(cookie);
  if (!hasSessionCookie) return <GuestWorkspaceClient />;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return <GuestWorkspaceClient />;
  return <WorkspaceClient user={{ id:session.user.id, name:session.user.name, email:session.user.email }} />;
}
