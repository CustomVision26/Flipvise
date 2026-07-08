import type { TeamAdminQuizPickerOption } from "@/db/queries/saved-lesson-plans";

export const ADMIN_NONE = "__admin_none__";

export function adminDisplayLabel(admin: TeamAdminQuizPickerOption): string {
  const identity =
    admin.name && admin.email
      ? `${admin.name} (${admin.email})`
      : (admin.name ?? admin.email ?? "Unknown member");
  if (admin.isWorkspaceOwner) {
    return `${identity} · Workspace owner`;
  }
  return identity;
}

export type OwnerTeamAdminPickerBase = {
  isWorkspaceOwner: boolean;
  teamAdmins: TeamAdminQuizPickerOption[];
};
