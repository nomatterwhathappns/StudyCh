// @vitest-environment jsdom
import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { addVocabulary, addMessage, keyTermCallbacks } = vi.hoisted(() => ({
  addVocabulary: vi.fn(),
  addMessage: vi.fn(),
  keyTermCallbacks: { value: undefined as undefined | { onSuccess?: (draft: { term: string; definition: string; context: string; example: string }) => void } },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    study: {
      explain: { useMutation: () => ({ mutate: vi.fn(), reset: vi.fn() }) },
      draftKeyTerm: { useMutation: () => ({ mutate: (_input: unknown, callbacks: typeof keyTermCallbacks.value) => { keyTermCallbacks.value = callbacks; }, reset: vi.fn() }) },
      draftVocabulary: { useMutation: () => ({ mutate: vi.fn(), reset: vi.fn() }) },
    },
  },
}));

vi.mock("@/store/useStudyStore", () => {
  const state = { addVocabulary, addMessage, sessions: [] };
  const useStudyStore = Object.assign((selector?: (value: typeof state) => unknown) => selector ? selector(state) : state, { getState: () => state });
  return { useStudyStore };
});

import { SourceAiActivityProvider, useSourceAiActivity } from "./SourceAiActivityContext";

function SourceTaskStarter({ visible }: { visible: boolean }) {
  const sourceAi = useSourceAiActivity();
  if (!visible) return null;
  return <button type="button" onClick={() => sourceAi.startKeyTerm({ sessionId: "session-a", sessionName: "Biology", materials: "Plants use light.", responseStyle: "Balanced", model: "local-9router", selection: "Photosynthesis" })}>Start Save Terms</button>;
}

function SourceTaskStatus() {
  const sourceAi = useSourceAiActivity();
  const task = sourceAi.tasks[0];
  return <p>{task ? `${task.status}:${task.selection}` : "idle"}</p>;
}

describe("Source AI activity provider", () => {
  it("keeps a Save Terms request and its draft when the Source panel unmounts", () => {
    const ui = render(<SourceAiActivityProvider><SourceTaskStarter visible /><SourceTaskStatus /></SourceAiActivityProvider>);
    fireEvent.click(ui.getByRole("button", { name: "Start Save Terms" }));
    expect(ui.getByText("pending:Photosynthesis")).toBeTruthy();

    ui.rerender(<SourceAiActivityProvider><SourceTaskStarter visible={false} /><SourceTaskStatus /></SourceAiActivityProvider>);
    act(() => keyTermCallbacks.value?.onSuccess?.({ term: "Photosynthesis", definition: "Converts light to chemical energy.", context: "Plants", example: "Leaves" }));

    expect(ui.getByText("review:Photosynthesis")).toBeTruthy();
  });
});
