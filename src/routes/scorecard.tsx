import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
    <div className="rounded-xl border border-[#262626] bg-[#161616] p-4">
      <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-neutral-400">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1 text-white">
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-xs text-neutral-400">/ 10</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-[#262626] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

// html2canvas 1.x can't parse oklch/color-mix/lab. Normalize cloned DOM to rgb().
function normalizeColorsForCapture(root: HTMLElement) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return;
  const toRgb = (v: string) => {
    try {
      ctx.fillStyle = "#000";
      ctx.fillStyle = v;
      return ctx.fillStyle as string;
    } catch {
      return "";
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
  const walk = (el: Element) => {
    if (el instanceof HTMLElement || el instanceof SVGElement) {
      const cs = getComputedStyle(el);
      for (const p of props) {
        const v = cs[p as keyof CSSStyleDeclaration] as string;
        if (v && /oklch|color-mix|lab\(|lch\(/.test(v)) {
          const rgb = toRgb(v);
          if (rgb) (el.style as CSSStyleDeclaration)[p as never] = rgb as never;
        }
      }
      const bg = cs.backgroundImage;
      if (bg && /oklch|color-mix|lab\(|lch\(/.test(bg)) {
        (el as HTMLElement).style.backgroundImage = "none";
      }
    }
    for (const c of Array.from(el.children)) walk(c);
  };
  walk(root);
}

function ScorecardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Scorecard | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const s = scorecardStore.get();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setData(s);
  }, [navigate]);

  const isMobile =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleDownload = async () => {
    if (!isMobile) {
      window.print();
      return;
    }
    const element = document.getElementById("scorecard-capture");
    if (!element) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0f0f0f",
        onclone: (doc) => {
          const el = doc.getElementById("scorecard-capture");
          if (el) normalizeColorsForCapture(el);
        },
      });
      const dataUrl = canvas.toDataURL("image/png");
      const t = window.open();
      if (t) {
        t.document.write(
          `<img src="${dataUrl}" style="width:100%;max-width:600px;display:block;margin:auto;">`,
        );
        t.document.write(
          '<p style="text-align:center;font-family:sans-serif;color:#666;">Press and hold image → Save to Photos</p>',
        );
      }
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
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
    data.weakestAnswerIndex !== undefined ? data.feedback[data.weakestAnswerIndex] : undefined;

  return (
    <main id="scorecard-capture" className="min-h-screen px-4 py-12">
      <div className="max-w-[640px] mx-auto">
        <div
          style={{ backgroundColor: "#0f0f0f", padding: "24px" }}
          className="rounded-2xl space-y-4 text-white"
        >
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Interview complete
            </div>
            <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Your MockMate Scorecard
            </h1>
          </div>

          <div className="rounded-2xl border border-[#262626] bg-[#161616] p-8 text-center">
            <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-neutral-400">
              Overall Score
            </div>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-6xl sm:text-7xl font-bold bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
                {outOf10.toFixed(1)}
              </span>
              <span className="text-xl text-neutral-400">/ 10</span>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              based on clarity, relevance &amp; confidence
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Clarity" score={data.clarity} />
            <MetricCard label="Relevance" score={data.relevance} />
            <MetricCard label="Structure" score={data.structure} />
            <MetricCard label="Confidence" score={data.confidence} />
          </div>

          <div className="rounded-xl border border-[#262626] bg-[#161616] p-5">
            <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-neutral-400">
              Filler Words
            </div>
            {data.fillers && data.fillers.total > 0 ? (
              <>
                <div className="mt-2 text-sm text-neutral-300">
                  <span className="text-2xl font-bold text-white">{data.fillers.total}</span>
                  <span className="text-neutral-400"> filler words detected</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {fillerBreakdown.map(([word, count]) => (
                    <span
                      key={word}
                      className="inline-flex items-center rounded-full border border-[#2d2d2d] bg-[#1f1f1f] px-2.5 py-1 text-xs font-medium text-neutral-200"
                    >
                      {word}: {count}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-neutral-400">
                No filler words detected. Crisp delivery!
              </div>
            )}
          </div>

          {bestQ && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-emerald-300">
                ★ Best Answer
              </div>
              <div className="mt-2 text-sm font-medium text-white">{bestQ.question}</div>
              {data.bestAnswerReason && (
                <div className="mt-2 text-xs text-neutral-300 italic">
                  {data.bestAnswerReason}
                </div>
              )}
            </div>
          )}

          {weakestQ && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
              <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-amber-300">
                ⚠ Weakest Answer
              </div>
              <div className="mt-2 text-sm font-medium text-white">{weakestQ.question}</div>
              {data.weakestAnswerSuggestion && (
                <div className="mt-2 text-xs text-neutral-300 italic">
                  {data.weakestAnswerSuggestion}
                </div>
              )}
            </div>
          )}

          {data.keyTip && (
            <div className="rounded-xl border border-indigo-400/30 bg-indigo-400/10 p-5">
              <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-indigo-300">
                💡 One Key Tip
              </div>
              <div className="mt-2 text-sm leading-relaxed text-neutral-100">{data.keyTip}</div>
            </div>
          )}
        </div>

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

        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {downloading ? "Generating image…" : isMobile ? "Save as Image" : "Download PDF"}
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
          {!showFeedback && (
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              How was your experience? Tell us →
            </button>
          )}
        </div>

        {showFeedback && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            {submitted ? (
              <div className="text-center text-sm py-4">
                Thanks! You're helping build the #1 interview tool for Indian freshers 🙌
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div className="text-sm font-semibold">How was your experience?</div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-2xl transition-transform hover:scale-110"
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    >
                      <span
                        className={
                          (hoverRating || rating) >= n
                            ? "text-warning"
                            : "text-muted-foreground/40"
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What should MockMate improve?"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm input-glow resize-none"
                />
                <button
                  type="submit"
                  disabled={rating === 0}
                  className="w-full rounded-lg bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Submit Feedback
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
