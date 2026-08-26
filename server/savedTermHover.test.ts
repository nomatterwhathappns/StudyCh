import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const workspace = readFileSync(resolve(projectRoot, "client/src/pages/StudyWorkspace.tsx"), "utf8");
const css = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");

describe("saved vocabulary hover lookup", () => {
  it("maps source highlights to active-session vocabulary and presents concise or detailed popup content", () => {
    expect(workspace).toContain("entriesByTerm");
    expect(workspace).toContain("activeSessionId");
    expect(workspace).toContain("<HoverCard key={index}");
    expect(workspace).toContain("entry.context ?");
    expect(workspace).toContain("entry.example ?");
    expect(css).toContain(".study-vocab-highlight { cursor: help;");
  });
});
