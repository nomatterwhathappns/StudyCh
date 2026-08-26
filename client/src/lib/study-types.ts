export type Material = {
  id: string;
  title: string;
  type: "url" | "file";
  content: string;
  url?: string;
  format?: "PDF" | "DOCX" | "TXT" | "MD" | "CSV";
  createdAt: number;
};

export type StudyMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: StudyCitation[];
  truncated?: boolean;
  provider?: string;
  createdAt: number;
};

export type StudyCitation = {
  title: string;
  ordinal: number;
  materialId?: string;
};

export type VocabItem = {
  id: string;
  term: string;
  definition: string;
  context?: string;
  example?: string;
  sourceExcerpt?: string;
  createdAt: number;
  review?: VocabReview;
};

export type VocabReviewRating = "again" | "hard" | "good" | "easy";

export type VocabReview = {
  dueAt: number;
  intervalDays: number;
  repetitions: number;
  lastReviewedAt?: number;
  lastRating?: VocabReviewRating;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

export type Quiz = {
  id: string;
  label: string;
  questions: QuizQuestion[];
  result?: { score: number; total: number; completedAt: number };
  createdAt: number;
};

export type StudyNote = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type StudySession = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  isPinned: boolean;
  materials: Material[];
  chatHistory: StudyMessage[];
  vocabulary: VocabItem[];
  quizzes: Quiz[];
  notes: StudyNote[];
  studySeconds: number;
};

export type TimerEntry = {
  id: string;
  sessionId: string;
  sessionName: string;
  seconds: number;
  pinnedAt: number;
};

export type Profile = {
  name: string;
  avatar?: string;
  aiName?: string;
};

export type StudySnapshot = {
  profile: Profile;
  sessions: StudySession[];
  timers: TimerEntry[];
  activeSessionId: string | null;
};
