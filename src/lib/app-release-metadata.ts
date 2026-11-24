import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

export type AppPlatformRelease = {
  platform: "Web" | "Android" | "iOS";
  version: string | null;
  build: string | null;
  storeUrl: string | null;
  availability: string;
};

export type AppReleaseMetadata = {
  name: "Flipvise";
  publisher: "Flipvise Studio LLC";
  platforms: AppPlatformRelease[];
};

function readText(relativePath: string): string | null {
  try {
    return readFileSync(path.join(process.cwd(), relativePath), "utf8");
  } catch {
    return null;
  }
}

function matchGroup(source: string | null, pattern: RegExp): string | null {
  if (!source) return null;
  const match = source.match(pattern);
  const value = match?.[1]?.trim();
  return value || null;
}

function publicStoreUrl(envName: string): string | null {
  const value = process.env[envName]?.trim();
  if (!value || !value.startsWith("https://")) return null;
  if (value.includes("id0000000000")) return null;
  return value;
}

/** Versions come from the web package, Android Gradle file, and iOS project. */
export function readAppReleaseMetadata(): AppReleaseMetadata {
  const gradle = readText("android/app/build.gradle");
  const iosProject = readText("ios/App/App.xcodeproj/project.pbxproj");
  const packageSource = readText("package.json");
  let webVersion: string | null = null;
  if (packageSource) {
    try {
      const parsed = JSON.parse(packageSource) as { version?: unknown };
      webVersion = typeof parsed.version === "string" ? parsed.version : null;
    } catch {
      webVersion = null;
    }
  }
  const androidVersion = matchGroup(gradle, /versionName\s+"([^"]+)"/);
  const androidBuild = matchGroup(gradle, /versionCode\s+(\d+)/);
  const iosVersion = matchGroup(iosProject, /MARKETING_VERSION = ([^;]+);/);
  const iosBuild = matchGroup(iosProject, /CURRENT_PROJECT_VERSION = ([^;]+);/);

  return {
    name: "Flipvise",
    publisher: "Flipvise Studio LLC",
    platforms: [
      {
        platform: "Web",
        version: webVersion,
        build: null,
        storeUrl: null,
        availability: "Available in a supported browser.",
      },
      {
        platform: "Android",
        version: androidVersion,
        build: androidBuild,
        storeUrl: publicStoreUrl("NATIVE_ANDROID_STORE_URL"),
        availability: androidVersion
          ? "Native Android build is in the project. A store link appears only when a public store URL is configured."
          : "Android version was not found in the project.",
      },
      {
        platform: "iOS",
        version: iosVersion,
        build: iosBuild,
        storeUrl: publicStoreUrl("NATIVE_IOS_STORE_URL"),
        availability: iosVersion
          ? "Native iOS build is in the project. A store link appears only when a public store URL is configured."
          : "iOS version was not found in the project.",
      },
    ],
  };
}
