import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");
const workspace = readFileSync(resolve(projectRoot, "client/src/pages/StudyWorkspace.tsx"), "utf8");

describe("chat composer layout", () => {
  it("uses a distinct multiline composer bubble with a separate send bubble", () => {
    expect(workspace).toContain("<textarea rows={1}");
    expect(workspace).toContain('className="study-chat-composer"');
    expect(workspace).toContain('event.key === "Enter" && !event.shiftKey');
    expect(css).toContain(".study-chat-composer {");
    expect(css).toContain("flex-col rounded-[1.4rem] border border-border");
    expect(css).toContain("background: color-mix(in srgb, var(--card) 92%, var(--secondary));");
    expect(css).toContain(".study-chat-input-shell textarea {");
    expect(css).toContain("border: 0 !important; box-shadow: none !important;");
    expect(css).toContain("textarea::-webkit-scrollbar-thumb");
    expect(css).toContain(".study-chat-composer-actions {");
    expect(css).toContain("align-self: flex-end; margin-top: 0.25rem;");
    expect(workspace).toContain("<AiCancellationDock />");
    expect(css).toContain("field-sizing: content;");
    expect(css).toContain("rounded-full bg-primary text-primary-foreground");
  });
});
