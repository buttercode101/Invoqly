import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import WorkspaceClient from "@/app/workspace-client";
import GuestWorkspaceClient from "@/app/guest-workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <GuestWorkspaceClient />;
  return <WorkspaceClient user={{ id:session.user.id, name:session.user.name, email:session.user.email }} />;
}
