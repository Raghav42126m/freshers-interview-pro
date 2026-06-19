import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { historyStore, type HistoryEntry } from "@/lib/interview-store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [{ title: "Your Progress · MockMate" }],
  }),
  component: HistoryPage,
});

function ProgressChart({ entries }: { entries: HistoryEntry[] }) {
  // Chronological order for the chart (oldest first)
  const chrono = [...entries].reverse();
  const W = 600;
  const H = 180;
  const PAD = 24;

  if (chrono.length < 2) {
    return (
      <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
        Complete at least 2 interviews to see your progress graph.
      </div>
    );
  }

  const max = 10;
  const min = 0;
  const stepX = (W - PAD * 2) / (chrono.length - 1);

  const points = chrono.map((e, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((e.overallOutOf10 - min) / (max - min)) * (H - PAD * 2);
    return { x, y, score: e.overallOutOf10 };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[180px]">
      {/* Gridlines at 0, 5, 10 */}
      {[0, 5, 10].map((v) => {
        const y = H - PAD - ((v - min) / (max - min)) * (H - PAD * 2);
        return (
          <g key={v}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" strokeOpacity={0.1} />
            <text x={4} y={y + 3} fontSize="9" fill="currentColor" opacity={0.5}>
              {v}
            </text>
          </g>
        );
      })}
      <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth={2.5} strokeLinecap="round" />
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#e879f9" />
      ))}
    </svg>
  );
}

function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(historyStore.getAll());
    setLoaded(true);
  }, []);

  const handleClear = () => {
    if (!confirm("Clear all interview history? This can't be undone.")) return;
    historyStore.clear();
    setEntries([]);
  };

  const avg =
    entries.length > 0
      ? Math.round((entries.reduce((a, e) => a + e.overallOutOf10, 0) / entries.length) * 10) / 10
      : 0;

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-[640px] mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Your Progress</h1>
          <Link to="/" className="text-xs text-primary hover:underline">
            ← New interview
          </Link>
        </div>

        {!loaded ? (
          <div className="mt-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No interviews completed yet. Finish one to start tracking your progress.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Start your first interview →
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
                  Sessions Completed
                </div>
                <div className="mt-2 text-2xl font-bold">{entries.length}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground">
                  Average Score
                </div>
                <div className="mt-2 text-2xl font-bold">{avg} / 10</div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <div className="text-[11px] tracking-[0.12em] font-semibold uppercase text-muted-foreground mb-2">
                Score Over Time
              </div>
              <ProgressChart entries={entries} />
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Past Sessions
              </h2>
              <div className="mt-4 space-y-3">
                {entries.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-medium">{e.role}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {e.type} · {e.difficulty} ·{" "}
                        {new Date(e.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold">{e.overallOutOf10}/10</div>
                      {e.fillerTotal > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          {e.fillerTotal} fillers
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="mt-8 w-full text-center text-xs text-muted-foreground hover:text-destructive transition-colors py-2"
            >
              Clear history
            </button>
          </>
        )}
      </div>
    </main>
  );
}
