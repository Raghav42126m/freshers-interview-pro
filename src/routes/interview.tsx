import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { evaluateInterview, generateHint } from "@/lib/groq.functions";
import {
  answersStore,
  fillerStore,
  questionsStore,
  scorecardStore,
  setupStore,
} from "@/lib/interview-store";
import { speak, stopSpeaking } from "@/components/Speaker";
import { VoiceInput } from "@/components/VoiceInput";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [{ title: "Interview in progress · MockMate" }],
  }),
  component: InterviewPage,
});

type Status = "thinking" | "speaking" | "listening";

const ANSWER_TIME = 120; // seconds per question

function InterviewPage() {
 const navigate = useNavigate();
  const evaluate = useServerFn(evaluateInterview);
  const getHint = useServerFn(generateHint);

  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>("thinking");
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME);
  const [hint, setHint] = useState<{ approach: string; pointers: string[] } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spokenForIdx = useRef<number>(-1);

  useEffect(() => {
    const qs = questionsStore.get();
    const setup = setupStore.get();
    if (!qs.length || !setup) {
      navigate({ to: "/" });
      return;
    }
    setQuestions(qs);
    setAnswers(answersStore.get());
  }, [navigate]);

  // Speak each question once
  useEffect(() => {
    if (!questions.length) return;
    if (spokenForIdx.current === idx) return;
    spokenForIdx.current = idx;
    setStatus("speaking");
    speak(questions[idx], () => setStatus("listening"));
    return () => stopSpeaking();
  }, [idx, questions]);

  useEffect(() => () => stopSpeaking(), []);

  // Timer — starts when listening, resets on question change
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(ANSWER_TIME);
    if (status !== "listening") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, idx]);

  // Reset hint when moving to a new question
  useEffect(() => {
    setHint(null);
    setHintOpen(false);
  }, [idx]);

  const total = questions.length;
  const progress = total ? ((idx + 1) / total) * 100 : 0;
  const current = questions[idx] ?? "";

  const timerPercent = (timeLeft / ANSWER_TIME) * 100;
  const timerColor =
    timeLeft > 60
      ? "text-success"
      : timeLeft > 30
        ? "text-warning"
        : "text-destructive";
  const timerRingColor =
    timeLeft > 60
      ? "stroke-green-400"
      : timeLeft > 30
        ? "stroke-yellow-400"
        : "stroke-red-400";
  const fetchHint = async () => {
    if (hint || hintLoading) {
      setHintOpen((v) => !v);
      return;
    }
    const setup = setupStore.get();
    if (!setup) return;
    setHintLoading(true);
    setHintOpen(true);
    try {
      const result = await getHint({
        data: { role: setup.role, type: setup.type, question: current },
      });
      setHint(result);
    } catch (e) {
      console.error(e);
      setHint({
        approach: "Couldn't load a hint right now — try answering with the STAR method (Situation, Task, Action, Result).",
        pointers: [],
      });
    } finally {
      setHintLoading(false);
    }
  };

  const submitAnswer = async (override?: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const text = (override ?? draft).trim();
    const next = [...answers];
    next[idx] = text;
    setAnswers(next);
    answersStore.set(next);
    setDraft("");

    if (idx + 1 < total) {
      setIdx(idx + 1);
      setStatus("thinking");
      return;
    }

    // Last question — evaluate
    setSubmitting(true);
    setStatus("thinking");
    stopSpeaking();
    const setup = setupStore.get();
    if (!setup) {
      navigate({ to: "/" });
      return;
    }
    try {
      const result = await evaluate({
        data: {
          role: setup.role,
          type: setup.type,
          difficulty: setup.difficulty,
          qa: questions.map((q, i) => ({ question: q, answer: next[i] ?? "" })),
        },
      });
      const fillers = fillerStore.get();
      scorecardStore.set({ ...result, fillers });
      navigate({ to: "/scorecard" });
    } catch (e) {
      console.error(e);
      setSubmitting(false);
      alert("Couldn't evaluate the interview. Please try again.");
    }
  };

  if (!questions.length) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  const statusLabel = {
    thinking: "Thinking…",
    speaking: "Speaking…",
    listening: "Listening…",
  }[status];

  const circumference = 2 * Math.PI * 20;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Progress */}
      <div className="sticky top-0 z-10 backdrop-blur bg-background/70 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Question {idx + 1} of {total}
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className="h-full bg-gradient-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-10 sm:py-14 flex flex-col gap-10">
        {/* AI panel */}
        <section className="flex flex-col items-center text-center">
          <div className="relative h-32 w-32 sm:h-36 sm:w-36 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-primary/40 pulse-ring" />
            <span
              className="absolute inset-2 rounded-full border border-primary/30 pulse-ring"
              style={{ animationDelay: "0.6s" }}
            />
            <span className="absolute inset-6 rounded-full bg-gradient-primary shadow-glow" />
            <span className="relative text-2xl font-bold text-primary-foreground">A</span>
          </div>
          <div className="mt-5 text-sm">
            <span className="font-semibold">Alex</span>
            <span className="text-muted-foreground"> — Your AI Interviewer</span>
          </div>
          <div className="mt-1.5 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "speaking"
                  ? "bg-primary pulse-dot"
                  : status === "listening"
                    ? "bg-success"
                    : "bg-warning"
              }`}
            />
            {statusLabel}
          </div>

          <div className="mt-8 w-full rounded-2xl border border-border bg-card p-6 sm:p-8 text-left">
            <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
              Question
            </div>
            <p className="mt-3 text-lg sm:text-xl font-medium leading-relaxed">
              {current}
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus("speaking");
                speak(current, () => setStatus("listening"));
              }}
              className="mt-4 text-xs text-primary hover:underline"
            >
              🔊 Replay
            </button>
          </div>

          {/* Hint */}
          <div className="mt-4 w-full">
            <button
              type="button"
              onClick={fetchHint}
              disabled={hintLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 transition disabled:opacity-60"
            >
              💡 {hintLoading ? "Thinking of a hint…" : hintOpen ? "Hide hint" : "Need a hint?"}
            </button>
            {hintOpen && (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-left">
                {hintLoading ? (
                  <div className="text-xs text-amber-200/80">Thinking of a hint…</div>
                ) : hint ? (
                  <>
                    <div className="text-xs font-semibold text-amber-200">{hint.approach}</div>
                    {hint.pointers.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {hint.pointers.map((p, i) => (
                          <li key={i} className="text-xs text-amber-100/90 flex gap-1.5">
                            <span className="text-amber-300">•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* Answer */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
              Your Answer
            </label>
            {/* Timer */}
            {status === "listening" && !submitting && (
              <div className="flex items-center gap-2">
                <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
                  <circle
                    cx="24" cy="24" r="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-secondary/40"
                  />
                  <circle
                    cx="24" cy="24" r="20"
                    fill="none"
                    strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (timerPercent / 100) * circumference}
                    strokeLinecap="round"
                    className={`${timerRingColor} transition-all duration-1000`}
                  />
                </svg>
                <span className={`text-sm font-bold tabular-nums ${timerColor} absolute`}
                  style={{ marginLeft: "12px" }}>
                  {timeLeft}s
                </span>
              </div>
            )}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={submitting}
            rows={6}
            placeholder="Type your answer here…"
            className="mt-1 w-full rounded-xl border border-border bg-[oklch(0.11_0.012_280)] px-4 py-3 text-sm placeholder:text-muted-foreground/60 outline-none transition input-glow resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{draft.length} characters</div>
            <button
              type="button"
              onClick={() => submitAnswer()}
              disabled={submitting}
              className="rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {submitting
                ? "Scoring…"
                : idx + 1 === total
                  ? "Finish & Score →"
                  : "Submit Answer →"}
            </button>
          </div>
          <VoiceInput
            disabled={submitting}
            onFinalize={(text) => submitAnswer(text)}
          />
        </section>
      </div>
    </main>
  );
}
