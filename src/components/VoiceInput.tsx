import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = any;

function getRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isVoiceInputSupported(): boolean {
  return !!getRecognitionCtor();
}

interface Props {
  disabled?: boolean;
  onFinalize: (text: string) => void;
}

export function VoiceInput({ disabled, onFinalize }: Props) {
  const [supported, setSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(isVoiceInputSupported());
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  const start = async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    // Request mic permission explicitly so denial falls back silently
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setPermissionDenied(true);
      return;
    }

    const recognition: SpeechRecognitionLike = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let accumulated = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) {
          accumulated += (accumulated ? " " : "") + transcript.trim();
        } else {
          interim += transcript;
        }
      }
      setFinalText(accumulated);
      setInterimText(interim);
    };
    recognition.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setPermissionDenied(true);
      }
    };
    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    setFinalText("");
    setInterimText("");
    setRecording(true);
    try {
      recognition.start();
    } catch {
      setRecording(false);
    }
  };

  const stopAndSubmit = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    const combined = [finalText, interimText].filter(Boolean).join(" ").trim();
    setRecording(false);
    if (combined) onFinalize(combined);
    setFinalText("");
    setInterimText("");
  };

  if (!supported || permissionDenied) return null;

  if (!recording) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary/40 disabled:opacity-60"
      >
        <span aria-hidden>🎙️</span> Answer with voice
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-destructive">
        <span className="relative inline-flex h-2.5 w-2.5">
          <span className="absolute inset-0 rounded-full bg-destructive opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
        Recording…
      </div>
      <p className="mt-3 text-sm leading-relaxed min-h-[3rem]">
        <span className="text-foreground">{finalText}</span>
        {interimText && (
          <span className="text-muted-foreground">
            {finalText ? " " : ""}
            {interimText}
          </span>
        )}
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={stopAndSubmit}
          className="rounded-xl bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
        >
          Stop & Submit
        </button>
      </div>
    </div>
  );
}
