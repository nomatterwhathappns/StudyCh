import { describe, expect, it } from "vitest";
import { z } from "zod";
import { builtInOutputTokenLimit, chunkBufferedStreamText, emitBufferedStreamTokens, extractBuiltInStreamContent, extractBuiltInStreamFinishReason, isOutputTruncated, normalizeStreamPayload, streamErrorMessage } from "./studyChatStream";

describe("study chat streaming payload", () => {
  it("clamps source context and removes blank streamed history before validation", () => {
    const payload = normalizeStreamPayload({
      sessionName: "AWS",
      materials: "x".repeat(18_000),
      history: [
        { role: "assistant", content: "  " },
        { role: "user", content: "  Explain Lambda  " },
        { role: "assistant", content: 44 },
      ],
    }) as { materials: string; history: Array<{ role: string; content: string }> };

    expect(payload.materials).toHaveLength(10_000);
    expect(payload.history).toEqual([{ role: "user", content: "Explain Lambda" }]);
  });

  it("turns validation details into a clear user-facing message", () => {
    const result = z.object({ content: z.string().min(1) }).safeParse({ content: "" });
    if (result.success) throw new Error("Expected a schema failure");
    expect(streamErrorMessage(result.error)).toMatch(/Konteks chat terlalu besar atau belum lengkap/i);
  });

  it("preserves an explicit Gemini rate-limit message for the Chat interface", () => {
    expect(streamErrorMessage(new Error("Gemini stream failed (429): quota exceeded"))).toMatch(/Google Gemini sedang membatasi request/i);
  });

  it("preserves an explicit Gemini service-unavailable message for the Chat interface", () => {
    expect(streamErrorMessage(new Error("Gemini stream failed (503): unavailable"))).toMatch(/Google Gemini sedang tidak tersedia/i);
  });

  it("extracts built-in fallback content from delta, message, and text payload variants", () => {
    expect(extractBuiltInStreamContent(JSON.stringify({ choices: [{ delta: { content: "Delta" } }] }))).toBe("Delta");
    expect(extractBuiltInStreamContent(JSON.stringify({ choices: [{ message: { content: "Complete response" } }] }))).toBe("Complete response");
    expect(extractBuiltInStreamContent(JSON.stringify({ choices: [{ text: "Legacy response" }] }))).toBe("Legacy response");
  });

  it("splits a completed provider response into multiple visible stream tokens", async () => {
    const text = "Balanced dan Deep tetap harus terasa mengalir walaupun provider mengembalikan satu respons JSON utuh.";
    const emitted: string[] = [];

    await emitBufferedStreamTokens(text, (token) => emitted.push(token), 0);

    expect(chunkBufferedStreamText(text)).toEqual(emitted);
    expect(emitted.length).toBeGreaterThan(1);
    expect(emitted.join("")).toBe(text);
  });

  it("preserves a provider output-limit signal for Continue answer", () => {
    const frame = JSON.stringify({ choices: [{ delta: { content: "Jawaban" }, finish_reason: "length" }] });
    expect(extractBuiltInStreamFinishReason(frame)).toBe("length");
    expect(isOutputTruncated(extractBuiltInStreamFinishReason(frame))).toBe(true);
    expect(isOutputTruncated("stop")).toBe(false);
  });

  it("keeps the full Balanced and Deep output budget when the Gemini path falls back to GPT", () => {
    expect(builtInOutputTokenLimit("gpt-5-mini", 2_400)).toEqual({ max_completion_tokens: 2_400 });
    expect(builtInOutputTokenLimit("gpt-5-mini", 4_200)).toEqual({ max_completion_tokens: 4_200 });
    expect(builtInOutputTokenLimit("claude-haiku-4-5", 2_400)).toEqual({ max_tokens: 2_400 });
  });
});
