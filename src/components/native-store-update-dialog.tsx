"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  openNativeStoreUpdate,
  type StoreUpdatePrompt,
} from "@/lib/native-notifications/update-checker";

type Props = {
  prompt: StoreUpdatePrompt | null;
  onOpenChange: (open: boolean) => void;
};

export function NativeStoreUpdateDialog({ prompt, onOpenChange }: Props) {
  const open = prompt != null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {prompt?.required ? "Update required" : "Update available"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {prompt
              ? prompt.required
                ? `Flipvise ${prompt.latestVersion} is required to continue. You are on ${prompt.currentVersion}.`
                : `A newer version (${prompt.latestVersion}) is available in the app store. You are on ${prompt.currentVersion}.`
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!prompt?.required ? (
            <AlertDialogCancel>Later</AlertDialogCancel>
          ) : null}
          <AlertDialogAction
            onClick={() => {
              if (!prompt) return;
              void openNativeStoreUpdate(prompt.storeUrl);
            }}
          >
            Update now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
