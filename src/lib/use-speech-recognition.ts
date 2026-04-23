"use client";

import { useEffect, useRef, useState } from "react";

type MinimalRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  }) => void) | null;
  start: () => void;
  stop: () => void;
};

// Instructions shown when the browser/OS blocks microphone access.
// Covers both desktop and mobile so users can self-diagnose.
const PERMISSION_INSTRUCTIONS =
  "Microphone access is blocked. To enable it:\n" +
  "• Desktop: click the lock/mic icon in the address bar and allow microphone, then reload.\n" +
  "• iOS (Safari): Settings → Safari → Microphone → Allow; also Settings → Privacy & Security → Microphone → enable Safari.\n" +
  "• Android (Chrome): tap the lock icon next to the URL → Permissions → Microphone → Allow, then reload.";

function friendlyError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return PERMISSION_INSTRUCTIONS;
    case "audio-capture":
      return "No microphone was found. Please connect a microphone and try again.";
    case "no-speech":
      return "No speech was detected. Please try again.";
    case "network":
      return "Speech recognition failed due to a network issue. Please check your connection.";
    case "aborted":
      return "";
    default:
      return `Speech recognition error: ${code}`;
  }
}

export function useSpeechRecognition(onAppend: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<MinimalRecognition | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => MinimalRecognition;
      webkitSpeechRecognition?: new () => MinimalRecognition;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  function start() {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => MinimalRecognition;
      webkitSpeechRecognition?: new () => MinimalRecognition;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      setError(
        "Speech recognition isn't supported in this browser. Please use Chrome, Edge, or Safari.",
      );
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        }
      }
      if (finalTranscript) onAppend(finalTranscript);
    };

    recognition.onerror = (event) => {
      const message = friendlyError(event.error);
      if (message) setError(message);
      stop();
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError(PERMISSION_INSTRUCTIONS);
      setIsRecording(false);
    }
  }

  function stop() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore — recognition may already be stopping.
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }

  function clearError() {
    setError(null);
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore teardown errors.
        }
      }
    };
  }, []);

  return { isRecording, supported, error, start, stop, clearError };
}
