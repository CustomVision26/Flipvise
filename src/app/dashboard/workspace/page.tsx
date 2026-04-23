import { redirect } from "next/navigation";

/** Canonical workspaces UI lives at `/dashboard/workspaces`. */
export default function WorkspacePathAliasPage() {
  redirect("/dashboard/workspaces");
}
