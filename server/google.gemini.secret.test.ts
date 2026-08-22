import { describe, expect, it, vi } from "vitest";
import { invokeGoogleGemini, toGoogleResponseSchema } from "./googleGemini";

describe("Google Gemini API key", () => {
  it("can access the Gemini model catalog", async () => {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    expect(key, "GOOGLE_GENERATIVE_AI_API_KEY must be configured").toBeTruthy();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key!)}`, {
      signal: AbortSignal.timeout(10_000),
    });

    expect(response.ok, `Google Gemini model catalog request failed with ${response.status}`).toBe(true);
    const payload = await response.json() as { models?: unknown[] };
    expect(payload.models).toBeInstanceOf(Array);
  });

  it("formats a server-side Gemini response without exposing the key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ready" }] } }] }),
    } as Response);
    try {
      await expect(invokeGoogleGemini({ messages: [{ role: "user", content: "Reply with exactly: ready" }], maxTokens: 64 })).resolves.toEqual({ text: "ready", truncated: false });
      expect(fetchSpy).toHaveBeenCalledOnce();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("passes an optional JSON schema to Gemini for structured drafts", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }),
    } as Response);
    try {
      await invokeGoogleGemini({ messages: [{ role: "user", content: "Draft a card" }], maxTokens: 64, json: true, jsonSchema: { type: "object", properties: { term: { type: "string" } }, additionalProperties: false } });
      const request = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
      expect(request.generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: { type: "object" } });
      expect(request.generationConfig.responseSchema).not.toHaveProperty("additionalProperties");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("removes unsupported additionalProperties from nested Google response schemas", () => {
    expect(toGoogleResponseSchema({
      type: "object",
      additionalProperties: false,
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { question: { type: "string" } },
          },
        },
      },
    })).toEqual({
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: { type: "object", properties: { question: { type: "string" } } },
        },
      },
    });
  });

  it("reports a clear configuration error when the key is unavailable", async () => {
    const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    try {
      await expect(invokeGoogleGemini({ messages: [{ role: "user", content: "Hello" }], maxTokens: 16 })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
    }
  });
});
