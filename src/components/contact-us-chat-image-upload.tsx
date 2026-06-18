"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "done" | "error";

type ContactUsChatImageUploadProps = {
  messageId: number;
  accessToken?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  className?: string;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;

export function ContactUsChatImageUpload({
  messageId,
  accessToken,
  value,
  onChange,
  disabled = false,
  className,
}: ContactUsChatImageUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>(value ? "done" : "idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError("Only JPEG, PNG, WebP, and GIF images are allowed");
        setUploadState("error");
        return;
      }
      if (file.size > MAX_BYTES) {
        setUploadError("Image must be smaller than 10 MB");
        setUploadState("error");
        return;
      }

      setUploadError(null);
      setUploadState("uploading");

      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      try {
        const formData = new FormData();
        formData.append("messageId", String(messageId));
        if (accessToken) formData.append("token", accessToken);
        formData.append("image", file);

        const response = await fetch("/api/contact-us/chat-image", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!response.ok || !data?.url) {
          throw new Error(data?.error ?? "Upload failed");
        }

        onChange(data.url);
        setUploadState("done");
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        setUploadState("error");
        setPreview(null);
        onChange(null);
      }
    },
    [accessToken, messageId, onChange],
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleRemove() {
    setPreview(null);
    onChange(null);
    setUploadState("idle");
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {preview && (uploadState === "uploading" || uploadState === "done") ? (
        <div className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Attachment preview"
            className="max-h-36 w-full object-contain"
          />
          {uploadState === "uploading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-1.5 top-1.5 h-7 w-7"
              onClick={handleRemove}
              disabled={disabled}
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-muted-foreground"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploadState === "uploading"}
        >
          {uploadState === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
          Attach image
        </Button>
        {uploadError ? (
          <p className="text-[11px] text-destructive" role="alert">
            {uploadError}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled || uploadState === "uploading"}
      />
    </div>
  );
}
