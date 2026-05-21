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
  clarity: number;
  relevance: number;
  structure: number;
  confidence: number;
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
