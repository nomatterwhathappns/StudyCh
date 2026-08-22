import { describe, expect, it } from "vitest";
import { compactKeyTermText, deriveStats, formatDuration, isVocabularyDue, normalizeTerm, REVIEW_AGAIN_MS, REVIEW_DAY_MS, scheduleVocabularyReview, scoreQuiz } from "./study-utils";

describe("StudyOS utility functions", () => {
  it("formats accumulated study duration clearly", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(7260)).toBe("2h 1m");
  });

  it("normalizes vocabulary terms for duplicate detection", () => {
    expect(normalizeTerm("  Resilient ")).toBe("resilient");
  });

  it("compacts legacy Key Term text to the first useful sentence", () => {
    expect(compactKeyTermText("AWS is a cloud computing platform. It has many services and pricing models.", 40)).toBe("AWS is a cloud computing platform.");
    expect(compactKeyTermText("A very long definition without punctuation that keeps going", 24)).toBe("A very long definition…");
  });

  it("derives global vocabulary and quiz statistics", () => {
    const sessions = [{ id: "s", name: "One", createdAt: 0, isPinned: false, materials: [], chatHistory: [], vocabulary: [{ id: "v1", term: "Focus", definition: "attention", createdAt: 0 }, { id: "v2", term: "focus", definition: "attention", createdAt: 0 }], quizzes: [{ id: "q", label: "Quiz 1", questions: [], createdAt: 0, result: { score: 4, total: 5, completedAt: 0 } }], notes: [], studySeconds: 0 }];
    expect(deriveStats(sessions, [{ id: "t", sessionId: "s", sessionName: "One", seconds: 600, pinnedAt: 0 }])).toMatchObject({ totalSessions: 1, totalStudySeconds: 600, averageQuizScore: 80, totalVocabulary: 1 });
  });

  it("scores quiz answers against the configured correct option", () => {
    const result = scoreQuiz({ id: "q", label: "Quiz 1", createdAt: 0, questions: [{ question: "Q", options: ["A", "B", "C", "D"], correct: 1, explanation: "Because" }] }, { 0: 1 });
    expect(result).toEqual({ score: 1, total: 1 });
  });

  it("schedules vocabulary review intervals from the learner's rating", () => {
    const item = { id: "vocab-1", term: "Recall", definition: "Remember", createdAt: 0 };
    expect(isVocabularyDue(item, 0)).toBe(true);
    expect(scheduleVocabularyReview(item, "again", 1_000)).toMatchObject({ dueAt: 1_000 + REVIEW_AGAIN_MS, intervalDays: 0, repetitions: 0, lastRating: "again" });
    expect(scheduleVocabularyReview(item, "good", 1_000)).toMatchObject({ dueAt: 1_000 + 3 * REVIEW_DAY_MS, intervalDays: 3, repetitions: 1, lastRating: "good" });
    expect(scheduleVocabularyReview({ ...item, review: { dueAt: 0, intervalDays: 3, repetitions: 1 } }, "easy", 1_000)).toMatchObject({ dueAt: 1_000 + 10 * REVIEW_DAY_MS, intervalDays: 10, repetitions: 2 });
  });
});
