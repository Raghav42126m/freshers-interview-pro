import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { TypewriterPlaceholder } from "@/components/TypewriterPlaceholder";
import { generateQuestions } from "@/lib/groq.functions";
import {
  setupStore,
  questionsStore,
  answersStore,
  fillerStore,
  type Difficulty,
  type InterviewType,
} from "@/lib/interview-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MockMate — AI Interview Coach for Indian Freshers" },
      {
        name: "description",
        content:
          "Practice mock interviews with an AI coach. Get scored on clarity, relevance, structure and confidence.",
      },
      { property: "og:title", content: "MockMate — AI Interview Coach" },
      {
        property: "og:description",
        content: "AI mock interviews with voice questions and a real scorecard.",
      },
    ],
  }),
  component: HomePage,
});

const ROLES = [
  "APM Intern",
  "SDE Fresher",
  "Data Analyst",
  "Marketing Executive",
  "HR Executive",
  "Business Analyst",
];

const TYPES: { id: InterviewType; title: string; desc: string }[] = [
  { id: "hr", title: "HR Round", desc: "Culture fit, background, motivation" },
  { id: "technical", title: "Technical", desc: "Domain skills & problem solving" },
  { id: "behavioral", title: "Behavioral", desc: "Situations, actions, results" },
  { id: "full", title: "Full Loop", desc: "Mix of all rounds" },
];

const DIFFICULTIES: {
  id: Difficulty;
  label: string;
  ring: string;
  bg: string;
  text: string;
}[] = [
  {
    id: "easy",
    label: "Easy",
    ring: "ring-success/60",
    bg: "bg-success/10",
    text: "text-success",
  },
  {
    id: "medium",
    label: "Medium",
    ring: "ring-warning/60",
    bg: "bg-warning/10",
    text: "text-warning",
  },
  {
    id: "hard",
    label: "Hard",
    ring: "ring-danger/60",
    bg: "bg-danger/10",
    text: "text-danger",
  },
];

function HomePage() {
  const navigate = useNavigate();
  const generate = useServerFn(generateQuestions);

  const [role, setRole] = useState("");
  const [type, setType] = useState<InterviewType>("hr");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeLabel = useMemo(
    () => TYPES.find((t) => t.id === type)?.title ?? "",
    [type],
  );
  const diffLabel = useMemo(
    () => DIFFICULTIES.find((d) => d.id === difficulty)?.label ?? "",
    [difficulty],
  );

  const canStart = role.trim().length > 0 && !loading;

  const start = async () => {
    if (!canStart) return;
    setLoading(true);
    setError(null);
    try {
      const setup = { role: role.trim(), type, difficulty };
      const { questions } = await generate({ data: setup });
      setupStore.set(setup);
      questionsStore.set(questions);
      answersStore.set(new Array(questions.length).fill(""));
      fillerStore.clear();
      navigate({ to: "/interview" });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to start interview");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[560px] flex flex-col items-center">
        {/* Pill badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary-foreground/90">
          <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
          AI Interview Coach
        </div>

        <h1 className="mt-6 text-center text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
          Practice like it's the{" "}
          <span className="text-gradient">real thing.</span>
        </h1>
        <p className="mt-4 text-center text-muted-foreground text-base sm:text-lg max-w-[480px]">
          Enter your target role. MockMate interviews you — speaks the questions,
          listens to your answers, and tells you exactly how to improve.
        </p>

        <div
          className="mt-10 w-full rounded-[20px] border border-border bg-card p-6 sm:p-8 shadow-2xl"
        >
          {/* Role input */}
          <label className="block text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
            What role are you interviewing for?
          </label>
          <div className="relative mt-3">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-border bg-[oklch(0.11_0.012_280)] px-4 py-3 text-base outline-none transition input-glow"
            />
            <TypewriterPlaceholder hidden={role.length > 0} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ROLES.map((r) => {
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                    active
                      ? "border-primary/70 bg-primary/15 text-foreground shadow-glow-sm"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>

          {/* Type */}
          <label className="mt-7 block text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
            Interview Type
          </label>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TYPES.map((t) => {
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`text-left rounded-xl border p-4 transition ${
                   active
                    ? "border-primary bg-primary/20 shadow-glow-sm ring-1 ring-primary/40"
                    : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50"
                  }`}
                >
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Difficulty */}
          <label className="mt-7 block text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
            Difficulty
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                    active
                      ? `border-transparent ${d.bg} ${d.text} ring-1 ${d.ring}`
                      : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* CTA */}
          <button
            type="button"
            disabled={!canStart}
            onClick={start}
            className={`mt-7 w-full rounded-xl py-3.5 text-sm sm:text-base font-semibold transition ${
                canStart
              ? "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95 btn-glow-active"
              : "bg-secondary/40 text-muted-foreground cursor-not-allowed"
            }`}
          >
            {loading
              ? "Preparing your interview…"
              : role.trim()
                ? `Start ${diffLabel} ${typeLabel} →`
                : "Enter a role to begin"}
          </button>

          {error && (
            <p className="mt-3 text-xs text-destructive text-center">{error}</p>
          )}

          <p className="mt-5 text-center text-xs text-muted-foreground">
            🎙️ AI will speak questions aloud · ~10 questions · Scorecard at the end
          </p>
        </div>
      </div>
    </main>
  );
}
