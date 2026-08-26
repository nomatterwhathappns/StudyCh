import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const { invokeLocalAiRouter } = vi.hoisted(() => ({ invokeLocalAiRouter: vi.fn() }));

vi.mock("./localAiRouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./localAiRouter")>();
  return { ...actual, invokeLocalAiRouter };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const originalEnvironment = { ...process.env };
const context = (): TrpcContext => ({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });

afterEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnvironment };
});

describe("local 9router Save Vocab recovery", () => {
  it("retries one empty local response with a simpler translation prompt", async () => {
    process.env.STUDYOS_LOCAL_MODE = "true";
    process.env.STUDYOS_LOCAL_AI_ROUTER_URL = "http://127.0.0.1:20127/v1";
    process.env.STUDYOS_LOCAL_AI_ROUTER_API_KEY = "local-router-key";
    process.env.STUDYOS_LOCAL_AI_ROUTER_MODEL = "oc/mimo-v2.5-free";
    invokeLocalAiRouter
      .mockRejectedValueOnce(new TRPCError({ code: "BAD_GATEWAY", message: "9router lokal mengembalikan respons kosong. Periksa model yang dipilih di dashboard 9router." }))
      .mockResolvedValueOnce({ text: '{"term":"resilient","meaning":"tangguh"}', truncated: false });

    await expect(appRouter.createCaller(context()).study.draftVocabulary({
      sessionName: "English", materials: "", translate: false, responseStyle: "Balanced", model: "local-9router", selection: "resilient",
    })).resolves.toEqual({ term: "resilient", meaning: "tangguh" });

    expect(invokeLocalAiRouter).toHaveBeenCalledTimes(2);
    const retry = invokeLocalAiRouter.mock.calls[1]?.[0] as { messages: Array<{ content: string }>; maxTokens: number };
    expect(retry.maxTokens).toBe(500);
    expect(retry.messages[0]?.content).toContain("Translate the selected foreign word");
  });
});
