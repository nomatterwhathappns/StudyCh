import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");
const workspace = readFileSync(resolve(projectRoot, "client/src/pages/StudyWorkspace.tsx"), "utf8");

describe("chat composer layout", () => {
  it("uses a borderless multiline composer with a separate send bubble", () => {
    expect(workspace).toContain("<textarea rows={1}");
    expect(workspace).toContain('className="study-chat-composer"');
    expect(workspace).toContain('event.key === "Enter" && !event.shiftKey');
    expect(css).toContain(".study-chat-composer {");
    expect(css).toContain(".study-chat-input-shell textarea {");
    expect(css).toContain("field-sizing: content;");
    expect(css).toContain("rounded-full bg-primary text-primary-foreground");
  });
});
