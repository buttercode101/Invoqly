import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAuth } from "@/lib/auth";
import { withDb } from "@/lib/db";
import WorkspaceClient from "@/app/workspace-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return withDb(async db => {
    const session = await createAuth(db).api.getSession({ headers: await headers() });
    if (!session) redirect("/sign-in");
    return <WorkspaceClient user={{ id:session.user.id, name:session.user.name, email:session.user.email }} />;
  });
}
