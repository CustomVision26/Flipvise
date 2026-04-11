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
};

/** Mirrors the admin dashboard heuristic for paid status stored on Clerk `publicMetadata`. */
export function looksLikePaidProFromPublicMetadata(
  meta: AdminRolePublicMetadata | Record<string, unknown> | null | undefined,
): boolean {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as AdminRolePublicMetadata;
  return m.plan === "pro" || m.stripe_subscription_status === "active";
}

/** Called when granting the admin role: capture whether complimentary Pro was already on. */
export function buildPublicMetadataPatchForAdminRoleGrant(
  previousMeta: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const m = previousMeta as AdminRolePublicMetadata | undefined;
  return {
    role: "admin",
    preAdminGrantSnapshot: {
      adminGranted: m?.adminGranted === true,
    },
  };
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
  };

  if (snap && typeof snap === "object" && typeof snap.adminGranted === "boolean") {
    patch.adminGranted = snap.adminGranted ? true : null;
  } else if (m.adminGranted === true && !looksLikePaidProFromPublicMetadata(m)) {
    patch.adminGranted = null;
  }

  return patch;
}

/**
 * When the admin role is removed in the Clerk Dashboard, `user.updated` fires with `role !== "admin"`.
 * Apply the same snapshot restore so `adminGranted` reflects the pre-admin complimentary state.
 */
export function buildPublicMetadataPatchAfterExternalAdminRoleRemoval(
  publicMetadata: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  const m = (publicMetadata ?? {}) as AdminRolePublicMetadata;
  if (m.role === "admin") return null;

  const snap = m.preAdminGrantSnapshot;
  if (snap && typeof snap === "object" && typeof snap.adminGranted === "boolean") {
    return {
      adminGranted: snap.adminGranted ? true : null,
      preAdminGrantSnapshot: null,
    };
  }

  return null;
}
