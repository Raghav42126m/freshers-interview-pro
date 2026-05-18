import { useEffect, useState } from "react";

const ROLES = [
  "Software Engineer",
  "Product Manager",
  "Data Analyst",
  "Frontend Developer",
  "Business Analyst",
  "Marketing Manager",
  "UI/UX Designer",
  "Backend Developer",
  "Sales Executive",
  "Data Scientist",
];

const TYPE_MS = 80;
const DELETE_MS = 40;
const HOLD_FULL_MS = 1500;
const HOLD_EMPTY_MS = 400;

export function TypewriterPlaceholder({ hidden }: { hidden: boolean }) {
  const [roleIdx, setRoleIdx] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "holdFull" | "deleting" | "holdEmpty">("typing");

  useEffect(() => {
    if (hidden) return;
    const full = ROLES[roleIdx];
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (text.length < full.length) {
        timer = setTimeout(() => setText(full.slice(0, text.length + 1)), TYPE_MS);
      } else {
        timer = setTimeout(() => setPhase("holdFull"), 0);
      }
    } else if (phase === "holdFull") {
      timer = setTimeout(() => setPhase("deleting"), HOLD_FULL_MS);
    } else if (phase === "deleting") {
      if (text.length > 0) {
        timer = setTimeout(() => setText(full.slice(0, text.length - 1)), DELETE_MS);
      } else {
        timer = setTimeout(() => setPhase("holdEmpty"), 0);
      }
    } else if (phase === "holdEmpty") {
      timer = setTimeout(() => {
        setRoleIdx((i) => (i + 1) % ROLES.length);
        setPhase("typing");
      }, HOLD_EMPTY_MS);
    }

    return () => clearTimeout(timer);
  }, [text, phase, roleIdx, hidden]);

  if (hidden) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground/60 select-none"
    >
      {text}
      <span className="inline-block w-[1px] ml-[1px] animate-pulse">|</span>
    </span>
  );
}
