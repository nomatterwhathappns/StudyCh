// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderChatMarkdown } from "./render-chat-markdown";

describe("renderChatMarkdown", () => {
  it("renders bold text, lists, and separators without exposing Markdown markers", () => {
    const target = document.createElement("div");
    renderChatMarkdown(target, "**Cara masak:**\n\n1. **Haluskan** bumbu\n2. Masak perlahan\n\n---\n\n**Tips**");
    expect(target.querySelector("strong")?.textContent).toBe("Cara masak:");
    expect(target.querySelectorAll("ol li")).toHaveLength(2);
    expect(target.querySelector("hr")).toBeTruthy();
    expect(target.textContent).not.toContain("**");
  });
});
