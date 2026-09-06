import { TRPCError } from "@trpc/server";

export const LOCAL_AI_ROUTER_MODEL = "local-9router" as const;
export const LOCAL_QUIZ_TIMEOUT_MS = 60_000;

export type LocalAiRouterMessage = { role: "system" | "user" | "assistant"; content: string };

type AiRouterMode = "disabled" | "local" | "public";

export type LocalAiRouterConfig = {
  enabled: boolean;
  localMode: boolean;
  publicMode: boolean;
  configured: boolean;
  baseUrl: string;
  apiKey?: string;
  token?: string;
  model?: string;
};

function isLoopbackHost(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
}

function routerMode(): AiRouterMode {
  if (process.env.STUDYOS_LOCAL_MODE === "true") return "local";
  if (process.env.STUDYOS_AI_ROUTER_ENABLED === "true") return "public";
  return "disabled";
}

export function getLocalAiRouterConfig(): LocalAiRouterConfig {
  const mode = routerMode();
  const localMode = mode === "local";
  const publicMode = mode === "public";
  const baseUrl = (localMode
    ? process.env.STUDYOS_LOCAL_AI_ROUTER_URL || "http://127.0.0.1:20128/v1"
    : process.env.STUDYOS_AI_ROUTER_URL || "https://127.0.0.1/v1"
  ).trim().replace(/\/$/, "");
  const apiKey = localMode ? process.env.STUDYOS_LOCAL_AI_ROUTER_API_KEY?.trim() : undefined;
  const token = publicMode ? process.env.STUDYOS_AI_ROUTER_TOKEN?.trim() : undefined;
  const model = (localMode ? process.env.STUDYOS_LOCAL_AI_ROUTER_MODEL : process.env.STUDYOS_AI_ROUTER_MODEL)?.trim();
  return {
    enabled: mode !== "disabled",
    localMode,
    publicMode,
    configured: Boolean(mode !== "disabled" && model && (localMode ? apiKey : token)),
    baseUrl,
    apiKey,
    token,
    model,
  };
}

function requiredAiRouterConfig() {
  const config = getLocalAiRouterConfig();
  if (!config.enabled) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gateway 9router belum diaktifkan." });
  }
  let parsed: URL;
  try {
    parsed = new URL(config.baseUrl);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Alamat 9router tidak valid. Periksa konfigurasi URL gateway." });
  }
  if (config.localMode) {
    if (parsed.protocol !== "http:" || !isLoopbackHost(parsed.hostname)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Untuk keamanan, 9router lokal harus memakai alamat loopback HTTP seperti http://127.0.0.1:20128/v1." });
    }
  } else if (parsed.protocol !== "https:" || isLoopbackHost(parsed.hostname)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gateway beta StudyOS harus memakai URL HTTPS publik yang valid." });
  }
  if (!config.model || (config.localMode ? !config.apiKey : !config.token)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gateway 9router belum siap. Periksa URL, token gateway, dan model di secret server." });
  }
  return { ...config, baseUrl: parsed.toString().replace(/\/$/, ""), model: config.model, apiKey: config.apiKey, token: config.token };
}

export function localAiRouterLabel() {
  const config = getLocalAiRouterConfig();
  const label = config.publicMode ? "9router beta online" : "9router lokal";
  return `${label} · ${config.model || "model belum dipilih"}`;
}

type LocalAiRouterRequest = {
  messages: LocalAiRouterMessage[];
  maxTokens: number;
  json?: boolean;
  stream?: boolean;
  timeoutMs?: number;
};

export async function requestLocalAiRouter({ messages, maxTokens, json = false, stream = false, timeoutMs = 45_000 }: LocalAiRouterRequest) {
  const config = requiredAiRouterConfig();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.localMode) headers.authorization = `Bearer ${config.apiKey}`;
  else headers["x-studyos-token"] = config.token!;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
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
      console.warn("[StudyOS 9router] request timed out", { timeoutMs, mode: config.publicMode ? "public" : "local" });
      throw new TRPCError({ code: "TIMEOUT", message: `9router belum menyelesaikan respons dalam ${Math.ceil(timeoutMs / 1_000)} detik. Coba lagi atau pilih preset Quick.` });
    }
    throw error;
  }
  if (response.ok) return response;

  const detail = (await response.text()).slice(0, 300);
  if (response.status === 401 || response.status === 403) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gateway 9router menolak token akses. Periksa secret gateway server-side." });
  }
  if (response.status === 429) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "9router atau provider yang dipilih sedang membatasi request (429). Tunggu sebentar sebelum mencoba lagi." });
  }
  if (response.status >= 500) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "9router atau provider di belakangnya sedang tidak tersedia. Pastikan gateway masih berjalan." });
  }
  console.error("[StudyOS 9router] request failed", { status: response.status, detail, mode: config.publicMode ? "public" : "local" });
  throw new TRPCError({ code: "BAD_GATEWAY", message: "9router tidak dapat memproses request ini. Periksa model dan konfigurasi provider di dashboard 9router." });
}

export async function invokeLocalAiRouter(request: LocalAiRouterRequest) {
  const response = await requestLocalAiRouter({ ...request, stream: false });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string }; finish_reason?: string | null }> };
  const choice = payload.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "9router mengembalikan respons kosong. Periksa model yang dipilih di dashboard 9router." });
  }
  const finishReason = choice?.finish_reason?.toLowerCase();
  return { text, truncated: finishReason === "length" || finishReason === "max_tokens" };
}
