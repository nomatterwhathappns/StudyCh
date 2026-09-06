import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeLocalAiRouter, requestLocalAiRouter } from "./localAiRouter";

const originalEnvironment = { ...process.env };

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnvironment };
});

describe("local 9router adapter", () => {
  it("sends a server-side OpenAI-compatible request to the configured loopback router", async () => {
    process.env.STUDYOS_LOCAL_MODE = "true";
    process.env.STUDYOS_LOCAL_AI_ROUTER_URL = "http://127.0.0.1:20128/v1";
    process.env.STUDYOS_LOCAL_AI_ROUTER_API_KEY = "local-router-key";
    process.env.STUDYOS_LOCAL_AI_ROUTER_MODEL = "router-model";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Halo dari router" }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeLocalAiRouter({ messages: [{ role: "user", content: "Halo" }], maxTokens: 120 })).resolves.toEqual({ text: "Halo dari router", truncated: false });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:20128/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer local-router-key" }),
      body: expect.stringContaining('"model":"router-model"'),
    }));
  });

  it("rejects a non-loopback proxy address before any request can leave the laptop", async () => {
    process.env.STUDYOS_LOCAL_MODE = "true";
    process.env.STUDYOS_LOCAL_AI_ROUTER_URL = "https://example.com/v1";
    process.env.STUDYOS_LOCAL_AI_ROUTER_API_KEY = "local-router-key";
    process.env.STUDYOS_LOCAL_AI_ROUTER_MODEL = "router-model";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestLocalAiRouter({ messages: [{ role: "user", content: "Halo" }], maxTokens: 120 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns a local provider timeout into an actionable safe error", async () => {
    process.env.STUDYOS_LOCAL_MODE = "true";
    process.env.STUDYOS_LOCAL_AI_ROUTER_URL = "http://127.0.0.1:20127/v1";
    process.env.STUDYOS_LOCAL_AI_ROUTER_API_KEY = "local-router-key";
    process.env.STUDYOS_LOCAL_AI_ROUTER_MODEL = "oc/mimo-v2.5-free";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError")));

    await expect(requestLocalAiRouter({ messages: [{ role: "user", content: "Buat quiz" }], maxTokens: 900, timeoutMs: 60_000 }))
      .rejects.toMatchObject({ code: "TIMEOUT", message: expect.stringContaining("60 detik") });
  });
});

describe("public 9router adapter", () => {
  it("sends the public token header to an HTTPS gateway", async () => {
    process.env.STUDYOS_AI_ROUTER_ENABLED = "true";
    process.env.STUDYOS_AI_ROUTER_URL = "https://ai.example.test/v1";
    process.env.STUDYOS_AI_ROUTER_TOKEN = "public-gateway-token";
    process.env.STUDYOS_AI_ROUTER_MODEL = "Studyos";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "OK" }, finish_reason: "stop" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeLocalAiRouter({ messages: [{ role: "user", content: "OK" }], maxTokens: 512 })).resolves.toEqual({ text: "OK", truncated: false });
    expect(fetchMock).toHaveBeenCalledWith("https://ai.example.test/v1/chat/completions", expect.objectContaining({
      headers: { "content-type": "application/json", "x-studyos-token": "public-gateway-token" },
      body: expect.stringContaining('"model":"Studyos"'),
    }));
  });

  it("rejects a public gateway that is not HTTPS", async () => {
    process.env.STUDYOS_AI_ROUTER_ENABLED = "true";
    process.env.STUDYOS_AI_ROUTER_URL = "http://ai.example.test/v1";
    process.env.STUDYOS_AI_ROUTER_TOKEN = "public-gateway-token";
    process.env.STUDYOS_AI_ROUTER_MODEL = "Studyos";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestLocalAiRouter({ messages: [{ role: "user", content: "OK" }], maxTokens: 512 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
