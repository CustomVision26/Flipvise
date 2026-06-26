import {
  BiometricAuth,
  BiometryType,
  type CheckBiometryResult,
} from "@aparajita/capacitor-biometric-auth";
import { Capacitor } from "@capacitor/core";

export type LockAvailability = {
  /** The device can enforce a lock (biometry enrolled and/or a device PIN/passcode is set). */
  canLock: boolean;
  /** Human label for the credential, e.g. "Face ID", "fingerprint", "device PIN". */
  label: string;
};

function labelForBiometry(result: CheckBiometryResult): string {
  switch (result.biometryType) {
    case BiometryType.faceId:
    case BiometryType.faceAuthentication:
      return "Face ID";
    case BiometryType.touchId:
      return "Touch ID";
    case BiometryType.fingerprintAuthentication:
      return "fingerprint";
    case BiometryType.irisAuthentication:
      return "iris";
    default:
      return result.deviceIsSecure ? "device PIN" : "device credential";
  }
}

/**
 * Reports whether a device-credential lock can be enforced. Returns `canLock: false`
 * on the web (no native APIs) or when the device has neither enrolled biometry nor a
 * passcode — so we never trap the user behind a lock they can't satisfy.
 */
export async function getLockAvailability(): Promise<LockAvailability> {
  if (!Capacitor.isNativePlatform()) {
    return { canLock: false, label: "" };
  }
  try {
    const result = await BiometricAuth.checkBiometry();
    return {
      canLock: result.isAvailable || result.deviceIsSecure,
      label: labelForBiometry(result),
    };
  } catch {
    return { canLock: false, label: "" };
  }
}

/**
 * Prompts for the device security credential (biometry, falling back to the device
 * PIN/passcode). Resolves `true` only on a successful unlock; any failure/cancel
 * resolves `false` so callers keep the app locked.
 */
export async function authenticateDeviceCredential(
  reason = "Unlock Flipvise",
): Promise<boolean> {
  try {
    await BiometricAuth.authenticate({
      reason,
      allowDeviceCredential: true,
      androidTitle: "Unlock Flipvise",
      androidSubtitle: "Verify it's you to open your decks",
      androidConfirmationRequired: false,
      cancelTitle: "Cancel",
      iosFallbackTitle: "Use passcode",
    });
    return true;
  } catch {
    return false;
  }
}
