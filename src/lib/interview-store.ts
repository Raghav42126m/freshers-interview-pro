// Simple sessionStorage-backed store for interview session
export type InterviewType = "hr" | "technical" | "behavioral" | "full";
export type Difficulty = "easy" | "medium" | "hard";

export interface InterviewSetup {
  role: string;
  type: InterviewType;
  difficulty: Difficulty;
}

export interface QA {
  question: string;
  answer: string;
}

export interface FillerData {
  total: number;
  breakdown: Record<string, number>;
}

export interface Scorecard {
  overall: number;
  overallOutOf10?: number;
  clarity: number;
  relevance: number;
  structure: number;
  confidence: number;
  bestAnswerIndex?: number;
  bestAnswerReason?: string;
  weakestAnswerIndex?: number;
  weakestAnswerSuggestion?: string;
  keyTip?: string;
  feedback: { question: string; answer: string; note: string }[];
  fillers?: FillerData;
}

const SETUP_KEY = "mm_setup";
const QUESTIONS_KEY = "mm_questions";
const ANSWERS_KEY = "mm_answers";
const SCORECARD_KEY = "mm_scorecard";

export const setupStore = {
  set: (s: InterviewSetup) => sessionStorage.setItem(SETUP_KEY, JSON.stringify(s)),
  get: (): InterviewSetup | null => {
    const v = sessionStorage.getItem(SETUP_KEY);
    return v ? JSON.parse(v) : null;
  },
};

export const questionsStore = {
  set: (q: string[]) => sessionStorage.setItem(QUESTIONS_KEY, JSON.stringify(q)),
  get: (): string[] => {
    const v = sessionStorage.getItem(QUESTIONS_KEY);
    return v ? JSON.parse(v) : [];
  },
};

export const answersStore = {
  set: (a: string[]) => sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(a)),
  get: (): string[] => {
    const v = sessionStorage.getItem(ANSWERS_KEY);
    return v ? JSON.parse(v) : [];
  },
};

export const scorecardStore = {
  set: (s: Scorecard) => sessionStorage.setItem(SCORECARD_KEY, JSON.stringify(s)),
  get: (): Scorecard | null => {
    const v = sessionStorage.getItem(SCORECARD_KEY);
    return v ? JSON.parse(v) : null;
  },
};

const FILLER_KEY = "mm_fillers";

export const fillerStore = {
  add: (counts: Record<string, number>) => {
    const existing = fillerStore.get();
    const total = existing.total + Object.values(counts).reduce((a, b) => a + b, 0);
    const breakdown: Record<string, number> = { ...existing.breakdown };
    for (const [word, count] of Object.entries(counts)) {
      if (count > 0) breakdown[word] = (breakdown[word] || 0) + count;
    }
    const data: FillerData = { total, breakdown };
    sessionStorage.setItem(FILLER_KEY, JSON.stringify(data));
  },
  get: (): FillerData => {
    const v = sessionStorage.getItem(FILLER_KEY);
    if (!v) return { total: 0, breakdown: {} };
    return JSON.parse(v);
  },
  clear: () => sessionStorage.removeItem(FILLER_KEY),
};
// ---- Session history (persists across browser sessions via localStorage) ----

export interface HistoryEntry {
  id: string;
  date: string; // ISO timestamp
  role: string;
  type: InterviewType;
  difficulty: Difficulty;
  overallOutOf10: number;
  clarity: number;
  relevance: number;
  structure: number;
  confidence: number;
  fillerTotal: number;
  questionCount: number;
}

const HISTORY_KEY = "mm_history";
const MAX_HISTORY = 50;

export const historyStore = {
  getAll: (): HistoryEntry[] => {
    try {
      const v = localStorage.getItem(HISTORY_KEY);
      return v ? JSON.parse(v) : [];
    } catch {
      return [];
    }
  },
  add: (entry: Omit<HistoryEntry, "id" | "date">) => {
    try {
      const all = historyStore.getAll();
      const next: HistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: new Date().toISOString(),
      };
      all.unshift(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(all.slice(0, MAX_HISTORY)));
      return next;
    } catch (e) {
      console.error("Failed to save history entry:", e);
      return null;
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  },
};
