import { TRPCError } from "@trpc/server";

type GeminiMessage = { role: "system" | "user" | "assistant"; content: string };

type GeminiRequest = {
  messages: GeminiMessage[];
  maxTokens: number;
  json?: boolean;
  jsonSchema?: Record<string, unknown>;
  apiKey?: string;
  timeoutMs?: number;
};

export type GoogleGeminiResult = { text: string; truncated: boolean };

const GOOGLE_GEMINI_MODEL = "gemini-3.6-flash";

/**
 * The Gemini REST API accepts a JSON Schema subset for responseSchema. In
 * particular, it rejects OpenAI-style `additionalProperties`, even when its
 * value is `false`. Strip unsupported object controls recursively while
 * keeping the shape, required fields, and array item schemas intact.
 */
export function toGoogleResponseSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const { additionalProperties: _additionalProperties, $schema: _$schema, ...supported } = schema;
  const properties = supported.properties;
  const items = supported.items;
  return {
    ...supported,
    ...(properties && typeof properties === "object" && !Array.isArray(properties)
      ? { properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, value && typeof value === "object" && !Array.isArray(value) ? toGoogleResponseSchema(value as Record<string, unknown>) : value])) }
      : {}),
    ...(items && typeof items === "object" && !Array.isArray(items) ? { items: toGoogleResponseSchema(items as Record<string, unknown>) } : {}),
  };
}

export function getGoogleGeminiStatus() {
  return { configured: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY), model: GOOGLE_GEMINI_MODEL };
}

export async function invokeGoogleGemini({ messages, maxTokens, json = false, jsonSchema, apiKey: personalApiKey, timeoutMs = 14_000 }: GeminiRequest) {
  const apiKey = personalApiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Gemini is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to the server environment." });
  }

  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const contents = messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: { maxOutputTokens: maxTokens, ...(json ? { responseMimeType: "application/json", ...(jsonSchema ? { responseSchema: toGoogleResponseSchema(jsonSchema) } : {}) } : {}) },
    }),
  });

  if (!response.ok) {
    console.error("[Google Gemini] request failed", response.status, await response.text());
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Google Gemini could not complete the request. Check the API key, model access, and billing status." });
  }

  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> };
  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new TRPCError({ code: "BAD_GATEWAY", message: "Google Gemini returned an empty response. Please try again." });
  const finishReason = candidate?.finishReason?.toLowerCase();
  return { text, truncated: finishReason === "max_tokens" || finishReason === "length" };
}
