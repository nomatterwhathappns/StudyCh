// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { StudySession } from "@/lib/study-types";

const { uploadDocumentMutate, chatMutate, chatCallbacks, continueMutate, draftKeyTermMutate, draftVocabularyMutate, draftKeyTermShouldFail, translateChatMutateAsync, translateChatIsPending, addMaterial, addMessage, addVocabulary, profileState } = vi.hoisted(() => ({
  uploadDocumentMutate: vi.fn(), chatMutate: vi.fn(), continueMutate: vi.fn(), draftKeyTermMutate: vi.fn(), draftVocabularyMutate: vi.fn(), draftKeyTermShouldFail: { value: false }, translateChatMutateAsync: vi.fn(), addMaterial: vi.fn(), addMessage: vi.fn(), addVocabulary: vi.fn(),
  translateChatIsPending: { value: false },
  profileState: { value: { name: "Learner", aiName: "StudyOS" } },
  chatCallbacks: { onSuccess: undefined as undefined | ((value: { text: string; citations: Array<{ title: string; ordinal: number }>; truncated: boolean; provider?: string }) => void), onError: undefined as undefined | ((reason: { message: string }) => void) },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    study: {
      explain: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      fetchSource: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      uploadDocument: { useMutation: () => ({ mutate: uploadDocumentMutate, isPending: false }) },
      draftKeyTerm: { useMutation: () => ({ mutate: (input: unknown, callbacks?: { onSuccess?: (value: { term: string; definition: string; context: string; example: string }) => void; onError?: (reason: { message: string }) => void }) => { draftKeyTermMutate(input); if (draftKeyTermShouldFail.value) { callbacks?.onError?.({ message: "StudyOS AI could not prepare that Key Term." }); return; } callbacks?.onSuccess?.({ term: "AWS S3", definition: "Object storage from AWS.", context: "It stores objects in buckets.", example: "Store a PDF in an S3 bucket." }); }, reset: vi.fn(), isPending: false }) },
      draftVocabulary: { useMutation: () => ({ mutate: (input: unknown, callbacks?: { onSuccess?: (value: { term: string; meaning: string }) => void }) => { draftVocabularyMutate(input); callbacks?.onSuccess?.({ term: "photosynthesis", meaning: "fotosintesis" }); }, reset: vi.fn(), isPending: false }) },
      chat: { useMutation: () => ({ mutate: (input: unknown, callbacks?: { onSuccess?: (value: { text: string; citations: Array<{ title: string; ordinal: number }>; truncated: boolean; provider?: string }) => void; onError?: (reason: { message: string }) => void }) => { chatCallbacks.onSuccess = callbacks?.onSuccess; chatCallbacks.onError = callbacks?.onError; chatMutate(input); }, reset: vi.fn(), isPending: false }) },
      translateChat: { useMutation: () => ({ mutateAsync: translateChatMutateAsync, reset: vi.fn(), isPending: translateChatIsPending.value }) },
      continue: { useMutation: (options: { onSuccess?: (value: { text: string; citations: Array<{ title: string; ordinal: number }>; truncated: boolean }) => void }) => ({ mutate: (input: unknown) => { continueMutate(input); options.onSuccess?.({ text: "Lanjutan yang selesai.", citations: [], truncated: false }); }, isPending: false }) },
    },
  },
}));

vi.mock("@/store/useStudyStore", () => {
  const state = () => ({ profile: profileState.value, addMaterial, deleteMaterial: vi.fn(), addVocabulary, addMessage, updateSession: vi.fn(), deleteSession: vi.fn() });
  const useStudyStore = Object.assign((selector?: (value: ReturnType<typeof state>) => unknown) => selector ? selector(state()) : state(), { getState: () => ({ ...state(), sessions: [] }) });
  return { useStudyStore };
});

import { AiCancellationDock, ChatPanel, SourcePanel } from "./StudyWorkspace";
import { SourceAiActivityProvider } from "@/contexts/SourceAiActivityContext";

const session: StudySession = {
  id: "session-mobile", name: "Plant biology", createdAt: 1, isPinned: false, materials: [{ id: "plant-source", title: "Plants.md", type: "file", content: "Photosynthesis turns light energy into chemical energy in plants.", format: "MD", createdAt: 1 }], chatHistory: [], vocabulary: [], notes: [], quizzes: [], studySeconds: 0,
};
const fastFallbackText = "AWS Lambda menjalankan kode saat dipicu event.";
const fastFallbackProvider = "StudyOS AI gateway · Fast fallback";

function SourcePanelWithProvider({ session }: { session: StudySession }) {
  return <SourceAiActivityProvider><SourcePanel session={session} /></SourceAiActivityProvider>;
}

class TestFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
  readAsDataURL() { this.result = "data:text/plain;base64,UGxhbnRzIHVzZSBsaWdodC4="; this.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>); }
}

function streamingResponse() {
  const encoder = new TextEncoder();
  let emitted = false;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (emitted) return { done: true, value: undefined };
          emitted = true;
          return { done: false, value: encoder.encode('event: meta\ndata: {"provider":"StudyOS AI gateway · GPT-5 mini"}\n\nevent: token\ndata: {"token":"Photosynthesis uses light."}\n\nevent: done\ndata: {"text":"Photosynthesis uses light.","citations":[],"truncated":false,"provider":"StudyOS AI gateway · GPT-5 mini"}\n\n') };
        },
      }),
    },
  };
}

function doneOnlyFastFallbackResponse() {
  const encoder = new TextEncoder();
  let emitted = false;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (emitted) return { done: true, value: undefined };
          emitted = true;
          return { done: false, value: encoder.encode(`event: meta\ndata: {"provider":"${fastFallbackProvider}"}\n\nevent: done\ndata: {"text":"${fastFallbackText}","citations":[],"truncated":false,"provider":"${fastFallbackProvider}"}\n\n`) };
        },
      }),
    },
  };
}

function geminiRateLimitedStreamingResponse() {
  const encoder = new TextEncoder();
  let emitted = false;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (emitted) return { done: true, value: undefined };
          emitted = true;
          return { done: false, value: encoder.encode('event: error\ndata: {"message":"Google Gemini sedang membatasi request untuk personal key ini (429). Tunggu sebentar sebelum mengirim pesan lagi."}\n\n') };
        },
      }),
    },
  };
}

function stagedModeStreamingResponse(mode: "Balanced" | "Deep") {
  const encoder = new TextEncoder();
  const firstToken = `Streaming ${mode}: bagian pertama. `;
  const finalText = `${firstToken}Bagian kedua sudah selesai.`;
  let phase = 0;
  let releaseSecondChunk = () => {};
  const secondChunk = new Promise<void>((resolve) => { releaseSecondChunk = resolve; });
  return {
    firstToken,
    finalText,
    releaseSecondChunk,
    response: {
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (phase === 0) {
              phase += 1;
              return { done: false, value: encoder.encode(`event: meta\ndata: {"provider":"StudyOS AI gateway · GPT-5 mini"}\n\nevent: token\ndata: {"token":"${firstToken}"}\n\n`) };
            }
            if (phase === 1) {
              await secondChunk;
              phase += 1;
              return { done: false, value: encoder.encode(`event: token\ndata: {"token":"Bagian kedua sudah selesai."}\n\nevent: done\ndata: {"text":"${finalText}","citations":[],"truncated":false,"provider":"StudyOS AI gateway · GPT-5 mini","mode":"${mode}"}\n\n`) };
            }
            return { done: true, value: undefined };
          },
        }),
      },
    },
  };
}

function interruptedStreamingResponse() {
  const encoder = new TextEncoder();
  const partialText = "Bagian awal respons tetap terlihat. ";
  let emitted = false;
  return {
    partialText,
    response: {
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (emitted) return { done: true, value: undefined };
            emitted = true;
            return { done: false, value: encoder.encode(`event: meta\ndata: {"provider":"Google Gemini 3.6 Flash · Personal key"}\n\nevent: token\ndata: {"token":"${partialText}"}\n\n`) };
          },
        }),
      },
    },
  };
}

function cancelableStreamingResponse() {
  const encoder = new TextEncoder();
  const partialText = "Bagian awal yang dapat dibatalkan. ";
  let phase = 0;
  let releaseLateChunk = () => {};
  const lateChunk = new Promise<void>((resolve) => { releaseLateChunk = resolve; });
  return {
    partialText,
    releaseLateChunk,
    response: {
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (phase === 0) {
              phase += 1;
              return { done: false, value: encoder.encode(`event: token\ndata: {"token":"${partialText}"}\n\n`) };
            }
            if (phase === 1) {
              await lateChunk;
              phase += 1;
              return { done: false, value: encoder.encode('event: done\ndata: {"text":"Respons terlambat tidak boleh tersimpan.","citations":[],"truncated":false}\n\n') };
            }
            return { done: true, value: undefined };
          },
        }),
      },
    },
  };
}

describe("mobile Source and AI flow", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    vi.stubGlobal("FileReader", TestFileReader);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse()));
    uploadDocumentMutate.mockReset(); chatMutate.mockReset(); chatCallbacks.onSuccess = undefined; chatCallbacks.onError = undefined; continueMutate.mockReset(); draftKeyTermMutate.mockReset(); draftVocabularyMutate.mockReset(); draftKeyTermShouldFail.value = false; translateChatMutateAsync.mockReset(); translateChatIsPending.value = false; profileState.value = { name: "Learner", aiName: "StudyOS" }; addMaterial.mockReset(); addMessage.mockReset(); addVocabulary.mockReset();
    localStorage.clear();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it.each([["desktop", 1280], ["mobile", 375]] as const)("uses a multiline composer that preserves long text and sends only on Enter on %s", async (_viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS") as HTMLTextAreaElement;
    const longQuestion = "Jelaskan hubungan antara Amazon S3, bucket, object storage, IAM policy, dan encryption untuk penyimpanan file aplikasi dengan contoh yang mudah dipahami.";

    expect(question.tagName).toBe("TEXTAREA");
    expect(question.closest(".study-chat-input-shell")).toBeTruthy();
    fireEvent.change(question, { target: { value: longQuestion } });
    expect(question.value).toBe(longQuestion);
    fireEvent.keyDown(question, { key: "Enter", shiftKey: true });
    expect(addMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(question, { key: "Enter" });
    await waitFor(() => expect(addMessage).toHaveBeenCalledWith("session-mobile", { role: "user", content: longQuestion }));
  });

  it("closes the session three-dot menu when clicking elsewhere or pressing Escape", async () => {
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    fireEvent.click(ui.getByRole("button", { name: "Session menu" }));
    expect(ui.getByRole("button", { name: "New session" })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(ui.queryByRole("button", { name: "New session" })).toBeNull());

    fireEvent.click(ui.getByRole("button", { name: "Session menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(ui.queryByRole("button", { name: "New session" })).toBeNull();
  });

  it("opens the Sessions page directly from the Chat session menu", () => {
    const onOpenSessions = vi.fn();
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} onOpenSessions={onOpenSessions} />);
    fireEvent.click(ui.getByRole("button", { name: "Session menu" }));
    fireEvent.click(ui.getByRole("button", { name: "Change session" }));
    expect(onOpenSessions).toHaveBeenCalledTimes(1);
    expect(ui.queryByRole("button", { name: "Change session" })).toBeNull();
  });

  it("shows cancel controls for AI activities and invokes only the selected cancellation handler", async () => {
    const cancelTranslation = vi.fn();
    const cancelAddTerms = vi.fn();
    const cancelQuiz = vi.fn();
    const ui = render(<AiCancellationDock />);

    act(() => {
      window.dispatchEvent(new CustomEvent("studyos:ai-activity", { detail: { id: "translate-chat", label: "Translate chat", pending: true, cancel: cancelTranslation } }));
      window.dispatchEvent(new CustomEvent("studyos:ai-activity", { detail: { id: "add-terms", label: "Add Terms", pending: true, cancel: cancelAddTerms } }));
      window.dispatchEvent(new CustomEvent("studyos:ai-activity", { detail: { id: "generate-quiz", label: "Generate quiz", pending: true, cancel: cancelQuiz } }));
    });

    fireEvent.click(ui.getByRole("button", { name: "Cancel Translate chat" }));
    expect(cancelTranslation).toHaveBeenCalledTimes(1);
    expect(cancelAddTerms).not.toHaveBeenCalled();
    expect(cancelQuiz).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole("button", { name: "Cancel Add Terms" }));
    expect(cancelAddTerms).toHaveBeenCalledTimes(1);
    expect(cancelQuiz).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole("button", { name: "Cancel Generate quiz" }));
    expect(cancelQuiz).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new CustomEvent("studyos:ai-activity", { detail: { id: "translate-chat", label: "Translate chat", pending: false } })));
    await waitFor(() => expect(ui.queryByRole("button", { name: "Cancel Translate chat" })).toBeNull());
    expect(ui.getByRole("button", { name: "Cancel Add Terms" })).toBeTruthy();
    expect(ui.getByRole("button", { name: "Cancel Generate quiz" })).toBeTruthy();
  });

  it("places active AI cancellation controls in the Chat composer beside Send", () => {
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    act(() => window.dispatchEvent(new CustomEvent("studyos:ai-activity", { detail: { id: "generate-quiz", label: "Generate Quiz", pending: true, cancel: vi.fn() } })));

    const cancel = ui.getByRole("button", { name: "Cancel Generate Quiz" });
    const send = ui.getByRole("button", { name: "Send message" });
    expect(cancel.closest(".study-chat-composer")).toBeTruthy();
    expect(send.closest(".study-chat-composer")).toBe(cancel.closest(".study-chat-composer"));
  });

  it.each([["desktop", 1280], ["mobile", 375]] as const)("keeps a cancelled Chat response out of history on %s", async (_viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const stream = cancelableStreamingResponse();
    vi.mocked(fetch).mockResolvedValueOnce(stream.response as unknown as Response);
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "Jelaskan bucket S3" } });
    fireEvent.keyDown(question, { key: "Enter" });

    await waitFor(() => expect(ui.getByText(stream.partialText.trim())).toBeTruthy());
    fireEvent.click(ui.getByRole("button", { name: "Cancel AI response" }));
    stream.releaseLateChunk();

    await waitFor(() => expect(ui.queryByRole("button", { name: "Cancel AI response" })).toBeNull());
    expect(addMessage.mock.calls.some(([, message]) => (message as { role?: string; content?: string }).role === "assistant" && (message as { content?: string }).content === "Respons terlambat tidak boleh tersimpan.")).toBe(false);
  });

  it("accepts a source file and sends a query-aware source context to AI on a narrow viewport", async () => {
    const sourceUi = render(<SourcePanelWithProvider session={session} />);
    const input = sourceUi.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["Plants use light."], "plants.txt", { type: "text/plain" })] } });
    await waitFor(() => expect(uploadDocumentMutate).toHaveBeenCalledWith({ name: "plants.txt", mimeType: "text/plain", dataUrl: "data:text/plain;base64,UGxhbnRzIHVzZSBsaWdodC4=" }));
    sourceUi.unmount();

    const chatUi = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = chatUi.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "How does photosynthesis use light?" } });
    fireEvent.keyDown(question, { key: "Enter" });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/study/chat-stream", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("[Source: Plants.md · part 1]"),
    })));
    expect(chatMutate).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      role: "assistant", content: "Photosynthesis uses light.",
    }));
    expect(addMessage).toHaveBeenCalledWith("session-mobile", { role: "user", content: "How does photosynthesis use light?" });
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string)).toEqual(expect.objectContaining({
      sessionName: "Plant biology",
      materials: expect.stringContaining("[Source: Plants.md · part 1]"),
      history: [{ role: "user", content: "How does photosynthesis use light?" }],
    }));
  });

  it("saves a non-empty Fast fallback answer when the stream has a done event but no token events", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(doneOnlyFastFallbackResponse() as unknown as Response);
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "What does AWS Lambda do?" } });
    fireEvent.keyDown(question, { key: "Enter" });

    await waitFor(() => expect(addMessage).toHaveBeenCalledWith("session-mobile", expect.objectContaining({
      role: "assistant",
      content: fastFallbackText,
      provider: fastFallbackProvider,
    })));
    expect(chatMutate).not.toHaveBeenCalled();
  });

  it.each([["desktop", 1280], ["mobile", 375]] as const)("uses an explicit English target, flips the next label, and keeps the UI language unchanged on %s", async (_viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    localStorage.setItem("studyos_ai_model", "claude-haiku-4-5");
    const translatedSession: StudySession = {
      ...session,
      chatHistory: [
        { id: "english-user", role: "user", content: "Can you explain cloud storage?", createdAt: 1 },
        { id: "indonesian-ai", role: "assistant", content: "Cloud storage menyimpan file lewat internet.", createdAt: 2 },
      ],
    };
    translateChatMutateAsync.mockResolvedValueOnce({ translations: {
      english: [
        { id: "english-user", content: "Can you explain cloud storage?" },
        { id: "indonesian-ai", content: "Cloud storage stores files over the internet." },
      ],
      indonesian: [
        { id: "english-user", content: "Bisa jelaskan penyimpanan cloud?" },
        { id: "indonesian-ai", content: "Cloud storage menyimpan file lewat internet." },
      ],
    } });
    const sourceUi = render(<SourcePanelWithProvider session={translatedSession} />);
    const ui = render(<ChatPanel session={translatedSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);

    expect(sourceUi.getByRole("button", { name: "Translate to English" })).toBeTruthy();
    expect(ui.getByLabelText("Translate chat to English")).toBeTruthy();
    fireEvent.click(ui.getByLabelText("Translate chat to English"));
    await waitFor(() => expect(translateChatMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ messages: [
      { id: "english-user", content: "Can you explain cloud storage?" },
      { id: "indonesian-ai", content: "Cloud storage menyimpan file lewat internet." },
    ], target: "english", model: "claude-haiku-4-5" })));
    await waitFor(() => expect(ui.getByText("Can you explain cloud storage?")).toBeTruthy());
    expect(ui.getByText("Cloud storage stores files over the internet.")).toBeTruthy();
    expect(ui.getByLabelText("Ask StudyOS")).toBeTruthy();
    expect(ui.getByLabelText("Translate chat to Indonesian")).toBeTruthy();
    await waitFor(() => expect(sourceUi.getByRole("button", { name: "Translate to Indonesian" })).toBeTruthy());
    sourceUi.unmount();
  });

  it("switches cached language directions instantly and translates a new message only after another user request", async () => {
    const cacheSession: StudySession = {
      ...session,
      chatHistory: [
        { id: "cached-user", role: "user", content: "Halo", createdAt: 1 },
        { id: "cached-ai", role: "assistant", content: "Selamat datang", createdAt: 2 },
      ],
    };
    translateChatMutateAsync
      .mockResolvedValueOnce({ translations: {
        english: [{ id: "cached-user", content: "Hello" }, { id: "cached-ai", content: "Welcome" }],
        indonesian: [{ id: "cached-user", content: "Halo" }, { id: "cached-ai", content: "Selamat datang" }],
      } })
      .mockResolvedValueOnce({ translations: {
        english: [{ id: "new-ai", content: "New study tip" }],
        indonesian: [{ id: "new-ai", content: "Tips belajar baru" }],
      } });
    const ui = render(<ChatPanel session={cacheSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);

    fireEvent.click(ui.getByLabelText("Translate chat to English"));
    await waitFor(() => expect(ui.getByText("Welcome")).toBeTruthy());
    expect(translateChatMutateAsync).toHaveBeenCalledTimes(1);

    fireEvent.click(ui.getByLabelText("Translate chat to Indonesian"));
    await waitFor(() => expect(ui.getByText("Selamat datang")).toBeTruthy());
    expect(translateChatMutateAsync).toHaveBeenCalledTimes(1);

    ui.rerender(<ChatPanel session={{ ...cacheSession, chatHistory: [...cacheSession.chatHistory, { id: "new-ai", role: "assistant", content: "New study tip", createdAt: 3 }] }} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    await waitFor(() => expect(ui.getByText("New study tip")).toBeTruthy());
    expect(translateChatMutateAsync).toHaveBeenCalledTimes(1);

    fireEvent.click(ui.getByLabelText("Translate chat to English"));
    await waitFor(() => expect(translateChatMutateAsync).toHaveBeenCalledTimes(2));
    expect((translateChatMutateAsync.mock.calls.at(-1)?.[0] as { messages: Array<{ id: string }> }).messages).toEqual([{ id: "new-ai", content: "New study tip" }]);

    fireEvent.click(ui.getByLabelText("Translate chat to Indonesian"));
    await waitFor(() => expect(ui.getByText("Tips belajar baru")).toBeTruthy());
    expect(translateChatMutateAsync).toHaveBeenCalledTimes(2);
  });

  it("starts a fresh Translate request after reload instead of reviving an empty cached view", () => {
    localStorage.setItem("studyos_translate_mode", "true");
    localStorage.setItem("studyos_chat_translation_target", "indonesian");
    const reloadSession: StudySession = {
      ...session,
      chatHistory: [{ id: "reload-message", role: "user", content: "Halo", createdAt: 1 }],
    };
    const sourceUi = render(<SourcePanelWithProvider session={reloadSession} />);
    const ui = render(<ChatPanel session={reloadSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);

    expect(ui.getByText("Halo")).toBeTruthy();
    expect(ui.getByLabelText("Translate chat to English")).toBeTruthy();
    expect(sourceUi.getByRole("button", { name: "Translate to English" })).toBeTruthy();
    expect(translateChatMutateAsync).not.toHaveBeenCalled();
    sourceUi.unmount();
  });

  it("targets Indonesian when the original chat is English, then offers English after the translated view is active", async () => {
    const englishSession: StudySession = {
      ...session,
      chatHistory: [{ id: "english-original", role: "user", content: "What is cloud computing?", createdAt: 1 }],
    };
    translateChatMutateAsync.mockResolvedValueOnce({
      translations: {
        english: [{ id: "english-original", content: "What is cloud computing?" }],
        indonesian: [{ id: "english-original", content: "Apa itu komputasi awan?" }],
      },
    });
    const ui = render(<ChatPanel session={englishSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);

    fireEvent.click(ui.getByLabelText("Translate chat to Indonesian"));
    await waitFor(() => expect(ui.getByText("Apa itu komputasi awan?")).toBeTruthy());
    expect(translateChatMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ target: "indonesian" }));
    expect(ui.getByLabelText("Translate chat to English")).toBeTruthy();
  });

  it.each([["desktop", 1280], ["mobile", 375]] as const)("shows a translation progress indicator while Chat translation is loading on %s", async (_viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    localStorage.setItem("studyos_translate_mode", "true");
    localStorage.setItem("studyos_chat_translation_target", "english");
    translateChatIsPending.value = true;
    translateChatMutateAsync.mockReturnValue(new Promise(() => undefined));
    const translatingSession: StudySession = { ...session, chatHistory: [{ id: "pending-message", role: "user", content: "Halo", createdAt: 1 }] };
    const sourceUi = render(<SourcePanelWithProvider session={translatingSession} />);
    const ui = render(<ChatPanel session={translatingSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);

    act(() => window.dispatchEvent(new CustomEvent("studyos:chat-translate", { detail: { active: true, target: "english", request: true } })));

    expect(ui.getByRole("status").textContent).toContain("Translating new chat messages to English");
    await waitFor(() => expect(sourceUi.getByRole("button", { name: "Translating to English…" })).toBeTruthy());
    expect((ui.getByLabelText("Translate chat to Indonesian") as HTMLButtonElement).disabled).toBe(true);
    sourceUi.unmount();
  });

  it.each([["desktop", 1280], ["mobile", 375]] as const)("stops translation cleanly after a provider failure and retries only on request on %s", async (_viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    localStorage.setItem("studyos_translate_mode", "true");
    localStorage.setItem("studyos_chat_translation_target", "english");
    translateChatMutateAsync
      .mockRejectedValueOnce(new Error("Penerjemahan Chat tidak tersedia karena kuota AI provider untuk proyek ini habis. Teks asli tetap aman. Coba lagi setelah kuota tersedia atau gunakan provider/key lain yang masih aktif."))
      .mockResolvedValueOnce({ translations: {
        english: [{ id: "retry-message", content: "Hello again" }],
        indonesian: [{ id: "retry-message", content: "Halo lagi" }],
      } });
    const retrySession: StudySession = { ...session, chatHistory: [{ id: "retry-message", role: "user", content: "Halo lagi", createdAt: 1 }] };
    const sourceUi = render(<SourcePanelWithProvider session={retrySession} />);
    const ui = render(<ChatPanel session={retrySession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);

    act(() => window.dispatchEvent(new CustomEvent("studyos:chat-translate", { detail: { active: true, target: "english", request: true } })));

    await waitFor(() => expect(ui.getByRole("alert").textContent).toContain("kuota AI provider untuk proyek ini habis"));
    expect(ui.queryByRole("status")).toBeNull();
    expect(ui.getByText("Halo lagi")).toBeTruthy();
    expect(translateChatMutateAsync).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(sourceUi.getByRole("button", { name: "Translate to English" })).toBeTruthy());

    fireEvent.click(ui.getByRole("button", { name: "Try translation again" }));
    await waitFor(() => expect(translateChatMutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(ui.queryByRole("alert")).toBeNull());
    expect(ui.getByText("Hello again")).toBeTruthy();
    sourceUi.unmount();
  });

  it.each([["desktop", 1280], ["mobile", 375]])("renders the persisted Fast fallback answer as a non-empty AI bubble on %s", async (_viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    vi.mocked(fetch).mockResolvedValueOnce(doneOnlyFastFallbackResponse() as unknown as Response);
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "What does AWS Lambda do?" } });
    fireEvent.keyDown(question, { key: "Enter" });

    await waitFor(() => expect(addMessage).toHaveBeenCalledWith("session-mobile", expect.objectContaining({ content: fastFallbackText })));
    ui.rerender(<ChatPanel session={{ ...session, chatHistory: [{ id: `fast-fallback-${width}`, role: "assistant", content: fastFallbackText, provider: fastFallbackProvider, createdAt: 2 }] }} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);

    expect(ui.getByText(fastFallbackText)).toBeTruthy();
    expect(ui.getByTestId("ai-provider-label").textContent).toContain(`Used: ${fastFallbackProvider}`);
  });

  it.each([
    ["Balanced", "desktop", 1280],
    ["Balanced", "mobile", 375],
    ["Deep", "desktop", 1280],
    ["Deep", "mobile", 375],
  ] as const)("streams and renders the completed %s answer on %s", async (mode, _viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    localStorage.setItem("studyos_ai_style", mode);
    const stream = stagedModeStreamingResponse(mode);
    vi.mocked(fetch).mockResolvedValueOnce(stream.response as unknown as Response);
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "Explain cloud storage" } });
    fireEvent.keyDown(question, { key: "Enter" });

    await waitFor(() => expect(ui.getByText(stream.firstToken.trim())).toBeTruthy());
    const sentPayload = JSON.parse((vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(sentPayload.responseStyle).toBe(mode);
    expect(addMessage.mock.calls.some(([, message]) => (message as { role?: string }).role === "assistant")).toBe(false);

    stream.releaseSecondChunk();
    await waitFor(() => expect(addMessage).toHaveBeenCalledWith("session-mobile", expect.objectContaining({ role: "assistant", content: stream.finalText })));
    ui.rerender(<ChatPanel session={{ ...session, chatHistory: [{ id: `streamed-${mode}-${width}`, role: "assistant", content: stream.finalText, provider: "StudyOS AI gateway · GPT-5 mini", createdAt: 2 }] }} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    expect(ui.getByText(stream.finalText)).toBeTruthy();
    expect(ui.getByTestId("ai-provider-label").textContent).toContain("Used: StudyOS AI gateway · GPT-5 mini");
  });

  it.each([["desktop", 1280], ["mobile", 375]] as const)("keeps streamed text visible instead of returning to dots while fallback prepares the final answer on %s", async (_viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const stream = interruptedStreamingResponse();
    const resumedStream = stagedModeStreamingResponse("Balanced");
    vi.mocked(fetch).mockResolvedValueOnce(stream.response as unknown as Response).mockResolvedValueOnce(resumedStream.response as unknown as Response);
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "Jelaskan penyimpanan cloud" } });
    fireEvent.keyDown(question, { key: "Enter" });

    await waitFor(() => expect(ui.getByText(/Bagian awal respons tetap terlihat/i)).toBeTruthy());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(ui.container.querySelector(".study-thinking")).toBeNull();
    expect(ui.getByText(/Bagian awal respons tetap terlihat/i)).toBeTruthy();
    await waitFor(() => expect(ui.getByText(/Streaming Balanced: bagian pertama/i)).toBeTruthy());

    expect(chatMutate).not.toHaveBeenCalled();
    resumedStream.releaseSecondChunk();
    await waitFor(() => expect(addMessage).toHaveBeenCalledWith("session-mobile", expect.objectContaining({ role: "assistant", content: `${stream.partialText.trim()}\n\n${resumedStream.finalText}` })));
  });

  it("explains an exhausted provider quota after the Chat stream falls back", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, body: null } as unknown as Response);
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "Jelaskan cloud storage" } });
    fireEvent.keyDown(question, { key: "Enter" });

    await waitFor(() => expect(chatMutate).toHaveBeenCalled());
    act(() => chatCallbacks.onError?.({ message: "Respons Chat belum tersedia karena kuota AI provider untuk proyek ini habis. Pesan kamu tetap aman. Coba lagi setelah kuota tersedia atau gunakan provider/key lain yang masih aktif." }));

    await waitFor(() => expect(ui.getByText(/kuota AI provider untuk proyek ini habis/i)).toBeTruthy());
    expect(addMessage).toHaveBeenCalledWith("session-mobile", { role: "user", content: "Jelaskan cloud storage" });
  });

  it("does not send a duplicate fallback request when Gemini returns a rate limit", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(geminiRateLimitedStreamingResponse() as unknown as Response);
    const ui = render(<ChatPanel session={session} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "Halo" } });
    fireEvent.keyDown(question, { key: "Enter" });

    await waitFor(() => expect(ui.getByText(/Google Gemini sedang membatasi request/i)).toBeTruthy());
    expect(chatMutate).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith("session-mobile", { role: "user", content: "Halo" });
  });

  it("keeps streaming payload compatible with fallback by clamping materials and dropping blank history", async () => {
    const largeSession: StudySession = {
      ...session,
      materials: [{ ...session.materials[0], content: "AWS Lambda runs event-driven code.\n\n".repeat(500) }],
      chatHistory: [
        { id: "prior-user", role: "user", content: "Explain serverless", createdAt: 1 },
        { id: "empty-stream", role: "assistant", content: "", createdAt: 2 },
      ],
    };
    const ui = render(<ChatPanel session={largeSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "What is AWS Lambda?" } });
    fireEvent.keyDown(question, { key: "Enter" });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const payload = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string) as { materials: string; history: Array<{ role: string; content: string }> };
    expect(payload.materials.length).toBeLessThanOrEqual(10_000);
    expect(payload.history).toEqual([
      { role: "user", content: "Explain serverless" },
      { role: "user", content: "What is AWS Lambda?" },
    ]);
  });

  it("scrolls to the newest message after sending without pulling a reader away from earlier history", () => {
    const historySession: StudySession = {
      ...session,
      chatHistory: [{ id: "earlier", role: "assistant", content: "Earlier answer", createdAt: 1 }],
    };
    const ui = render(<ChatPanel session={historySession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    const viewport = ui.container.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement;
    const scrollTo = vi.fn();
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, value: 960 },
      clientHeight: { configurable: true, value: 240 },
      scrollTop: { configurable: true, writable: true, value: 720 },
      scrollTo: { configurable: true, value: scrollTo },
    });

    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "Show the latest answer" } });
    fireEvent.keyDown(question, { key: "Enter" });
    expect(scrollTo).toHaveBeenCalledWith({ top: 960, behavior: "smooth" });

    scrollTo.mockClear();
    viewport.scrollTop = 40;
    fireEvent.scroll(viewport);
    ui.rerender(<ChatPanel session={{ ...historySession, chatHistory: [...historySession.chatHistory, { id: "newer", role: "assistant", content: "New answer", createdAt: 2 }] }} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("renders citation chips and continues a response that reached the output limit", () => {
    const focusSource = vi.fn();
    window.addEventListener("studyos:focus-source", focusSource);
    const truncatedSession: StudySession = {
      ...session,
      chatHistory: [
        { id: "question", role: "user", content: "Jelaskan fotosintesis", createdAt: 1 },
        { id: "answer", role: "assistant", content: "Fotosintesis memakai cahaya.", citations: [{ title: "Plants.md", ordinal: 1, materialId: "plant-source" }], truncated: true, createdAt: 2 },
      ],
    };
    try {
      const ui = render(<ChatPanel session={truncatedSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
      const citation = ui.getByRole("button", { name: /Plants\.md.*part 1/i });
      fireEvent.click(citation);
      expect(focusSource).toHaveBeenCalledWith(expect.objectContaining({ detail: { sessionId: "session-mobile", materialId: "plant-source", ordinal: 1 } }));

      fireEvent.click(ui.getByRole("button", { name: /Continue answer/i }));
      expect(continueMutate).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalled();
      const continuationPayload = JSON.parse((vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit).body as string);
      expect(continuationPayload).toMatchObject({ continueAnswer: true, history: [{ role: "user", content: "Jelaskan fotosintesis" }, { role: "assistant", content: "Fotosintesis memakai cahaya." }] });
    } finally {
      window.removeEventListener("studyos:focus-source", focusSource);
    }
  });

  it("renders AI Markdown headings and tables as structured content instead of raw symbols", () => {
    const markdownSession: StudySession = {
      ...session,
      chatHistory: [{ id: "markdown-answer", role: "assistant", content: "## AWS services\n\n| Service | Use |\n| --- | --- |\n| EC2 | Virtual server |\n| Lambda | Event-driven code |", createdAt: 1 }],
    };

    const ui = render(<ChatPanel session={markdownSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    expect(ui.container.querySelector(".study-chat-markdown h2")?.textContent).toBe("AWS services");
    expect(ui.container.querySelectorAll(".study-chat-markdown table th")).toHaveLength(2);
    expect(ui.container.querySelectorAll(".study-chat-markdown table td")).toHaveLength(4);
    expect(ui.container.querySelectorAll(".study-chat-markdown button")).toHaveLength(0);
    expect(ui.getByText("Event-driven code")).toBeTruthy();
  });

  it("uses the profile AI companion name for bubble labels and new stream requests", async () => {
    profileState.value = { name: "Alya", aiName: "Aira" };
    const namedSession: StudySession = {
      ...session,
      chatHistory: [{ id: "named-answer", role: "assistant", content: "Halo, aku siap bantu belajar.", createdAt: 1 }],
    };
    const ui = render(<ChatPanel session={namedSession} onNewSession={vi.fn()} onOpenDashboard={vi.fn()} />);
    expect(ui.getByText("Aira")).toBeTruthy();

    const question = ui.getByLabelText("Ask StudyOS");
    fireEvent.change(question, { target: { value: "Jelaskan AWS" } });
    fireEvent.keyDown(question, { key: "Enter" });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const payload = JSON.parse((vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(payload.aiName).toBe("Aira");
  });

  it("creates an AI draft from a selection, allows manual edits, and saves the complete Key Term", () => {
    const ui = render(<SourcePanelWithProvider session={session} />);
    fireEvent.click(ui.getByRole("button", { name: "Read" }));
    const reading = ui.getByText("Photosynthesis turns light energy into chemical energy in plants.");
    const range = document.createRange();
    range.selectNodeContents(reading);
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
    fireEvent.mouseUp(reading.closest("article")!);

    fireEvent.click(ui.getByRole("button", { name: "Save terms" }));
    expect(draftKeyTermMutate).toHaveBeenCalledWith(expect.objectContaining({ selection: expect.stringContaining("Photosynthesis turns light energy into chemical energy in plants.") }));
    fireEvent.change(ui.getByLabelText("Key Term"), { target: { value: "Amazon S3" } });
    fireEvent.click(ui.getByRole("button", { name: "Save Key Term" }));
    expect(addVocabulary).toHaveBeenCalledWith("session-mobile", "Amazon S3", "Object storage from AWS.", expect.objectContaining({
      context: "It stores objects in buckets.", example: "Store a PDF in an S3 bucket.", sourceExcerpt: expect.stringContaining("Photosynthesis turns light energy into chemical energy in plants."),
    }));
  });

  it("shows a drafting error and does not save a Key Term when AI drafting fails", () => {
    draftKeyTermShouldFail.value = true;
    const ui = render(<SourcePanelWithProvider session={session} />);
    fireEvent.click(ui.getByRole("button", { name: "Read" }));
    const reading = ui.getByText("Photosynthesis turns light energy into chemical energy in plants.");
    const range = document.createRange(); range.selectNodeContents(reading);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    fireEvent.mouseUp(reading.closest("article")!);

    fireEvent.click(ui.getByRole("button", { name: "Save terms" }));
    expect(ui.getByText("StudyOS AI could not prepare that Key Term.")).toBeTruthy();
    expect(addVocabulary).not.toHaveBeenCalled();
    expect(ui.queryByRole("button", { name: "Save Key Term" })).toBeNull();
  });

  it("saves a selected vocabulary word with its meaning only and skips the detailed editor", () => {
    const ui = render(<SourcePanelWithProvider session={session} />);
    fireEvent.click(ui.getByRole("button", { name: "Read" }));
    const reading = ui.getByText("Photosynthesis turns light energy into chemical energy in plants.");
    const range = document.createRange(); range.selectNodeContents(reading);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    fireEvent.mouseUp(reading.closest("article")!);

    fireEvent.click(ui.getByRole("button", { name: "Save vocab" }));
    expect(draftVocabularyMutate).toHaveBeenCalledWith(expect.objectContaining({ selection: expect.stringContaining("Photosynthesis") }));
    expect(addVocabulary).toHaveBeenCalledWith("session-mobile", "photosynthesis", "fotosintesis", expect.objectContaining({ sourceExcerpt: expect.stringContaining("Photosynthesis") }));
    expect(ui.queryByRole("button", { name: "Save Key Term" })).toBeNull();
  });
});
