import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");
const workspace = readFileSync(resolve(projectRoot, "client/src/pages/StudyWorkspace.tsx"), "utf8");

describe("Key Terms Review theme contrast", () => {
  it("uses a dedicated solid semantic button so Review stays readable across palettes", () => {
    expect(workspace).toContain('aria-label="Review key terms flashcards"');
    expect(css).toContain('[aria-label="Review key terms flashcards"]');
    expect(css).toContain("border-color: var(--primary) !important; background: var(--primary) !important; color: var(--primary-foreground) !important;");
    expect(css).toContain('[aria-label="Review key terms flashcards"]:focus-visible');
  });
});
