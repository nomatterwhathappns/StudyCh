import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("local laptop runtime", () => {
  it("does not render an unresolved cloud analytics placeholder in the client shell", () => {
    const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(html).not.toContain("VITE_ANALYTICS_ENDPOINT");
    expect(html).not.toContain("VITE_ANALYTICS_WEBSITE_ID");
  });

  it("defers cloud OAuth and storage registration while local mode is active", () => {
    const bootstrap = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(bootstrap).toContain('const localStudyMode = process.env.STUDYOS_LOCAL_MODE === "true"');
    expect(bootstrap).toContain("if (!localStudyMode)");
    expect(bootstrap).toContain('await import("./oauth")');
  });
});
