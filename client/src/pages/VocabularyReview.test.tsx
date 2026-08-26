// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import type { StudySession } from "@/lib/study-types";

const { reviewVocabulary } = vi.hoisted(() => ({ reviewVocabulary: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: { study: {
    quiz: { useMutation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }) },
    explain: { useMutation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }) },
    draftKeyTerm: { useMutation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }) },
    draftVocabulary: { useMutation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }) },
  } },
}));

vi.mock("@/store/useStudyStore", () => {
  const state = { addTimer: vi.fn(), updateSession: vi.fn(), addQuiz: vi.fn(), addVocabulary: vi.fn(), addMessage: vi.fn(), saveQuizResult: vi.fn(), addNote: vi.fn(), updateNote: vi.fn(), deleteNote: vi.fn(), reviewVocabulary, sessions: [] };
  const useStudyStore = Object.assign((selector?: (value: typeof state) => unknown) => selector ? selector(state) : state, { getState: () => state });
  return { useStudyStore };
});

vi.mock("@/components/studyos/NoteEditor", () => ({ NoteEditor: () => <div>Note editor</div> }));

import { WatchPanel } from "./StudyWorkspace";
import { SourceAiActivityProvider } from "@/contexts/SourceAiActivityContext";

const session: StudySession = {
  id: "vocab-session", name: "Memory", createdAt: 0, isPinned: false, materials: [], chatHistory: [],
  quizzes: Array.from({ length: 5 }, (_, index) => ({ id: `quiz-${index + 1}`, label: `Quiz ${index + 1}`, questions: [{ question: "Question", options: ["A", "B", "C", "D"], correct: 0, explanation: "Explanation" }], result: index === 0 ? { score: 4, total: 5, completedAt: 0 } : undefined, createdAt: 0 })),
  notes: Array.from({ length: 5 }, (_, index) => ({ id: `note-${index + 1}`, name: `Note ${index + 1}`, content: "<p>Study note</p>", createdAt: 0, updatedAt: 0 })),
  studySeconds: 0,
  vocabulary: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map((term, index) => ({ id: `v${index + 1}`, term, definition: `${term} definition`, createdAt: 0, review: { dueAt: 0, intervalDays: 0, repetitions: 0 } })),
};

function WatchPanelWithProvider({ session }: { session: StudySession }) {
  return <SourceAiActivityProvider><WatchPanel session={session} /></SourceAiActivityProvider>;
}

describe("Watch vocabulary review", () => {
  beforeEach(() => reviewVocabulary.mockReset());
  afterEach(() => cleanup());

  it.each([["desktop", 1280], ["mobile", 375]])("shows every saved term in the scrollable list and schedules a flashcard on %s", async (_layout, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const ui = render(<WatchPanelWithProvider session={session} />);
    expect(ui.getByText("Alpha")).toBeTruthy();
    expect(ui.getByText("Epsilon")).toBeTruthy();
    expect(ui.queryByRole("button", { name: "Next Key Terms page" })).toBeNull();

    const alphaPreview = ui.getByRole("button", { name: "Preview key term Alpha" });
    if (width > 720) {
      fireEvent.mouseEnter(alphaPreview);
      await waitFor(() => expect(ui.getByText("Alpha definition")).toBeTruthy());
    }
    fireEvent.click(alphaPreview);
    expect(ui.getByText("Key Term preview")).toBeTruthy();
    expect(ui.getByRole("button", { name: "Close preview" })).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "Close preview" }));

    const reviewButton = ui.getByRole("button", { name: /Review key terms flashcards/i });
    expect(reviewButton.getAttribute("aria-label")).toBe("Review key terms flashcards");
    fireEvent.click(reviewButton);
    await waitFor(() => expect(ui.getByRole("dialog")).toBeTruthy());
    fireEvent.click(ui.getByRole("button", { name: "Reveal answer" }));
    expect(within(ui.getByRole("dialog")).getByText("Alpha definition")).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: /^Good/ }));
    expect(reviewVocabulary).toHaveBeenCalledWith("vocab-session", "v1", "good");
  });

  it.each([['desktop', 1280], ['mobile', 375]])("keeps every quiz and note available through dedicated scroll areas without quiz pagination on %s", (_layout, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const ui = render(<WatchPanelWithProvider session={session} />);

    expect(ui.getByText("Quiz 5")).toBeTruthy();
    expect(ui.getByText("Note 5")).toBeTruthy();
    expect(ui.getByText("80% · 4/5 benar")).toBeTruthy();
    expect(ui.getAllByText("Belum dikerjakan")).toHaveLength(4);
    expect(ui.queryByRole("button", { name: "Next Quiz page" })).toBeNull();
    expect(ui.container.querySelector(".study-quiz-scroll")?.className).toContain("study-quiz-scroll");
    expect(ui.container.querySelector(".study-notes-scroll")?.className).toContain("study-notes-scroll");
    if (width === 1280) {
      const notesScroll = ui.container.querySelector(".study-notes-scroll");
      expect(notesScroll?.closest('[data-slot="scroll-area"]')?.className).toContain("flex-1");
      expect(notesScroll?.closest(".study-watch-panel")).toBeTruthy();
    }
  });
});
