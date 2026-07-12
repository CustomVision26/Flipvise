import { toast } from "sonner";
import { NATIVE_INBOX_UNREAD_COUNT_KEY } from "@/lib/native-notifications/preferences-keys";
import { wasPushRecentlyReceived } from "@/lib/native-notifications/push-handlers";

const POLL_INTERVAL_MS = 45_000;

async function readStoredUnreadCount(): Promise<number> {
  const { Preferences } = await import("@capacitor/preferences");
  const { value } = await Preferences.get({ key: NATIVE_INBOX_UNREAD_COUNT_KEY });
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function writeStoredUnreadCount(count: number): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({
    key: NATIVE_INBOX_UNREAD_COUNT_KEY,
    value: String(count),
  });
}

async function fetchUnreadCount(): Promise<number | null> {
  try {
    const res = await fetch("/api/inbox/unread-count", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { count?: number };
    return typeof data.count === "number" && data.count >= 0 ? data.count : null;
  } catch {
    return null;
  }
}

function showInboxToast(count: number): void {
  const label =
    count === 1
      ? "You have a new inbox message."
      : `You have ${count} unread inbox messages.`;
  toast.info("Inbox", {
    description: label,
    action: {
      label: "Open inbox",
      onClick: () => {
        window.location.assign("/dashboard/inbox");
      },
    },
  });
}

export function startNativeInboxPoller(isActive: () => boolean): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let cancelled = false;

  const tick = async () => {
    if (cancelled || !isActive()) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    const count = await fetchUnreadCount();
    if (count == null || cancelled) return;

    const previous = await readStoredUnreadCount();
    await writeStoredUnreadCount(count);

    if (count > previous) {
      const recentPush = await wasPushRecentlyReceived();
      if (!recentPush) {
        showInboxToast(count - previous);
      }
    }
  };

  void tick();
  timer = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);

  return () => {
    cancelled = true;
    if (timer) clearInterval(timer);
  };
}
