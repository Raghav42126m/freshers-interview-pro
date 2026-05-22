import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fillerStore } from "@/lib/interview-store";
import { transcribeAudio } from "@/lib/whisper.functions";

const FILLER_WORDS = ["um", "uh", "like", "basically", "you know", "acha", "toh", "sort of", "kind of", "hmm"];

function countFillers(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const counts: Record<string, number> = {};
  for (const word of FILLER_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = word.includes(" ")
      ? `(?:^|[\\s,;.!?:])${escaped.replace(/ /g, "[\\s,;.!?:]+")}(?:$|[\\s,;.!?:])`
      : `(?:^|[\\s,;.!?:])${escaped}(?:$|[\\s,;.!?:])`;
    const matches = lower.match(new RegExp(pattern, "gi"));
    counts[word] = matches ? matches.length : 0;
  }
  return counts;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface Props {
  disabled?: boolean;
  onFinalize: (text: string) => void;
}

export function VoiceInput({ disabled, onFinalize }: Props) {
  const transcribe = useServerFn(transcribeAudio);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const fillerCounts = useMemo(() => countFillers(transcript), [transcript]);
  const activeFillers = useMemo(
    () =>
      Object.entries(fillerCounts)
        .filter(([, c]) => c > 0)
        .map(([w, c]) => `${w}: ${c}`)
        .join(" · "),
    [fillerCounts],
  );

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPermissionDenied(true);
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];

    const mimeCandidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    const mimeType = mimeCandidates.find((m) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m),
    );

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const blob = new Blob(chunksRef.current, {
        type: mimeType || chunksRef.current[0]?.type || "audio/webm",
      });
      chunksRef.current = [];
      if (blob.size === 0) {
        setTranscribing(false);
        return;
      }
      setTranscribing(true);
      try {
        const fd = new FormData();
        const ext = (mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        fd.append("file", blob, `audio.${ext}`);
        const result = await transcribe({ data: fd });
        const text = (result?.text ?? "").trim();
        setTranscript(text);
      } catch (err) {
        console.error(err);
        alert("Transcription failed. Please try again.");
      } finally {
        setTranscribing(false);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setElapsed(0);
    setTranscript("");
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
  };

  const submit = () => {
    const text = transcript.trim();
    if (!text) return;
    fillerStore.add(countFillers(text));
    onFinalize(text);
    setTranscript("");
  };

  if (permissionDenied) return null;

  if (!recording && !transcribing && !transcript) {
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
      {recording && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-destructive">
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inset-0 rounded-full bg-destructive opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
              Recording…
            </div>
            <div className="text-xs font-mono text-muted-foreground tabular-nums">
              {formatTime(elapsed)}
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={stopRecording}
              className="rounded-xl bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
            >
              Stop & Submit
            </button>
          </div>
        </>
      )}

      {transcribing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
          Transcribing…
        </div>
      )}

      {!recording && !transcribing && transcript && (
        <>
          <label className="block text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
            Transcript (editable)
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            className="mt-2 w-full rounded-lg border border-border bg-[oklch(0.11_0.012_280)] px-3 py-2 text-sm outline-none resize-none"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            {activeFillers ? (
              <div className="text-[11px] text-muted-foreground">{activeFillers}</div>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTranscript("");
                  start();
                }}
                className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/40"
              >
                Re-record
              </button>
              <button
                type="button"
                onClick={submit}
                className="rounded-xl bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
              >
                Submit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
