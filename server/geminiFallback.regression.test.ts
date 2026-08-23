import { describe, expect, it, vi } from "vitest";

const { invokeLLM, invokeGoogleGemini } = vi.hoisted(() => ({ invokeLLM: vi.fn(), invokeGoogleGemini: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM }));
vi.mock("./googleGemini", async (importOriginal) => ({ ...(await importOriginal<typeof import("./googleGemini")>()), invokeGoogleGemini }));

import { TRPCError } from "@trpc/server";
import { appRouter, invokeStudyAI } from "./routers";
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
        message: { content: JSON.stringify({
          translations: [
            { id: "user-1", content: "Hello" },
            { id: "assistant-1", content: "Amazon S3 is AWS object storage." },
          ],
        }), },
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
      translations: {
        english: [
          { id: "user-1", content: "Hello" },
          { id: "assistant-1", content: "Amazon S3 is AWS object storage." },
        ],
        indonesian: [
          { id: "user-1", content: "Halo" },
          { id: "assistant-1", content: "Amazon S3 adalah penyimpanan objek AWS." },
        ],
      },
    });

    expect(invokeGoogleGemini).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 450, timeoutMs: 45_000 }));
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini", maxTokens: 450, maxRetries: 1 }));
  });

  it("preserves a Gemini 429 instead of consuming an exhausted gateway fallback", async () => {
    const fallbackCallsBefore = invokeLLM.mock.calls.length;
    invokeGoogleGemini.mockRejectedValueOnce(new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Google Gemini sedang membatasi request untuk personal key ini (429). Tunggu sebentar sebelum mencoba lagi." }));

    await expect(appRouter.createCaller(context()).study.translateChat({
      model: "gemini-3-flash-preview",
      target: "english",
      messages: [{ id: "rate-user", content: "Halo" }],
    })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Google Gemini sedang membatasi request untuk personal key ini (429). Tunggu sebentar sebelum mencoba lagi.",
    });

    expect(invokeLLM.mock.calls).toHaveLength(fallbackCallsBefore);
  });

  it("does not automatically retry a truncated normal translation batch", async () => {
    const geminiCallsBefore = invokeGoogleGemini.mock.calls.length;
    const messages = [
      { id: "long-1", content: "A".repeat(550) },
      { id: "long-2", content: "B".repeat(550) },
      { id: "long-3", content: "C".repeat(550) },
    ];
    invokeGoogleGemini.mockResolvedValueOnce({ text: "{\"translations\":[", truncated: true });

    await expect(appRouter.createCaller(context()).study.translateChat({ model: "gemini-3-flash-preview", target: "english", messages })).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(invokeGoogleGemini.mock.calls).toHaveLength(geminiCallsBefore + 1);
  });

  it("returns an actionable translation error when Gemini and both gateway fallbacks have exhausted quota", async () => {
    invokeGoogleGemini.mockRejectedValueOnce(new Error("Gemini quota exhausted"));
    invokeLLM.mockRejectedValue(new Error('LLM invoke failed: 412 Precondition Failed – {"code":9,"message":"your account has hit a usage exhausted"}'));

    await expect(appRouter.createCaller(context()).study.translateChat({
      model: "gemini-3-flash-preview",
      target: "english",
      messages: [
        { id: "quota-user", content: "Halo" },
        { id: "quota-ai", content: "Selamat datang" },
      ],
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Penerjemahan Chat tidak tersedia karena kuota AI provider untuk proyek ini habis. Teks asli tetap aman. Coba lagi setelah kuota tersedia atau gunakan provider/key lain yang masih aktif.",
    });

    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini", maxTokens: 450 }));
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "claude-haiku-4-5", maxTokens: 450 }));
  });

  it("returns a Chat-specific quota message when Gemini and both gateway fallbacks are exhausted", async () => {
    invokeGoogleGemini.mockRejectedValueOnce(new Error("Gemini quota exhausted"));
    invokeLLM.mockRejectedValue(new Error('LLM invoke failed: 412 Precondition Failed – {"code":9,"message":"your account has hit a usage exhausted"}'));

    await expect(appRouter.createCaller(context()).study.chat({
      sessionName: "Cloud",
      materials: "",
      translate: false,
      responseStyle: "Balanced",
      model: "gemini-3-flash-preview",
      history: [{ role: "user", content: "Halo" }],
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Respons Chat belum tersedia karena kuota AI provider untuk proyek ini habis. Pesan kamu tetap aman. Coba lagi setelah kuota tersedia atau gunakan provider/key lain yang masih aktif.",
    });
  });

  it("does not send a failed personal Gemini request into the project gateway", async () => {
    const fallbackCallsBefore = invokeLLM.mock.calls.length;
    invokeGoogleGemini.mockRejectedValueOnce(new Error("Gemini connection interrupted"));

    await expect(invokeStudyAI(
      "gemini-3-flash-preview",
      [{ role: "user", content: "Hello" }],
      64,
      "Fast",
      false,
      { apiKey: "personal-key", source: "personal" },
    )).rejects.toThrow("Gemini connection interrupted");

    expect(invokeLLM.mock.calls).toHaveLength(fallbackCallsBefore);
  });
});
