import type { Express, Request, Response } from "express";
import { z } from "zod";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { sdk } from "./_core/sdk";
import {
  builtInProviderLabel,
  formatStudyResponse,
  personalGeminiAccess,
  providerTimeoutMs,
  responseMode,
  responseTokenBudget,
  sourceContext,
  systemPrompt,
} from "./routers";

const streamInput = z.object({
  sessionName: z.string().min(1).max(120),
  materials: z.string().max(10_000),
  translate: z.boolean(),
  responseStyle: z.enum(["Fast", "Balanced", "Deep", "Concise", "Detailed"]),
  model: z.enum(["gpt-5-mini", "claude-haiku-4-5", "gemini-3-flash-preview"]),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(6_000) })).min(1).max(30),
});

type StreamInput = z.infer<typeof streamInput>;
type StreamMessage = { role: "system" | "user" | "assistant"; content: string };
type StreamedAIResult = { text: string; truncated: boolean };

export function normalizeStreamPayload(body: unknown) {
  const candidate = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const rawHistory = Array.isArray(candidate.history) ? candidate.history : [];
  const history = rawHistory
    .filter((item): item is { role: unknown; content: unknown } => Boolean(item && typeof item === "object"))
    .map((item) => ({ role: item.role, content: typeof item.content === "string" ? item.content.trim().slice(0, 6_000) : "" }))
    .filter((item) => item.content.length > 0)
    .slice(-30);
  return {
    ...candidate,
    materials: typeof candidate.materials === "string" ? candidate.materials.trim().slice(0, 10_000) : candidate.materials,
    history,
  };
}

export function streamErrorMessage(reason: unknown) {
  if (reason instanceof z.ZodError) return "Konteks chat terlalu besar atau belum lengkap. StudyOS sudah merapikan data chat—silakan kirim ulang pesanmu.";
  if (reason instanceof Error && /Gemini stream failed \(429\)/i.test(reason.message)) return "Google Gemini sedang membatasi request untuk personal key ini (429). Tunggu sebentar sebelum mengirim pesan lagi.";
  return "Respons AI belum bisa diproses. Coba kirim ulang atau periksa AI Settings.";
}

function event(res: Response, name: string, payload: unknown) {
  res.write(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`);
  const flush = (res as Response & { flush?: () => void }).flush;
  flush?.call(res);
}

function providerUrl() {
  return ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";
}

export function extractBuiltInStreamContent(payload: string) {
  const parsed = JSON.parse(payload) as {
    choices?: Array<{
      delta?: { content?: string };
      message?: { content?: string };
      text?: string;
    }>;
  };
  const choice = parsed.choices?.[0];
  const content = choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? "";
  return typeof content === "string" ? content : "";
}

export function extractBuiltInStreamFinishReason(payload: string) {
  const parsed = JSON.parse(payload) as { choices?: Array<{ finish_reason?: string | null; finishReason?: string | null }> };
  const finishReason = parsed.choices?.[0]?.finish_reason ?? parsed.choices?.[0]?.finishReason;
  return typeof finishReason === "string" ? finishReason : undefined;
}

export function isOutputTruncated(finishReason?: string | null) {
  return /^(?:length|max_tokens|max_tokens_exceeded)$/i.test(finishReason?.trim() ?? "");
}

export function builtInOutputTokenLimit(model: "gpt-5-mini" | "claude-haiku-4-5", maxTokens: number) {
  return model === "gpt-5-mini" ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };
}

export function chunkBufferedStreamText(text: string, maxChunkLength = 72) {
  const pieces = text.match(/\S+\s*|\s+/g) ?? [];
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length > maxChunkLength) {
      chunks.push(current);
      current = "";
    }
    current += piece;
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : text ? [text] : [];
}

export async function emitBufferedStreamTokens(text: string, onToken: (token: string) => void, delayMs = 12) {
  const chunks = chunkBufferedStreamText(text);
  for (let index = 0; index < chunks.length; index += 1) {
    onToken(chunks[index]);
    if (index < chunks.length - 1) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }
}

async function consumeSse(response: globalThis.Response, onPayload: (payload: string) => void) {
  if (!response.body) throw new Error("The AI provider returned an empty stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
      if (data) onPayload(data);
    }
  }

  const trailing = buffer.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
  if (trailing) onPayload(trailing);
}

async function streamBuiltIn(messages: StreamMessage[], model: "gpt-5-mini" | "claude-haiku-4-5", maxTokens: number, timeoutMs: number, onToken: (token: string) => void): Promise<StreamedAIResult> {
  const response = await fetch(providerUrl(), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ENV.forgeApiKey}` },
    body: JSON.stringify({ messages, model, ...builtInOutputTokenLimit(model, maxTokens), stream: true }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`StudyOS AI stream failed (${response.status}).`);

  const contentType = response.headers.get("content-type") ?? "";
  let text = "";
  let finishReason: string | undefined;
  if (contentType.includes("application/json")) {
    const json = await response.json() as { choices?: Array<{ message?: { content?: string }; finish_reason?: string | null; finishReason?: string | null }> };
    text = json.choices?.[0]?.message?.content ?? "";
    finishReason = json.choices?.[0]?.finish_reason ?? json.choices?.[0]?.finishReason ?? undefined;
    if (!text.trim()) throw new Error("StudyOS AI returned an empty response.");
    await emitBufferedStreamTokens(text, onToken);
    return { text, truncated: isOutputTruncated(finishReason) };
  }

  await consumeSse(response, (payload) => {
    if (payload === "[DONE]") return;
    try {
      const token = extractBuiltInStreamContent(payload);
      if (token) { text += token; onToken(token); }
      finishReason ??= extractBuiltInStreamFinishReason(payload);
    } catch {
      // Ignore provider keep-alives and malformed non-content frames.
    }
  });
  if (text.trim().length > 0) return { text, truncated: isOutputTruncated(finishReason) };

  const fallback = await invokeLLM({ messages, model, maxTokens, maxRetries: 0 });
  const fallbackContent = fallback.choices?.[0]?.message?.content;
  const finalText = typeof fallbackContent === "string" ? fallbackContent.trim() : "";
  if (!finalText) throw new Error("StudyOS AI returned an empty response.");
  await emitBufferedStreamTokens(finalText, onToken);
  return { text: finalText, truncated: isOutputTruncated(fallback.choices?.[0]?.finish_reason) };
}

async function streamGemini(messages: StreamMessage[], apiKey: string, maxTokens: number, timeoutMs: number, onToken: (token: string) => void): Promise<StreamedAIResult> {
  const system = messages.find(message => message.role === "system")?.content ?? "";
  const contents = messages.filter(message => message.role !== "system").map(message => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Gemini stream failed (${response.status}): ${(await response.text()).slice(0, 300)}`);

  let text = "";
  let finishReason: string | undefined;
  await consumeSse(response, (payload) => {
    try {
      const parsed = JSON.parse(payload) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> };
      const candidate = parsed.candidates?.[0];
      const token = candidate?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
      if (token) { text += token; onToken(token); }
      finishReason ??= candidate?.finishReason;
    } catch {
      // Ignore provider keep-alives and malformed non-content frames.
    }
  });
  if (!text.trim()) throw new Error("Google Gemini returned an empty stream.");
  return { text, truncated: isOutputTruncated(finishReason) };
}

export function registerStudyChatStream(app: Express) {
  app.post("/api/study/chat-stream", async (req: Request, res: Response) => {
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders();

    try {
      const input = streamInput.parse(normalizeStreamPayload(req.body));
      let userId: number | undefined;
      try {
        userId = (await sdk.authenticateRequest(req))?.id;
      } catch {
        userId = undefined;
      }
      const messages: StreamMessage[] = [
        { role: "system", content: systemPrompt(input.sessionName, input.materials, input.translate, input.responseStyle) },
        ...input.history,
      ];
      const maxTokens = responseTokenBudget("chat", input.responseStyle);
      const mode = responseMode(input.responseStyle);
      const timeoutMs = providerTimeoutMs(input.responseStyle);
      const writeToken = (token: string) => event(res, "token", { token });
      let result: StreamedAIResult = { text: "", truncated: false };
      let provider = "";

      if (input.model === "gemini-3-flash-preview") {
        try {
          const credential = await personalGeminiAccess(userId);
          if (!credential.apiKey) throw new Error("No Gemini key is configured.");
          provider = credential.source === "personal" ? "Google Gemini 3.6 Flash · Personal key" : "Google Gemini 3.6 Flash · Server key";
          event(res, "meta", { provider });
          result = await streamGemini(messages, credential.apiKey, maxTokens, timeoutMs, writeToken);
        } catch (error) {
          if (error instanceof Error && /Gemini stream failed \(429\)/i.test(error.message)) throw error;
          provider = "StudyOS AI gateway · Fast fallback";
          event(res, "meta", { provider, fallback: true });
          result = await streamBuiltIn(messages, "gpt-5-mini", maxTokens, timeoutMs, writeToken);
        }
      } else {
        provider = builtInProviderLabel(input.model);
        event(res, "meta", { provider });
        result = await streamBuiltIn(messages, input.model, maxTokens, timeoutMs, writeToken);
      }

      const parsed = formatStudyResponse(result.text);
      event(res, "done", { ...parsed, truncated: result.truncated, provider, mode });
    } catch (reason) {
      event(res, "error", { message: streamErrorMessage(reason) });
    } finally {
      res.end();
    }
  });
}
