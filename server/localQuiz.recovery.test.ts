import { afterEach, describe, expect, it, vi } from "vitest";

const { invokeLocalAiRouter } = vi.hoisted(() => ({ invokeLocalAiRouter: vi.fn() }));

vi.mock("./localAiRouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./localAiRouter")>();
  return { ...actual, invokeLocalAiRouter };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const originalEnvironment = { ...process.env };
const validQuiz = {
  questions: Array.from({ length: 5 }, (_, index) => ({
    question: `Question ${index + 1}?`,
    options: ["One", "Two", "Three", "Four"],
    correct: index % 4,
    explanation: "A short explanation.",
  })),
};

function context(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

afterEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnvironment };
});

describe("local 9router Quiz recovery", () => {
  it("repairs one malformed local Quiz response without using a cloud provider", async () => {
    process.env.STUDYOS_LOCAL_MODE = "true";
    process.env.STUDYOS_LOCAL_AI_ROUTER_URL = "http://127.0.0.1:20127/v1";
    process.env.STUDYOS_LOCAL_AI_ROUTER_API_KEY = "local-router-key";
    process.env.STUDYOS_LOCAL_AI_ROUTER_MODEL = "oc/mimo-v2.5-free";
    invokeLocalAiRouter
      .mockResolvedValueOnce({ text: "Here are five questions about cloud storage:", truncated: false })
      .mockResolvedValueOnce({ text: JSON.stringify(validQuiz), truncated: false });

    const result = await appRouter.createCaller(context()).study.quiz({
      sessionName: "Cloud basics",
      materials: "[Source: Cloud.md · part 1]\nCloud storage keeps files on remote servers.",
      translate: false,
      responseStyle: "Balanced",
      model: "local-9router",
    });

    expect(result.questions).toHaveLength(5);
    expect(invokeLocalAiRouter).toHaveBeenCalledTimes(2);
    const repairRequest = invokeLocalAiRouter.mock.calls[1]?.[0] as { messages: Array<{ content: string }> };
    expect(repairRequest.messages[0]?.content).toContain("Reformat the supplied Quiz candidate");
    expect(repairRequest.messages[1]?.content).toContain("Here are five questions");
  });
});
