import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("theme chat bubble tokens", () => {
  it("keeps user and AI bubbles in distinct semantic roles and gives Fuchsia Noir a contrast-safe user bubble", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(css).toContain("background: var(--chat-user-background, var(--primary))");
    expect(css).toContain("color: var(--chat-user-foreground, var(--primary-foreground))");
    expect(css).toContain("background: var(--chat-ai-background, var(--card))");
    expect(css).toContain("color: var(--chat-ai-foreground, var(--card-foreground))");
    expect(css).toContain("--chat-user-background: #690375; --chat-user-foreground: #FFF7FC; --chat-user-border: #CB429F;");
  });
});
