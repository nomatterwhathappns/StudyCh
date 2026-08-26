import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");
const workspace = readFileSync(resolve(projectRoot, "client/src/pages/StudyWorkspace.tsx"), "utf8");

describe("source selection popup and overflow", () => {
  it("anchors selection actions near selected text and protects source content from clipping", () => {
    expect(workspace).toContain('setProperty("--study-selection-x"');
    expect(workspace).toContain('setProperty("--study-selection-y"');
    expect(css).toContain(".study-selection-popover { @apply fixed z-40");
    expect(css).toContain("transform: translate(-50%, -100%)");
    expect(css).toContain(".study-reading-content { @apply min-w-0");
    expect(css).toContain("overflow-wrap: anywhere");
  });
});
