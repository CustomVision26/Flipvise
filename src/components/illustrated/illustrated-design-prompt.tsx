"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function storageKey(userId: string) {
  return `flipvise-illustrated-prompt:${userId}`;
}

function clickAppearanceNav(): boolean {
  const buttons = document.querySelectorAll(
    ".cl-navbarButton, .cl-userProfile-root button",
  );
  for (const button of buttons) {
    const text = button.textContent?.replace(/\s+/g, " ").trim();
    if (text === "Appearance") {
      (button as HTMLElement).click();
      return true;
    }
  }
  return false;
}

export function IllustratedDesignPrompt() {
  const appearance = useIllustratedAppearance();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!appearance.userId || appearance.loading) return;
    if (appearance.effectiveIllustratedDesign) {
      setOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem(storageKey(appearance.userId)) === "1") return;
    } catch {
      return;
    }
    setOpen(true);
  }, [
    appearance.userId,
    appearance.loading,
    appearance.effectiveIllustratedDesign,
  ]);

  function dismiss() {
    if (appearance.userId) {
      try {
        sessionStorage.setItem(storageKey(appearance.userId), "1");
      } catch {
        /* Private browsing can block storage. The prompt simply closes. */
      }
    }
    setOpen(false);
  }

  async function openAppearance() {
    dismiss();
    const trigger = document.querySelector(
      "[data-header-account-menu] .cl-userButtonTrigger",
    );
    if (trigger instanceof HTMLElement) trigger.click();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      const manage = document.querySelector(
        "[data-localization-key='userButton.action__manageAccount']",
      );
      if (manage instanceof HTMLElement) {
        manage.click();
        break;
      }
    }
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
      if (clickAppearanceNav()) return;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="illustrated-prompt-dialog sm:max-w-xl">
        <Image
          src="/artwork/home/illustrated-prompt-owl.png"
          alt=""
          width={180}
          height={180}
          className="illustrated-prompt-owl"
        />
        <DialogHeader className="illustrated-prompt-copy">
          <DialogTitle>Illustrated deck design</DialogTitle>
          <DialogDescription>
            Cartoon artwork, layered cards, and illustrated backgrounds are
            included on every plan, including Free. Study content and plan
            features stay the same.
          </DialogDescription>
        </DialogHeader>
        <p className="illustrated-prompt-where">
          Open the account button, choose Manage account, then Appearance.
          Turn on Illustrated Deck Design there.
        </p>
        {!appearance.globalEnabled ? (
          <p className="illustrated-prompt-note">
            Illustrated designs are temporarily unavailable. Your choice is
            kept and applied when they return.
          </p>
        ) : null}
        <DialogFooter className="illustrated-prompt-footer">
          <Button type="button" variant="outline" onClick={dismiss}>
            Not now
          </Button>
          <Button
            type="button"
            className="illustrated-prompt-open"
            onClick={() => void openAppearance()}
          >
            Open Appearance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
