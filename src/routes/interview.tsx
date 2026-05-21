import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { evaluateInterview } from "@/lib/groq.functions";
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

function InterviewPage() {
  const navigate = useNavigate();
  const evaluate = useServerFn(evaluateInterview);

  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>("thinking");
  const [submitting, setSubmitting] = useState(false);
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

  const total = questions.length;
  const progress = total ? ((idx + 1) / total) * 100 : 0;
  const current = questions[idx] ?? "";

  const submitAnswer = async (override?: string) => {
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
      scorecardStore.set(result);
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
        </section>

        {/* Answer */}
        <section>
          <label className="block text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
            Your Answer
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={submitting}
            rows={6}
            placeholder="Type your answer here…"
            className="mt-3 w-full rounded-xl border border-border bg-[oklch(0.11_0.012_280)] px-4 py-3 text-sm placeholder:text-muted-foreground/60 outline-none transition input-glow resize-none"
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
