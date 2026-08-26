import { trpc } from "@/lib/trpc";
import type { StudyCitation } from "@/lib/study-types";
import { useStudyStore } from "@/store/useStudyStore";
import React, { createContext, useContext, useMemo, useRef, useState } from "react";

type SourceTaskKind = "explain" | "key-term" | "vocabulary";
type SourceTaskStatus = "pending" | "review" | "error";
export type KeyTermDraft = { term: string; definition: string; context: string; example: string };

type SourceTask = {
  id: string;
  kind: SourceTaskKind;
  label: string;
  status: SourceTaskStatus;
  sessionId: string;
  selection: string;
  draft?: KeyTermDraft;
  error?: string;
};

type SourceRequest = {
  sessionId: string;
  sessionName: string;
  materials: string;
  responseStyle: "Fast" | "Balanced" | "Deep";
  model: "gpt-5-mini" | "claude-haiku-4-5" | "gemini-3-flash-preview" | "local-9router";
  selection: string;
};

type SourceAiActivityValue = {
  tasks: SourceTask[];
  startKeyTerm: (request: SourceRequest) => void;
  startVocabulary: (request: SourceRequest) => void;
  startExplain: (request: SourceRequest) => void;
  cancelTask: (taskId: string) => void;
  discardTask: (taskId: string) => void;
  saveKeyTerm: (taskId: string, draft: KeyTermDraft) => void;
  isPending: (sessionId: string, kind: SourceTaskKind) => boolean;
};

const SourceAiActivityContext = createContext<SourceAiActivityValue | null>(null);

function taskId(kind: SourceTaskKind) {
  return `source-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sourceCitations(sessionId: string, citations: Array<{ title: string; ordinal: number }>): StudyCitation[] {
  const session = useStudyStore.getState().sessions.find((entry) => entry.id === sessionId);
  return citations.map((citation) => ({ ...citation, materialId: session?.materials.find((material) => material.title === citation.title)?.id }));
}

export function SourceAiActivityProvider({ children }: { children: React.ReactNode }) {
  const addVocabulary = useStudyStore((state) => state.addVocabulary);
  const addMessage = useStudyStore((state) => state.addMessage);
  const [tasks, setTasks] = useState<SourceTask[]>([]);
  const runs = useRef<Record<string, number>>({});
  const explain = trpc.study.explain.useMutation();
  const draftKeyTerm = trpc.study.draftKeyTerm.useMutation();
  const draftVocabulary = trpc.study.draftVocabulary.useMutation();

  const begin = (kind: SourceTaskKind, request: SourceRequest) => {
    const id = taskId(kind);
    const label = kind === "key-term" ? "Save Terms" : kind === "vocabulary" ? "Save Vocab" : "Explain";
    const run = 1;
    runs.current[id] = run;
    setTasks((current) => [...current.filter((task) => !(task.sessionId === request.sessionId && task.kind === kind && task.status === "pending")), { id, kind, label, status: "pending", sessionId: request.sessionId, selection: request.selection }]);
    return { id, run, label };
  };

  const finish = (id: string, run: number, updater: (task: SourceTask) => SourceTask | null) => {
    if (runs.current[id] !== run) return;
    setTasks((current) => current.flatMap((task) => task.id === id ? (updater(task) ? [updater(task) as SourceTask] : []) : [task]));
  };

  const startKeyTerm = (request: SourceRequest) => {
    const { id, run } = begin("key-term", request);
    draftKeyTerm.mutate({ sessionName: request.sessionName, materials: request.materials, translate: false, responseStyle: request.responseStyle, model: request.model, selection: request.selection }, {
      onSuccess: (draft) => finish(id, run, (task) => ({ ...task, status: "review", draft })),
      onError: (reason) => finish(id, run, (task) => ({ ...task, status: "error", error: reason.message })),
    });
  };

  const startVocabulary = (request: SourceRequest) => {
    const { id, run } = begin("vocabulary", request);
    draftVocabulary.mutate({ sessionName: request.sessionName, materials: request.materials, translate: false, responseStyle: request.responseStyle, model: request.model, selection: request.selection }, {
      onSuccess: (draft) => { if (runs.current[id] !== run) return; addVocabulary(request.sessionId, draft.term, draft.meaning, { sourceExcerpt: request.selection }); finish(id, run, () => null); },
      onError: (reason) => finish(id, run, (task) => ({ ...task, status: "error", error: reason.message })),
    });
  };

  const startExplain = (request: SourceRequest) => {
    const { id, run } = begin("explain", request);
    addMessage(request.sessionId, { role: "user", content: `Explain: ${request.selection}` });
    explain.mutate({ sessionName: request.sessionName, materials: request.materials, translate: false, responseStyle: request.responseStyle, model: request.model, selection: request.selection }, {
      onSuccess: ({ text, citations, truncated, provider }) => { if (runs.current[id] !== run) return; addMessage(request.sessionId, { role: "assistant", content: text, citations: sourceCitations(request.sessionId, citations), truncated, ...(provider ? { provider } : {}) }); finish(id, run, () => null); },
      onError: (reason) => finish(id, run, (task) => ({ ...task, status: "error", error: reason.message })),
    });
  };

  const cancelTask = (id: string) => {
    const task = tasks.find((entry) => entry.id === id);
    if (!task) return;
    runs.current[id] = (runs.current[id] ?? 0) + 1;
    if (task.kind === "explain") explain.reset();
    if (task.kind === "key-term") draftKeyTerm.reset();
    if (task.kind === "vocabulary") draftVocabulary.reset();
    setTasks((current) => current.filter((entry) => entry.id !== id));
  };

  const discardTask = (id: string) => setTasks((current) => current.filter((task) => task.id !== id));
  const saveKeyTerm = (id: string, draft: KeyTermDraft) => {
    const task = tasks.find((entry) => entry.id === id && entry.kind === "key-term" && entry.status === "review");
    if (!task) return;
    addVocabulary(task.sessionId, draft.term, draft.definition, { context: draft.context, example: draft.example, sourceExcerpt: task.selection });
    discardTask(id);
  };

  const value = useMemo<SourceAiActivityValue>(() => ({
    tasks, startKeyTerm, startVocabulary, startExplain, cancelTask, discardTask, saveKeyTerm,
    isPending: (sessionId, kind) => tasks.some((task) => task.sessionId === sessionId && task.kind === kind && task.status === "pending"),
  }), [tasks]);

  return <SourceAiActivityContext.Provider value={value}>{children}</SourceAiActivityContext.Provider>;
}

export function useSourceAiActivity() {
  const value = useContext(SourceAiActivityContext);
  if (!value) throw new Error("useSourceAiActivity must be used inside SourceAiActivityProvider");
  return value;
}

export function useOptionalSourceAiActivity() {
  return useContext(SourceAiActivityContext);
}
