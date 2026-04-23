"use client";

import * as React from "react";
import {
  Mic,
  MicOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MicPermissionState = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

type PlatformId = "windows" | "macos" | "ios" | "android" | "linux";

type BrowserId = "chrome" | "edge" | "firefox" | "safari" | "other";

interface DetectedEnv {
  platform: PlatformId;
  browser: BrowserId;
}

function detectEnv(): DetectedEnv {
  if (typeof navigator === "undefined") {
    return { platform: "windows", browser: "other" };
  }
  const ua = navigator.userAgent;
  const platformStr =
    typeof navigator !== "undefined" && "platform" in navigator
      ? (navigator as Navigator & { platform: string }).platform
      : "";

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platformStr === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
  const isAndroid = /android/i.test(ua);
  const isMac = !isIOS && /Mac(intosh|_PowerPC|OS X)/i.test(ua);
  const isWindows = /Windows/i.test(ua);
  const isLinux = !isAndroid && /Linux|X11/i.test(ua);

  let platform: PlatformId = "windows";
  if (isIOS) platform = "ios";
  else if (isAndroid) platform = "android";
  else if (isMac) platform = "macos";
  else if (isWindows) platform = "windows";
  else if (isLinux) platform = "linux";

  const isEdge = /Edg\//i.test(ua);
  const isFirefox = /Firefox\//i.test(ua);
  const isChrome = /Chrome\//i.test(ua) && !isEdge;
  const isSafari = /Safari\//i.test(ua) && !isChrome && !isEdge;

  let browser: BrowserId = "other";
  if (isEdge) browser = "edge";
  else if (isFirefox) browser = "firefox";
  else if (isChrome) browser = "chrome";
  else if (isSafari) browser = "safari";

  return { platform, browser };
}

const PLATFORM_LABELS: Record<PlatformId, string> = {
  windows: "Windows",
  macos: "macOS",
  ios: "iOS",
  android: "Android",
  linux: "Linux",
};

function PlatformInstructions({
  platform,
  browser,
}: {
  platform: PlatformId;
  browser: BrowserId;
}) {
  const browserName =
    browser === "chrome"
      ? "Chrome"
      : browser === "edge"
        ? "Edge"
        : browser === "firefox"
          ? "Firefox"
          : browser === "safari"
            ? "Safari"
            : "your browser";

  switch (platform) {
    case "windows":
      return (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold mb-1.5">Windows system settings</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open <span className="text-foreground">Settings</span> (Win + I).</li>
              <li>Go to <span className="text-foreground">Privacy &amp; security → Microphone</span>.</li>
              <li>Turn on <span className="text-foreground">Microphone access</span>.</li>
              <li>Turn on <span className="text-foreground">Let apps access your microphone</span>.</li>
              <li>Scroll down and enable access for <span className="text-foreground">{browserName}</span>.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-1.5">{browserName} site settings</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Click the <span className="text-foreground">lock/tune icon</span> in the address bar.</li>
              <li>Choose <span className="text-foreground">Site settings</span> (or Permissions).</li>
              <li>Set <span className="text-foreground">Microphone</span> to <span className="text-foreground">Allow</span>, then reload.</li>
            </ol>
          </div>
        </div>
      );
    case "macos":
      return (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold mb-1.5">macOS system settings</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open <span className="text-foreground">System Settings</span> (Apple menu).</li>
              <li>Go to <span className="text-foreground">Privacy &amp; Security → Microphone</span>.</li>
              <li>Enable the toggle for <span className="text-foreground">{browserName}</span>.</li>
              <li>If prompted, quit and reopen {browserName}.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-1.5">{browserName} site settings</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              {browser === "safari" ? (
                <>
                  <li>In Safari menu, choose <span className="text-foreground">Settings → Websites → Microphone</span>.</li>
                  <li>Set this site to <span className="text-foreground">Allow</span>.</li>
                </>
              ) : (
                <>
                  <li>Click the <span className="text-foreground">lock icon</span> in the address bar.</li>
                  <li>Choose <span className="text-foreground">Site settings</span> / Permissions.</li>
                  <li>Set <span className="text-foreground">Microphone</span> to <span className="text-foreground">Allow</span>, then reload.</li>
                </>
              )}
            </ol>
          </div>
        </div>
      );
    case "ios":
      return (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold mb-1.5">iOS system settings</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open the <span className="text-foreground">Settings</span> app.</li>
              <li>Scroll down and tap <span className="text-foreground">Safari</span> (or your browser).</li>
              <li>Tap <span className="text-foreground">Microphone</span> and select <span className="text-foreground">Allow</span>.</li>
              <li>Also check <span className="text-foreground">Settings → Privacy &amp; Security → Microphone</span> and enable Safari.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-1.5">Per-site reset</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>In Safari, tap the <span className="text-foreground">aA</span> icon in the address bar.</li>
              <li>Choose <span className="text-foreground">Website Settings</span>.</li>
              <li>Set <span className="text-foreground">Microphone</span> to <span className="text-foreground">Allow</span>, then reload.</li>
            </ol>
          </div>
        </div>
      );
    case "android":
      return (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold mb-1.5">Android system settings</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open <span className="text-foreground">Settings → Apps</span>.</li>
              <li>Tap <span className="text-foreground">{browserName}</span> (or your browser).</li>
              <li>Tap <span className="text-foreground">Permissions → Microphone → Allow</span>.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-1.5">{browserName} site settings</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Tap the <span className="text-foreground">lock icon</span> next to the URL.</li>
              <li>Tap <span className="text-foreground">Permissions → Microphone → Allow</span>.</li>
              <li>Reload the page.</li>
            </ol>
          </div>
        </div>
      );
    case "linux":
      return (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold mb-1.5">Linux system</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open your desktop&apos;s <span className="text-foreground">Sound / Audio</span> settings.</li>
              <li>Under <span className="text-foreground">Input</span>, ensure a microphone device is selected and not muted.</li>
              <li>If using PulseAudio/PipeWire, verify the source is active (e.g. <span className="text-foreground">pavucontrol → Recording</span>).</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-1.5">{browserName} site settings</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Click the <span className="text-foreground">lock icon</span> in the address bar.</li>
              <li>Choose <span className="text-foreground">Site settings</span> / Permissions.</li>
              <li>Set <span className="text-foreground">Microphone</span> to <span className="text-foreground">Allow</span>, then reload.</li>
            </ol>
          </div>
        </div>
      );
  }
}

interface MicrophoneSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MicrophoneSettingsDialog({
  open,
  onOpenChange,
}: MicrophoneSettingsDialogProps) {
  const [env, setEnv] = React.useState<DetectedEnv | null>(null);
  const [permission, setPermission] = React.useState<MicPermissionState>("unknown");
  const [isTesting, setIsTesting] = React.useState(false);
  const [testError, setTestError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<PlatformId>("windows");
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    const detected = detectEnv();
    setEnv(detected);
    setActiveTab(detected.platform);
  }, []);

  const refreshPermission = React.useCallback(async () => {
    if (typeof navigator === "undefined") {
      setPermission("unsupported");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      return;
    }
    if (!navigator.permissions?.query) {
      setPermission("unknown");
      return;
    }
    try {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      setPermission(status.state as MicPermissionState);
      status.onchange = () => {
        setPermission(status.state as MicPermissionState);
      };
    } catch {
      setPermission("unknown");
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      void refreshPermission();
    }
  }, [open, refreshPermission]);

  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  async function handleTestMicrophone() {
    setTestError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setTestError(
        "Your browser doesn't support microphone access. Try Chrome, Edge, Safari, or Firefox.",
      );
      setPermission("unsupported");
      return;
    }
    setIsTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Release tracks immediately — this was a permission check, not a recording.
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setPermission("granted");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermission("denied");
        setTestError(
          "Microphone access was denied. Follow the instructions below to allow it in your device settings.",
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setTestError(
          "No microphone was found on this device. Please connect a microphone and try again.",
        );
      } else {
        setTestError(
          err instanceof Error ? err.message : "Couldn't access the microphone.",
        );
      }
    } finally {
      setIsTesting(false);
    }
  }

  const permissionBadge = (() => {
    switch (permission) {
      case "granted":
        return (
          <Badge className="gap-1 bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">
            <CheckCircle2 className="h-3 w-3" /> Allowed
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="destructive" className="gap-1">
            <MicOff className="h-3 w-3" /> Blocked
          </Badge>
        );
      case "prompt":
        return (
          <Badge variant="secondary" className="gap-1">
            <Mic className="h-3 w-3" /> Not set
          </Badge>
        );
      case "unsupported":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" /> Unsupported
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Mic className="h-3 w-3" /> Unknown
          </Badge>
        );
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-4 sm:mx-auto max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg sm:text-xl">Microphone</DialogTitle>
            {permissionBadge}
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Manage microphone access for voice dictation. Your browser prompt links directly into your device&apos;s system permission.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Status + test button */}
          <div className="rounded-md border border-border bg-muted/30 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2">
              <Mic className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs sm:text-sm">
                <p className="font-medium text-foreground">Microphone access</p>
                <p className="text-muted-foreground mt-0.5">
                  {permission === "granted" &&
                    "This site can use your microphone."}
                  {permission === "denied" &&
                    "This site is blocked from using your microphone. Use the steps below."}
                  {permission === "prompt" &&
                    "You haven't chosen yet. Click Test to trigger the system prompt."}
                  {permission === "unsupported" &&
                    "This browser can't access a microphone."}
                  {permission === "unknown" &&
                    "Permission status unavailable on this browser."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleTestMicrophone}
              disabled={isTesting || permission === "unsupported"}
              className="shrink-0"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Requesting…
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5 mr-1.5" />
                  Test microphone
                </>
              )}
            </Button>
          </div>

          {testError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              {testError}
            </div>
          )}

          {/* Platform tabs */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                Open system microphone settings
              </p>
              {env && (
                <span className="text-[11px] text-muted-foreground">
                  Detected: {PLATFORM_LABELS[env.platform]}
                  {env.browser !== "other" && ` · ${env.browser[0].toUpperCase()}${env.browser.slice(1)}`}
                </span>
              )}
            </div>
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as PlatformId)}
            >
              <TabsList className="flex w-full flex-wrap gap-1 h-auto">
                {(Object.keys(PLATFORM_LABELS) as PlatformId[]).map((p) => (
                  <TabsTrigger key={p} value={p} className="text-xs">
                    {PLATFORM_LABELS[p]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {(Object.keys(PLATFORM_LABELS) as PlatformId[]).map((p) => (
                <TabsContent key={p} value={p} className="mt-3">
                  <PlatformInstructions
                    platform={p}
                    browser={env?.browser ?? "other"}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Browsers can&apos;t open OS settings directly — use the steps above.
          </p>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          <Button
            onClick={() => void refreshPermission()}
            className="w-full sm:w-auto"
          >
            Refresh status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
