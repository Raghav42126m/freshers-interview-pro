import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { scorecardStore, type Scorecard } from "@/lib/interview-store";

export const Route = createFileRoute("/scorecard")({
  head: () => ({
    meta: [{ title: "Your Scorecard · MockMate" }],
  }),
  component: ScorecardPage,
});

function Ring({ score }: { score: number }) {
  const r = 72;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth="10" fill="none" />
        <circle
          cx="80"
          cy="80"
          r={r}
          stroke="url(#g)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.18 295)" />
            <stop offset="100%" stopColor="oklch(0.55 0.24 275)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-bold">{score}</div>
        <div className="text-xs text-muted-foreground">out of 100</div>
      </div>
    </div>
  );
}

function MetricCard({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground">/ 10</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-secondary/60 overflow-hidden">
        <div
          className="h-full bg-gradient-primary"
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

function ScorecardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Scorecard | null>(null);

  useEffect(() => {
    const s = scorecardStore.get();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setData(s);
  }, [navigate]);

  const share = async () => {
    if (!data) return;
    const text = `My MockMate score: ${data.overall}/100 — Clarity ${data.clarity}, Relevance ${data.relevance}, Structure ${data.structure}, Confidence ${data.confidence}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "MockMate Scorecard", text });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Scorecard copied to clipboard");
      }
    } catch {
      /* ignore */
    }
  };

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-[600px] mx-auto">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
            Interview complete
          </div>
          <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight">
            Your <span className="text-gradient">scorecard</span>
          </h1>
          <div className="mt-8 flex justify-center">
            <Ring score={data.overall} />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <MetricCard label="Clarity" score={data.clarity} />
          <MetricCard label="Relevance" score={data.relevance} />
          <MetricCard label="Structure" score={data.structure} />
          <MetricCard label="Confidence" score={data.confidence} />
        </div>

        {data.fillers && data.fillers.total > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
              Filler Words
            </div>
            <div className="mt-1 text-2xl font-bold">{data.fillers.total}</div>
            <div className="text-xs text-muted-foreground">total detected</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(data.fillers.breakdown)
                .filter(([, count]) => count > 0)
                .map(([word, count]) => (
                  <span
                    key={word}
                    className="inline-flex items-center rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs font-medium"
                  >
                    {word}: {count}
                  </span>
                ))}
            </div>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Question-by-question feedback
          </h2>
          <div className="mt-4 space-y-3">
            {data.feedback.map((f, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="text-xs text-muted-foreground">
                  Question {i + 1}
                </div>
                <div className="mt-1 text-sm font-medium">{f.question}</div>
                <div className="mt-2 text-xs text-muted-foreground line-clamp-3">
                  <span className="text-foreground/80">Your answer:</span>{" "}
                  {f.answer || <em>(no answer)</em>}
                </div>
                <div className="mt-2 text-xs italic text-muted-foreground border-t border-border pt-2">
                  {f.note}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => {
              sessionStorage.clear();
              navigate({ to: "/" });
            }}
            className="flex-1 rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Practice Again
          </button>
          <button
            type="button"
            onClick={share}
            className="flex-1 rounded-xl border border-border bg-secondary/40 py-3 text-sm font-semibold hover:bg-secondary/60"
          >
            Share Scorecard
          </button>
        </div>
      </div>
    </main>
  );
}
