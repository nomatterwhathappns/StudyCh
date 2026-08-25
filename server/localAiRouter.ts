import { TRPCError } from "@trpc/server";

export const LOCAL_AI_ROUTER_MODEL = "local-9router" as const;
export const LOCAL_QUIZ_TIMEOUT_MS = 60_000;

export type LocalAiRouterMessage = { role: "system" | "user" | "assistant"; content: string };

export type LocalAiRouterConfig = {
  enabled: boolean;
  configured: boolean;
  baseUrl: string;
  apiKey?: string;
  model?: string;
};

function isLoopbackHost(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
}

export function getLocalAiRouterConfig(): LocalAiRouterConfig {
  const enabled = process.env.STUDYOS_LOCAL_MODE === "true";
  const baseUrl = (process.env.STUDYOS_LOCAL_AI_ROUTER_URL || "http://127.0.0.1:20128/v1").trim().replace(/\/$/, "");
  const apiKey = process.env.STUDYOS_LOCAL_AI_ROUTER_API_KEY?.trim();
  const model = process.env.STUDYOS_LOCAL_AI_ROUTER_MODEL?.trim();
  return { enabled, configured: Boolean(enabled && apiKey && model), baseUrl, apiKey, model };
}

function requiredLocalAiRouterConfig() {
  const config = getLocalAiRouterConfig();
  if (!config.enabled) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Mode 9router lokal belum diaktifkan." });
  }
  let parsed: URL;
  try {
    parsed = new URL(config.baseUrl);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Alamat 9router lokal tidak valid. Periksa STUDYOS_LOCAL_AI_ROUTER_URL." });
  }
  if (parsed.protocol !== "http:" || !isLoopbackHost(parsed.hostname)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Untuk keamanan, 9router lokal harus memakai alamat loopback HTTP seperti http://127.0.0.1:20128/v1." });
  }
  if (!config.apiKey || !config.model) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "9router lokal belum siap. Isi API key proxy dan model pada file .env, lalu restart StudyOS." });
  }
  return { ...config, baseUrl: parsed.toString().replace(/\/$/, ""), apiKey: config.apiKey, model: config.model };
}

export function localAiRouterLabel() {
  const config = getLocalAiRouterConfig();
  return `9router lokal · ${config.model || "model belum dipilih"}`;
}

type LocalAiRouterRequest = {
  messages: LocalAiRouterMessage[];
  maxTokens: number;
  json?: boolean;
  stream?: boolean;
  timeoutMs?: number;
};

export async function requestLocalAiRouter({ messages, maxTokens, json = false, stream = false, timeoutMs = 45_000 }: LocalAiRouterRequest) {
  const config = requiredLocalAiRouterConfig();
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: maxTokens,
        stream,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if ((error as { name?: unknown } | undefined)?.name === "TimeoutError") {
      console.warn("[StudyOS local 9router] request timed out", { timeoutMs });
      throw new TRPCError({ code: "TIMEOUT", message: `9router lokal belum menyelesaikan respons dalam ${Math.ceil(timeoutMs / 1_000)} detik. Coba lagi atau pilih preset Quick.` });
    }
    throw error;
  }
  if (response.ok) return response;

  const detail = (await response.text()).slice(0, 300);
  if (response.status === 401 || response.status === 403) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "9router lokal menolak API key proxy. Salin ulang key dari dashboard 9router ke file .env, lalu restart StudyOS." });
  }
  if (response.status === 429) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "9router atau provider yang dipilih sedang membatasi request (429). Tunggu sebentar sebelum mencoba lagi." });
  }
  if (response.status >= 500) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "9router lokal atau provider di belakangnya sedang tidak tersedia. Pastikan 9router masih berjalan." });
  }
  console.error("[StudyOS local 9router] request failed", { status: response.status, detail });
  throw new TRPCError({ code: "BAD_GATEWAY", message: "9router lokal tidak dapat memproses request ini. Periksa model dan konfigurasi provider di dashboard 9router." });
}

export async function invokeLocalAiRouter(request: LocalAiRouterRequest) {
  const response = await requestLocalAiRouter({ ...request, stream: false });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string }; finish_reason?: string | null }> };
  const choice = payload.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "9router lokal mengembalikan respons kosong. Periksa model yang dipilih di dashboard 9router." });
  }
  const finishReason = choice?.finish_reason?.toLowerCase();
  return { text, truncated: finishReason === "length" || finishReason === "max_tokens" };
}
