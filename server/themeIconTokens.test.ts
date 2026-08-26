import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("theme icon token mapping", () => {
  it("maps legacy icon accents through semantic Theme tokens for every palette", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(css).toContain('.text-\\[\\#BA2D0B\\]:not([role="alert"]) { color: var(--ember) !important; }');
    expect(css).toContain('.bg-\\[\\#BA2D0B\\] { background-color: var(--ember) !important; }');
    expect(css).toContain('.hover\\:text-\\[\\#BA2D0B\\]:hover { color: var(--destructive) !important; }');
    expect(css).not.toMatch(/:root\[data-palette="[^"]+"\] \.text-\\\[\\#BA2D0B\\\]/);
  });
});
