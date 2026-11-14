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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = OFFLINE_TTS_VOICES.find((item) => item.value === voice) ?? OFFLINE_TTS_VOICES[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`offline-voice-select${open ? " offline-voice-select--open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="offline-voice-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`AI voice, ${current.label}`}
        onClick={() => setOpen((value) => !value)}
      >
        {current.label}
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <ul className="offline-voice-select__menu" role="listbox" aria-label="AI voice">
          {OFFLINE_TTS_VOICES.map((item) => {
            const selected = item.value === voice;
            return (
              <li key={item.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? "is-selected" : undefined}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <span>{item.label}</span>
                  <span className="offline-voice-select__mark" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
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
