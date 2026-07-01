import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

// Runtime input validation caps abuse of the (public) Groq-backed endpoints:
// oversized/malformed payloads are rejected before any token is spent upstream.
const typeSchema = z.enum(["hr", "technical", "behavioral", "full"]);
const difficultySchema = z.enum(["easy", "medium", "hard"]);
const roleSchema = z.string().trim().min(1).max(120);

const generateSchema = z.object({
  role: roleSchema,
  type: typeSchema,
  difficulty: difficultySchema,
});

const evaluateSchema = z.object({
  role: roleSchema,
  type: typeSchema,
  difficulty: difficultySchema,
  qa: z
    .array(
      z.object({
        question: z.string().max(1000),
        answer: z.string().max(8000),
      }),
    )
    .min(1)
    .max(20),
});

const hintSchema = z.object({
  role: roleSchema,
  type: typeSchema,
  question: z.string().trim().min(1).max(1000),
});

async function callGroq(messages: { role: string; content: string }[], jsonMode = true) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const TYPE_LABEL: Record<string, string> = {
  hr: "HR round (culture fit, background, motivation)",
  technical: "Technical round (domain skills, problem solving)",
  behavioral: "Behavioral round (situations, actions, results — STAR)",
  full: "Full loop covering HR, technical and behavioral",
};

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => generateSchema.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are an experienced Indian tech interviewer. Generate exactly 10 sharp, role-specific interview questions for a fresher candidate. Return ONLY JSON in the form: {"questions": ["q1", "q2", ...]}. No commentary.`;
    const user = `Role: ${data.role}
Round: ${TYPE_LABEL[data.type] ?? data.type}
Difficulty: ${data.difficulty}
Audience: Indian freshers / early-career candidates.
Generate 10 questions appropriate for this round and difficulty. Mix easier opener with deeper questions. Keep each under 30 words.`;

    const raw = await callGroq([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    const parsed = JSON.parse(raw);
    const qs: string[] = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 10) : [];
    if (qs.length === 0) throw new Error("No questions generated");
    return { questions: qs };
  });

export const evaluateInterview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => evaluateSchema.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a strict but fair Indian interview coach. Evaluate the candidate's answers. Return ONLY JSON in this exact shape:
{
  "overall": <0-100 integer>,
  "overallOutOf10": <0-10 number, one decimal>,
  "clarity": <0-10>,
  "relevance": <0-10>,
  "structure": <0-10>,
  "confidence": <0-10>,
  "bestAnswerIndex": <0-based index>,
  "bestAnswerReason": "<one short sentence, <25 words>",
  "weakestAnswerIndex": <0-based index>,
  "weakestAnswerSuggestion": "<one short improvement, <25 words>",
  "keyTip": "<one specific actionable tip, <30 words>",
  "feedback": [{"note": "<one short improvement tip, <25 words>"}]
}
The feedback array must have exactly one entry per question, in order.`;
    const user = `Role: ${data.role}
Round: ${TYPE_LABEL[data.type] ?? data.type}
Difficulty: ${data.difficulty}

Q&A:
${data.qa.map((x, i) => `Q${i + 1}: ${x.question}\nA${i + 1}: ${x.answer || "(no answer)"}`).join("\n\n")}

Score honestly. Empty/very short answers should score low.`;

    const raw = await callGroq([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    const parsed = JSON.parse(raw);
    const feedback = (parsed.feedback ?? []).map((f: { note?: string }, i: number) => ({
      question: data.qa[i]?.question ?? "",
      answer: data.qa[i]?.answer ?? "",
      note: f?.note ?? "",
    }));
    const n = data.qa.length;
    const clampIdx = (v: unknown) => {
      const i = Number(v);
      return Number.isFinite(i) && i >= 0 && i < n ? Math.floor(i) : 0;
    };
    const overall = Math.max(0, Math.min(100, Number(parsed.overall) || 0));
    const overallOutOf10 =
      typeof parsed.overallOutOf10 === "number"
        ? Math.max(0, Math.min(10, parsed.overallOutOf10))
        : Math.round((overall / 10) * 10) / 10;
    return {
      overall,
      overallOutOf10,
      clarity: Math.max(0, Math.min(10, Number(parsed.clarity) || 0)),
      relevance: Math.max(0, Math.min(10, Number(parsed.relevance) || 0)),
      structure: Math.max(0, Math.min(10, Number(parsed.structure) || 0)),
      confidence: Math.max(0, Math.min(10, Number(parsed.confidence) || 0)),
      bestAnswerIndex: clampIdx(parsed.bestAnswerIndex),
      bestAnswerReason: String(parsed.bestAnswerReason ?? ""),
      weakestAnswerIndex: clampIdx(parsed.weakestAnswerIndex),
      weakestAnswerSuggestion: String(parsed.weakestAnswerSuggestion ?? ""),
      keyTip: String(parsed.keyTip ?? ""),
      feedback,
    };
  });
export const generateHint = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => hintSchema.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are an experienced Indian interview coach. Given one interview question, give the candidate a short hint on HOW to structure their answer — not a full scripted answer. Return ONLY JSON: {"approach": "<1 sentence on the structure/approach to use, <30 words>", "pointers": ["<short bullet point to mention>", "<short bullet point>", "<short bullet point>"]}. 2-4 pointers. Do not write the full answer for them — only the approach and what to touch on.`;
    const user = `Role: ${data.role}
Round: ${TYPE_LABEL[data.type] ?? data.type}
Question: ${data.question}

Give a brief structural hint, not a full answer.`;

    const raw = await callGroq([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    const parsed = JSON.parse(raw);
    const pointers: string[] = Array.isArray(parsed.pointers)
      ? parsed.pointers.slice(0, 4).map((p: unknown) => String(p))
      : [];
    return {
      approach: String(parsed.approach ?? ""),
      pointers,
    };
  });
