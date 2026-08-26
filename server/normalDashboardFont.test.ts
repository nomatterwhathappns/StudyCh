import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");
const home = readFileSync(resolve(projectRoot, "client/src/pages/Home.tsx"), "utf8");
const workspace = readFileSync(resolve(projectRoot, "client/src/pages/StudyWorkspace.tsx"), "utf8");

describe("normal dashboard typography", () => {
  it("uses the normal app font everywhere except the profile name and workspace StudyOS wordmark", () => {
    expect(css).toContain(".font-display { font-family: var(--font-sans) !important; font-style: normal !important;");
    expect(css).toContain(".study-profile-card .font-display, .study-workspace-header > button > span:first-child");
    expect(css).toContain("font-family: var(--font-display) !important; font-style: italic !important;");
  });

  it("removes the visible dash prefix from the reported empty states", () => {
    expect(home).toContain('<span>{text}</span>');
    expect(workspace).toContain('leading-relaxed text-muted-foreground">{text}</div>;');
    expect(css).toContain(".study-empty-large { @apply");
    expect(css).toContain("font-size: 0;");
    expect(css).toContain(".study-empty-large span");
    expect(css).toContain("font-size: 1rem;");
  });
});
