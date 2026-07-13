"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { isFlipviseNativeShell } from "@/lib/offline/is-flipvise-native-app"
import { useClientMounted } from "@/lib/use-client-mounted"

/** Clears Capacitor status bar / notch on iOS and Android WebViews. */
const NATIVE_TOAST_INSET: NonNullable<ToasterProps["offset"]> = {
  top: "calc(var(--flipvise-safe-top, 48px) + 12px)",
  right: "16px",
  bottom: "calc(var(--flipvise-safe-bottom, 16px) + 12px)",
  left: "16px",
}

function useNativeToastInset(): NonNullable<ToasterProps["offset"]> | undefined {
  const mounted = useClientMounted()
  return React.useMemo(() => {
    if (!mounted || typeof document === "undefined") return undefined
    return isFlipviseNativeShell() ? NATIVE_TOAST_INSET : undefined
  }, [mounted])
}

const Toaster = ({ offset, mobileOffset, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const nativeInset = useNativeToastInset()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      offset={nativeInset ?? offset}
      mobileOffset={nativeInset ?? mobileOffset}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
