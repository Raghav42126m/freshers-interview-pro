import { createServerFn } from "@tanstack/react-start";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

interface GenerateInput {
  role: string;
  type: string;
  difficulty: string;
}

interface EvaluateInput {
  role: string;
  type: string;
  difficulty: string;
  qa: { question: string; answer: string }[];
}

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
  .inputValidator((d: unknown) => d as GenerateInput)
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
  .inputValidator((d: unknown) => d as EvaluateInput)
  .handler(async ({ data }) => {
    const sys = `You are a strict but fair Indian interview coach. Evaluate the candidate's answers. Return ONLY JSON in this exact shape:
{
  "overall": <0-100 integer>,
  "clarity": <0-10>,
  "relevance": <0-10>,
  "structure": <0-10>,
  "confidence": <0-10>,
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
    return {
      overall: Math.max(0, Math.min(100, Number(parsed.overall) || 0)),
      clarity: Math.max(0, Math.min(10, Number(parsed.clarity) || 0)),
      relevance: Math.max(0, Math.min(10, Number(parsed.relevance) || 0)),
      structure: Math.max(0, Math.min(10, Number(parsed.structure) || 0)),
      confidence: Math.max(0, Math.min(10, Number(parsed.confidence) || 0)),
      feedback,
    };
  });
