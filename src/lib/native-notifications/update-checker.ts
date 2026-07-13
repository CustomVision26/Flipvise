import { toast } from "sonner";
import { isSemverBelow } from "@/lib/native-app-version";
import { NATIVE_DEPLOY_VERSION_KEY } from "@/lib/native-notifications/preferences-keys";

export type StoreUpdatePrompt = {
  currentVersion: string;
  latestVersion: string;
  storeUrl: string;
  required: boolean;
};

type AppVersionResponse = {
  android: { min: string; latest: string };
  ios: { min: string; latest: string };
  storeUrls: { android: string; ios: string };
};

function resolvePlatform(): "android" | "ios" {
  const platform = document.documentElement.dataset.platform;
  return platform === "ios" ? "ios" : "android";
}

async function fetchAppVersionConfig(): Promise<AppVersionResponse | null> {
  try {
    const res = await fetch("/api/native/app-version", {
      credentials: "include",
      cache: "no-store",
      headers: { "X-Flipvise-Native-Shell": "1" },
    });
    if (!res.ok) return null;
    return (await res.json()) as AppVersionResponse;
  } catch {
    return null;
  }
}

export async function checkNativeStoreUpdate(): Promise<StoreUpdatePrompt | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    // Live-site WebViews often keep the FlipviseNative UA marker after allowNavigation,
    // but the Capacitor bridge is not injected — App web stubs throw "Not implemented on web".
    if (!Capacitor.isNativePlatform()) return null;

    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    const currentVersion = info.version?.trim() || "0.0.0";
    const platform = resolvePlatform();

    const config = await fetchAppVersionConfig();
    if (!config) return null;

    const minVersion =
      platform === "ios" ? config.ios.min : config.android.min;
    const latestVersion =
      platform === "ios" ? config.ios.latest : config.android.latest;
    const storeUrl =
      platform === "ios" ? config.storeUrls.ios : config.storeUrls.android;

    const belowMin = isSemverBelow(currentVersion, minVersion);
    const belowLatest = isSemverBelow(currentVersion, latestVersion);

    if (!belowMin && !belowLatest) {
      try {
        const { AppUpdate, AppUpdateAvailability } = await import(
          "@capawesome/capacitor-app-update"
        );
        const updateInfo = await AppUpdate.getAppUpdateInfo();
        if (updateInfo.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
          return null;
        }
        const storeLatest =
          updateInfo.availableVersionName?.trim() || latestVersion;
        if (!isSemverBelow(currentVersion, storeLatest)) {
          return null;
        }
        return {
          currentVersion,
          latestVersion: storeLatest,
          storeUrl,
          required: belowMin,
        };
      } catch {
        return null;
      }
    }

    return {
      currentVersion,
      latestVersion,
      storeUrl,
      required: belowMin,
    };
  } catch {
    return null;
  }
}

export async function openNativeStoreUpdate(storeUrl: string): Promise<void> {
  try {
    const { AppUpdate } = await import("@capawesome/capacitor-app-update");
    const platform = resolvePlatform();
    if (platform === "android") {
      const updateInfo = await AppUpdate.getAppUpdateInfo();
      if (updateInfo.immediateUpdateAllowed) {
        const result = await AppUpdate.performImmediateUpdate();
        if (result.code === 0) return;
      }
    }
    await AppUpdate.openAppStore();
    return;
  } catch {
    // Fall through to Browser.
  }

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: storeUrl });
  } catch {
    window.open(storeUrl, "_blank", "noopener,noreferrer");
  }
}

async function readStoredDeployVersion(): Promise<string | null> {
  const { Preferences } = await import("@capacitor/preferences");
  const { value } = await Preferences.get({ key: NATIVE_DEPLOY_VERSION_KEY });
  return value?.trim() ? value : null;
}

async function writeStoredDeployVersion(version: string): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key: NATIVE_DEPLOY_VERSION_KEY, value: version });
}

export async function checkDeployVersionUpdate(): Promise<string | null> {
  try {
    const res = await fetch("/api/native/deploy-version", {
      credentials: "include",
      cache: "no-store",
      headers: { "X-Flipvise-Native-Shell": "1" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    const remote = data.version?.trim();
    if (!remote) return null;

    const stored = await readStoredDeployVersion();
    if (!stored) {
      await writeStoredDeployVersion(remote);
      return null;
    }
    if (stored === remote) return null;
    return remote;
  } catch {
    return null;
  }
}

export async function acknowledgeDeployVersion(version: string): Promise<void> {
  await writeStoredDeployVersion(version);
}

export function showDeployRefreshToast(version: string): void {
  toast.info("Update available", {
    description: "A new version of Flipvise is ready. Refresh to load the latest changes.",
    action: {
      label: "Refresh",
      onClick: () => {
        void acknowledgeDeployVersion(version).finally(() => {
          window.location.reload();
        });
      },
    },
    duration: Infinity,
  });
}

export async function runNativeUpdateChecks(input: {
  onStoreUpdate: (prompt: StoreUpdatePrompt) => void;
}): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      // Still allow deploy-version toasts when only the UA marker is present.
      const deployVersion = await checkDeployVersionUpdate();
      if (deployVersion) {
        showDeployRefreshToast(deployVersion);
      }
      return;
    }
  } catch {
    return;
  }

  const storePrompt = await checkNativeStoreUpdate();
  if (storePrompt) {
    input.onStoreUpdate(storePrompt);
    return;
  }

  const deployVersion = await checkDeployVersionUpdate();
  if (deployVersion) {
    showDeployRefreshToast(deployVersion);
  }
}
