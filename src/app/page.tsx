import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import WorkspaceClient from "@/app/workspace-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return <WorkspaceClient user={{ id:session.user.id, name:session.user.name, email:session.user.email }} />;
}
