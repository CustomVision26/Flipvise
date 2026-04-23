/**
 * Helpers for `publicMetadata` around the admin role vs complimentary Pro (`adminGranted`).
 * Clerk Billing (plans, expiration) stays authoritative via `auth().has()`; we only reconcile
 * metadata flags so removing the admin role does not strand users on a fake complimentary grant
 * or strip a real one they had before becoming admin.
 */

export type PreAdminGrantSnapshot = { adminGranted: boolean };

export type AdminRolePublicMetadata = {
  role?: string | null;
  adminGranted?: boolean;
  plan?: string;
  stripe_subscription_status?: string;
  preAdminGrantSnapshot?: PreAdminGrantSnapshot | null;
  /** Cleared when revoking platform admin — invite-only team workspaces are listed here while admin. */
  teamTierInvitedMemberships?: unknown;
};

/** Mirrors the admin dashboard heuristic for paid status stored on Clerk `publicMetadata`. */
export function looksLikePaidProFromPublicMetadata(
  meta: AdminRolePublicMetadata | Record<string, unknown> | null | undefined,
): boolean {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as AdminRolePublicMetadata;
  return m.plan === "pro" || m.stripe_subscription_status === "active";
}

function buildElevatedPlatformRoleGrantPatch(
  role: "admin" | "superadmin",
  previousMeta: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const m = previousMeta as AdminRolePublicMetadata | undefined;
  return {
    role,
    preAdminGrantSnapshot: {
      adminGranted: m?.adminGranted === true,
    },
  };
}

/** Called when granting the co-admin role: capture whether complimentary Pro was already on. */
export function buildPublicMetadataPatchForAdminRoleGrant(
  previousMeta: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return buildElevatedPlatformRoleGrantPatch("admin", previousMeta);
}

/** First-time platform owner metadata (allow-list bootstrap when user was not yet co-admin). */
export function buildPublicMetadataPatchForSuperadminRoleGrant(
  previousMeta: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return buildElevatedPlatformRoleGrantPatch("superadmin", previousMeta);
}

/**
 * Called when revoking the admin role in-app. Restores `adminGranted` from the snapshot taken
 * at grant time. If there is no snapshot (pre-migration admin), matches legacy behavior by
 * clearing `adminGranted` when public metadata does not look like a paid subscriber.
 */
export function buildPublicMetadataPatchForAdminRoleRevoke(
  previousMeta: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const m = (previousMeta ?? {}) as AdminRolePublicMetadata;
  const snap = m.preAdminGrantSnapshot;

  const patch: Record<string, unknown> = {
    role: null,
    preAdminGrantSnapshot: null,
    teamTierInvitedMemberships: null,
  };

  if (snap && typeof snap === "object" && typeof snap.adminGranted === "boolean") {
    patch.adminGranted = snap.adminGranted ? true : null;
  } else if (m.adminGranted === true && !looksLikePaidProFromPublicMetadata(m)) {
    patch.adminGranted = null;
  }

  return patch;
}

/**
 * When co-admin or owner role is removed in the Clerk Dashboard, `user.updated` fires without
 * `role === "admin"` / `"superadmin"`. Apply the same snapshot restore so `adminGranted` reflects
 * the pre-elevated complimentary state.
 */
export function buildPublicMetadataPatchAfterExternalAdminRoleRemoval(
  publicMetadata: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  const m = (publicMetadata ?? {}) as AdminRolePublicMetadata;
  if (m.role === "admin" || m.role === "superadmin") return null;

  const snap = m.preAdminGrantSnapshot;
  if (snap && typeof snap === "object" && typeof snap.adminGranted === "boolean") {
    return {
      adminGranted: snap.adminGranted ? true : null,
      preAdminGrantSnapshot: null,
      teamTierInvitedMemberships: null,
    };
  }

  if (m.teamTierInvitedMemberships != null) {
    return { teamTierInvitedMemberships: null };
  }

  return null;
}
