import { describe, expect, it } from "vitest";

const tavilyApiKey = process.env.TAVILY_API_KEY;
const runLiveTavilyCheck = Boolean(tavilyApiKey && process.env.RUN_TAVILY_SECRET_TEST === "true");

describe("Tavily Search API key", () => {
  it.runIf(runLiveTavilyCheck)("can perform one basic search request", async () => {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: "StudyOS learning app",
        search_depth: "basic",
        max_results: 1,
        include_answer: false,
      }),
    });

    expect(response.ok).toBe(true);
  }, 15_000);
});
