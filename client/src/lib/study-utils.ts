import type { Quiz, StudySession, TimerEntry, VocabItem, VocabReview, VocabReviewRating } from "./study-types";

export const REVIEW_DAY_MS = 86_400_000;
export const REVIEW_AGAIN_MS = 600_000;

export function makeId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function normalizeTerm(term: string) {
  return term.trim().toLocaleLowerCase();
}

export function compactKeyTermText(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const sentenceEnd = clean.search(/[.!?](?:\s|$)/);
  const firstSentence = sentenceEnd >= 0 ? clean.slice(0, sentenceEnd + 1) : clean;
  if (firstSentence.length <= maxLength) return firstSentence;
  return `${firstSentence.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function vocabularyDueAt(item: VocabItem) {
  return item.review?.dueAt ?? item.createdAt;
}

export function isVocabularyDue(item: VocabItem, now = Date.now()) {
  return vocabularyDueAt(item) <= now;
}

export function scheduleVocabularyReview(item: VocabItem, rating: VocabReviewRating, reviewedAt = Date.now()): VocabReview {
  const currentInterval = item.review?.intervalDays ?? 0;
  const currentRepetitions = item.review?.repetitions ?? 0;
  const intervalDays = rating === "again"
    ? 0
    : rating === "hard"
      ? Math.max(1, currentInterval ? Math.ceil(currentInterval * 1.35) : 1)
      : rating === "good"
        ? Math.min(60, currentInterval ? Math.ceil(currentInterval * 2.2) : 3)
        : Math.min(90, currentInterval ? Math.ceil(currentInterval * 3.2) : 7);
  return {
    dueAt: rating === "again" ? reviewedAt + REVIEW_AGAIN_MS : reviewedAt + intervalDays * REVIEW_DAY_MS,
    intervalDays,
    repetitions: rating === "again" ? 0 : currentRepetitions + 1,
    lastReviewedAt: reviewedAt,
    lastRating: rating,
  };
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function sessionVocabulary(sessions: StudySession[]) {
  const unique = new Map<string, VocabItem & { sessionName: string; sessionId: string }>();
  sessions.forEach((session) => {
    session.vocabulary.forEach((item) => {
      const key = normalizeTerm(item.term);
      if (!unique.has(key)) unique.set(key, { ...item, sessionName: session.name, sessionId: session.id });
    });
  });
  return Array.from(unique.values()).sort((a, b) => a.term.localeCompare(b.term));
}

export function deriveStats(sessions: StudySession[], timers: TimerEntry[]) {
  const totalStudySeconds = timers.reduce((sum, timer) => sum + timer.seconds, 0);
  const results = sessions.flatMap((session) => session.quizzes.flatMap((quiz) => quiz.result ? [quiz.result] : []));
  const averageQuizScore = results.length
    ? Math.round(results.reduce((sum, result) => sum + (result.score / result.total) * 100, 0) / results.length)
    : 0;
  return {
    totalSessions: sessions.length,
    totalStudySeconds,
    averageQuizScore,
    totalVocabulary: sessionVocabulary(sessions).length,
  };
}

export function scoreQuiz(quiz: Quiz, answers: Record<number, number>) {
  const score = quiz.questions.reduce((total, question, index) => total + (answers[index] === question.correct ? 1 : 0), 0);
  return { score, total: quiz.questions.length };
}

export function plainText(html: string) {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ");
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent ?? "";
}
