import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { getStoredSyncToken } from "../../src/lib/offline/session";

export const OFFLINE_TTS_VOICES = [
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "onyx", label: "Onyx" },
] as const;

export type OfflineTtsVoice = (typeof OFFLINE_TTS_VOICES)[number]["value"];

type SpeakStatus = "idle" | "loading" | "playing";

function speakWithDeviceTts(text: string, onEnd: () => void): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

async function fetchAiSpeech(
  apiBaseUrl: string,
  text: string,
  voice: OfflineTtsVoice,
): Promise<Blob> {
  const token = await getStoredSyncToken().catch(() => null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/tts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, voice }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("TTS failed");
  return res.blob();
}

export function OfflineVoiceSelector({
  voice,
  onChange,
}: {
  voice: OfflineTtsVoice;
  onChange: (v: OfflineTtsVoice) => void;
}) {
  return (
    <label className="offline-voice-select">
      <span className="sr-only">Voice</span>
      <select
        value={voice}
        onChange={(e) => onChange(e.target.value as OfflineTtsVoice)}
        aria-label="AI voice"
      >
        {OFFLINE_TTS_VOICES.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OfflineSpeakButton({
  text,
  voice,
  stopKey,
  online,
  useAiVoice,
  apiBaseUrl,
  className,
}: {
  text: string;
  voice: OfflineTtsVoice;
  stopKey: number | string;
  online: boolean;
  useAiVoice: boolean;
  apiBaseUrl: string;
  className?: string;
}) {
  const [status, setStatus] = useState<SpeakStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const stopAudio = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
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

  useEffect(() => {
    stopAudio();
  }, [stopKey, stopAudio]);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const handleClick = async (e: MouseEvent) => {
    e.stopPropagation();
    const trimmed = text.trim();
    if (!trimmed) return;

    if (status === "playing" || status === "loading") {
      stopAudio();
      return;
    }

    setStatus("loading");
    try {
      if (online && useAiVoice) {
        try {
          const blob = await fetchAiSpeech(apiBaseUrl, trimmed, voice);
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => setStatus("idle");
          audio.onerror = () => setStatus("idle");
          setStatus("playing");
          await audio.play();
          return;
        } catch {
          // Fall through to device TTS when AI voice is unavailable.
        }
      }

      setStatus("playing");
      speakWithDeviceTts(trimmed, () => setStatus("idle"));
    } catch {
      setStatus("idle");
    }
  };

  return (
    <button
      type="button"
      className={`offline-speak-btn${className ? ` ${className}` : ""}${
        status !== "idle" ? " offline-speak-btn--active" : ""
      }`}
      onClick={handleClick}
      aria-label={status === "playing" ? "Stop speaking" : "Speak"}
      title={
        online && useAiVoice
          ? "Speak with AI voice"
          : "Speak with device voice"
      }
    >
      {status === "loading" ? (
        <span className="offline-speak-btn__spinner" aria-hidden />
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {status === "playing" ? (
            <>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          ) : (
            <>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </>
          )}
        </svg>
      )}
    </button>
  );
}
