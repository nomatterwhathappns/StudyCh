import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dark theme sidebar contrast", () => {
  it("uses dark active-navigation text against Midnight Blue and Ocean Depths light active surfaces", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(css).toContain(':root[data-palette="midnight-blue"] .study-sidebar .study-nav-item.is-active { color: #070707; }');
    expect(css).toContain(':root[data-palette="ocean-depths"] .study-sidebar .study-nav-item.is-active { color: #0B132B; }');
    expect(css).toContain(':root[data-palette="tea-olive"] .study-sidebar .study-nav-item.is-active { color: #FFFFFF; }');
    expect(css).toContain(':root[data-palette="tea-olive"] .study-sidebar, :root[data-palette="tea-olive"] .study-workspace-header { color: #FFFEF2; }');
    expect(css).toContain(':root[data-palette="tea-olive"] .study-sidebar .study-theme-settings small, :root[data-palette="tea-olive"] .study-sidebar .study-ai-settings small');
    expect(css).toContain(':root[data-palette="tea-olive"] .study-workspace-header > button > span:last-child { color: #FFFFFF !important; border-color: #D0F1BF; font-weight: 700; }');
  });
});
