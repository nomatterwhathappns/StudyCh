import { describe, expect, it, vi } from "vitest";

const { invokeLLM, invokeGoogleGemini } = vi.hoisted(() => ({ invokeLLM: vi.fn(), invokeGoogleGemini: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM }));
vi.mock("./googleGemini", async (importOriginal) => ({ ...(await importOriginal<typeof import("./googleGemini")>()), invokeGoogleGemini }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("Google Gemini fallback", () => {
  it("uses the built-in model when a Gemini request fails", async () => {
    invokeGoogleGemini.mockRejectedValueOnce(new Error("Gemini timed out"));
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "Amazon S3 adalah layanan penyimpanan objek AWS. [Source: Cloud.md · part 1]" }, finish_reason: "stop" }] });

    await expect(appRouter.createCaller(context()).study.chat({
      sessionName: "Cloud", materials: "[Source: Cloud.md · part 1]\nAmazon S3 stores objects.", translate: true, responseStyle: "Balanced", model: "gemini-3-flash-preview",
      history: [{ role: "user", content: "Apa itu Amazon S3?" }],
    })).resolves.toEqual({
      text: "Amazon S3 adalah layanan penyimpanan objek AWS.",
      citations: [{ title: "Cloud.md", ordinal: 1 }],
      truncated: false,
      provider: "StudyOS AI gateway · GPT-5 mini fallback",
    });

    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini", maxTokens: 2400, maxRetries: 1 }));
  });

  it("translates chat through the built-in fallback when a Gemini translation fails", async () => {
    invokeGoogleGemini.mockRejectedValueOnce(new Error("Gemini quota unavailable"));
    invokeLLM.mockResolvedValueOnce({
      choices: [{
        message: { content: JSON.stringify({ translations: [
          { id: "user-1", content: "Hello" },
          { id: "assistant-1", content: "Amazon S3 is AWS object storage." },
        ] }), },
        finish_reason: "stop",
      }],
    });

    await expect(appRouter.createCaller(context()).study.translateChat({
      model: "gemini-3-flash-preview",
      target: "english",
      messages: [
        { id: "user-1", content: "Halo" },
        { id: "assistant-1", content: "Amazon S3 adalah penyimpanan objek AWS." },
      ],
    })).resolves.toEqual({
      translations: [
        { id: "user-1", content: "Hello" },
        { id: "assistant-1", content: "Amazon S3 is AWS object storage." },
      ],
    });

    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini", maxTokens: 3600, maxRetries: 1 }));
  });
});
