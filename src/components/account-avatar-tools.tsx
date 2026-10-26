"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function accountDisplayName(user: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
}): string {
  const named = user.fullName?.trim();
  if (named) return named;
  const parts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  return "Account holder";
}

export function AccountAvatarTools() {
  const { user } = useUser();
  const [portraitOpen, setPortraitOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const onPortraitClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const avatar = target.closest(".cl-userButtonPopoverCard .cl-avatarBox");
      if (!avatar) return;
      event.preventDefault();
      event.stopPropagation();
      setPortraitOpen(true);
    };

    document.addEventListener("click", onPortraitClick, true);
    return () => document.removeEventListener("click", onPortraitClick, true);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let frame = 0;

    const attachUpload = () => {
      const avatar = document.querySelector(
        ".cl-userProfile-root .cl-profileSection__profile .cl-avatarBox",
      );
      if (!(avatar instanceof HTMLElement)) return;
      if (avatar.querySelector("[data-flipvise-avatar-upload]")) return;

      const label = document.createElement("label");
      label.dataset.flipviseAvatarUpload = "true";
      label.className = "flipvise-avatar-upload";
      label.title = "Upload profile photograph";

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp,image/gif";
      input.setAttribute("aria-label", "Upload profile photograph");
      input.addEventListener("change", () => {
        const file = input.files?.[0] ?? null;
        input.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          toast.error("Choose a photograph.", {
            description: "PNG, JPEG, WebP, or GIF files can be used.",
          });
          return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
          toast.error("That photograph is too large.", {
            description: "Use an image of 5 MB or smaller.",
          });
          return;
        }
        void user.setProfileImage({ file }).catch(() => {
          toast.error("The photograph could not be saved.", {
            description: "Try a different image.",
          });
        });
      });

      const caption = document.createElement("span");
      caption.textContent = "Upload";
      label.append(input, caption);
      avatar.append(label);
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(attachUpload);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [user]);

  const name = user ? accountDisplayName(user) : "Account holder";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <Dialog open={portraitOpen} onOpenChange={setPortraitOpen}>
      <DialogContent nestedModal className="account-portrait-dialog sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <DialogTitle>Account portrait</DialogTitle>
          <DialogDescription>
            The photograph shown with your Flipvise account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 pb-2">
          <Avatar className="account-portrait-frame size-36">
            {user?.imageUrl ? (
              <AvatarImage src={user.imageUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-3xl font-semibold">{initial}</AvatarFallback>
          </Avatar>
          <p className="text-lg font-semibold tracking-tight">{name}</p>
          {email ? <p className="text-sm text-muted-foreground">{email}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
