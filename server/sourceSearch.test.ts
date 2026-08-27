import { describe, expect, it } from "vitest";
import { mapOpenAlexWorks, mapTavilyResults } from "./sourceSearch";

describe("Source Search result mapping", () => {
  it("keeps up to five safe Tavily Web results with readable previews", () => {
    const results = mapTavilyResults([
      { title: "AWS Lambda", url: "https://docs.aws.amazon.com/lambda/", content: "Run code without managing servers." },
      { title: "Private", url: "http://localhost:3000", content: "Do not return this." },
    ]);

    expect(results).toEqual([expect.objectContaining({ scope: "web", title: "AWS Lambda", url: "https://docs.aws.amazon.com/lambda/" })]);
  });

  it("maps OpenAlex paper metadata and reconstructs its abstract preview", () => {
    const results = mapOpenAlexWorks([{
      id: "https://openalex.org/W123",
      title: "A study of learning systems",
      publication_year: 2024,
      authorships: [{ author: { display_name: "Ari" } }, { author: { display_name: "Bima" } }],
      abstract_inverted_index: { Learning: [0], systems: [2], study: [1] },
    }]);

    expect(results).toEqual([expect.objectContaining({ scope: "academic", title: "A study of learning systems", metadata: "Ari, Bima · 2024", summary: "Learning study systems" })]);
  });

  it("uses the stable OpenAlex page before a redirecting DOI when a paper has no landing page", () => {
    const results = mapOpenAlexWorks([{ id: "https://openalex.org/W456", title: "Paper with DOI", doi: "https://doi.org/10.1000/example" }]);

    expect(results[0]?.url).toBe("https://openalex.org/W456");
  });
});
