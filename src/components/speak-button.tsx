"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const TTS_VOICES = [
  { value: "nova",    label: "Nova",    description: "Female · warm" },
  { value: "shimmer", label: "Shimmer", description: "Female · gentle" },
  { value: "alloy",   label: "Alloy",   description: "Neutral" },
  { value: "echo",    label: "Echo",    description: "Male · warm" },
  { value: "fable",   label: "Fable",   description: "Male · expressive" },
  { value: "onyx",    label: "Onyx",    description: "Male · deep" },
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number]["value"];

export function VoiceSelector({
  voice,
  onChange,
  align = "end",
}: {
  voice: TtsVoice;
  onChange: (v: TtsVoice) => void;
  align?: "end" | "start" | "center";
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Volume2 className="size-3.5 text-muted-foreground shrink-0 hidden sm:block" />
      <Select value={voice} onValueChange={(v) => onChange(v as TtsVoice)}>
        <SelectTrigger className="h-8 w-[110px] sm:w-[130px] text-xs gap-1 px-2.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align={align}>
          {TTS_VOICES.map((v) => (
            <SelectItem key={v.value} value={v.value} className="text-xs">
              <span className="font-medium">{v.label}</span>
              <span className="ml-1.5 text-muted-foreground">{v.description}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type SpeakStatus = "idle" | "loading" | "playing";

export function SpeakButton({
  text,
  voice,
  stopKey,
  className,
  label,
}: {
  text: string;
  voice: TtsVoice;
  /** Change this value to stop any in-progress audio (e.g. pass currentIndex). */
  stopKey: number | string;
  className?: string;
  /** Optional text label shown next to the icon (e.g. "Question", "Answer"). */
  label?: string;
}) {
  const [status, setStatus] = useState<SpeakStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setStatus("idle");
  }, []);

  // Stop when the parent signals a navigation (stopKey changes)
  useEffect(() => {
    stopAudio();
  }, [stopKey, stopAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const handleClick = async (e: React.MouseEvent) => {
    // Prevent parent click handlers (card flip, answer selection, etc.)
    e.stopPropagation();

    if (status === "playing" || status === "loading") {
      stopAudio();
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stopAudio();
      audio.onerror = () => stopAudio();

      setStatus("playing");
      await audio.play();
    } catch {
      stopAudio();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "loading"}
      aria-label={
        status === "loading"
          ? "Generating audio…"
          : status === "playing"
            ? "Stop"
            : "Listen"
      }
      title={
        status === "loading"
          ? "Generating audio…"
          : status === "playing"
            ? "Stop"
            : "Listen"
      }
      className={cn(
        "flex items-center justify-center rounded-full shrink-0",
        !label && "w-6 h-6",
        "transition-all duration-150",
        "hover:scale-105 active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-60",
        status === "playing"
          ? "text-primary animate-pulse"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {status === "loading" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : status === "playing" ? (
        <VolumeX className="size-3.5" />
      ) : (
        <Volume2 className="size-3.5" />
      )}
      {label && (
        <span className="ml-1">{status === "playing" ? "Stop" : label}</span>
      )}
    </button>
  );
}
