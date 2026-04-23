/** Clerk `publicMetadata.role` values for global Flipvise platform dashboard access. */

export function isClerkSuperadminRole(role: string | null | undefined): boolean {
  return role === "superadmin";
}

export function isClerkPlatformAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}
