import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { scorecardStore, type Scorecard } from "@/lib/interview-store";

export const Route = createFileRoute("/scorecard")({
  head: () => ({
    meta: [{ title: "Your Scorecard · MockMate" }],
  }),
  component: ScorecardPage,
});

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

// html2canvas v1 cannot parse modern color functions (oklch, color-mix, lab).
// We walk the cloned tree and inline computed colors converted to rgb()
// via a 2d canvas, which normalizes any color the browser understands.
function normalizeColorsForCapture(root: HTMLElement) {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return;
  const toRgb = (value: string): string | null => {
    if (!value || value === "none" || value === "transparent") return null;
    try {
      probe.fillStyle = "#000";
      probe.fillStyle = value;
      return probe.fillStyle as string;
    } catch {
      return null;
    }
  };
  const props = [
    "color",
    "backgroundColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "fill",
    "stroke",
  ] as const;
  const all = root.querySelectorAll<HTMLElement>("*");
  const apply = (el: HTMLElement) => {
    const cs = window.getComputedStyle(el);
    for (const p of props) {
      const v = toRgb(cs[p as never] as string);
      if (v) (el.style as any)[p] = v;
    }
    const bg = cs.backgroundImage;
    if (bg && bg !== "none" && /oklch|color-mix|lab\(|lch\(/i.test(bg)) {
      el.style.backgroundImage = "none";
    }
  };
  apply(root);
  all.forEach(apply);
}

function ScorecardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Scorecard | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const s = scorecardStore.get();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setData(s);
  }, [navigate]);

  const handleDownload = async () => {
    const el = document.getElementById("scorecard");
    if (!el) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#0a0a0f",
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (_doc, cloned) => {
          if (cloned instanceof HTMLElement) normalizeColorsForCapture(cloned);
        },
      });
      const link = document.createElement("a");
      link.download = "mockmate-scorecard.png";
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Scorecard download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  const outOf10 =
    typeof data.overallOutOf10 === "number"
      ? data.overallOutOf10
      : Math.round((data.overall / 10) * 10) / 10;

  const fillerBreakdown = data.fillers
    ? Object.entries(data.fillers.breakdown).filter(([, c]) => c > 0)
    : [];

  const bestQ =
    data.bestAnswerIndex !== undefined ? data.feedback[data.bestAnswerIndex] : undefined;
  const weakestQ =
    data.weakestAnswerIndex !== undefined
      ? data.feedback[data.weakestAnswerIndex]
      : undefined;

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-[640px] mx-auto">
        <div ref={cardRef} className="space-y-4 p-2">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
              Interview complete
            </div>
            <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight">
              Your <span className="text-gradient">scorecard</span>
            </h1>
          </div>

          {/* Overall score */}
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
              Overall Score
            </div>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-6xl sm:text-7xl font-bold text-gradient">
                {outOf10.toFixed(1)}
              </span>
              <span className="text-xl text-muted-foreground">/ 10</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              based on clarity, relevance &amp; confidence
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Clarity" score={data.clarity} />
            <MetricCard label="Relevance" score={data.relevance} />
            <MetricCard label="Structure" score={data.structure} />
            <MetricCard label="Confidence" score={data.confidence} />
          </div>

          {/* Filler words */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
              Filler Words
            </div>
            {data.fillers && data.fillers.total > 0 ? (
              <>
                <div className="mt-2 text-sm">
                  <span className="text-2xl font-bold">{data.fillers.total}</span>
                  <span className="text-muted-foreground"> filler words detected</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {fillerBreakdown.map(([word, count]) => (
                    <span
                      key={word}
                      className="inline-flex items-center rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs font-medium"
                    >
                      {word}: {count}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                No filler words detected. Crisp delivery!
              </div>
            )}
          </div>

          {/* Best answer */}
          {bestQ && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-5">
              <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-success">
                ★ Best Answer
              </div>
              <div className="mt-2 text-sm font-medium">{bestQ.question}</div>
              {data.bestAnswerReason && (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  {data.bestAnswerReason}
                </div>
              )}
            </div>
          )}

          {/* Weakest answer */}
          {weakestQ && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
              <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-warning">
                ⚠ Weakest Answer
              </div>
              <div className="mt-2 text-sm font-medium">{weakestQ.question}</div>
              {data.weakestAnswerSuggestion && (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  {data.weakestAnswerSuggestion}
                </div>
              )}
            </div>
          )}

          {/* Key tip */}
          {data.keyTip && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-primary">
                💡 One Key Tip
              </div>
              <div className="mt-2 text-sm leading-relaxed">{data.keyTip}</div>
            </div>
          )}
        </div>

        {/* Per question feedback */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Question-by-question feedback
          </h2>
          <div className="mt-4 space-y-3">
            {data.feedback.map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Question {i + 1}</div>
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

        {/* Actions */}
        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {downloading ? "Preparing image…" : "📥 Download as Image"}
          </button>
          <button
            type="button"
            onClick={() => {
              sessionStorage.clear();
              navigate({ to: "/" });
            }}
            className="w-full rounded-xl border border-border bg-secondary/40 py-3 text-sm font-semibold hover:bg-secondary/60"
          >
            Practice Again
          </button>
          <button
            type="button"
            onClick={() => {
              /* suggestion box — coming soon */
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            How was your experience? Tell us →
          </button>
        </div>
      </div>
    </main>
  );
}
