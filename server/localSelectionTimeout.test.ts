import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("local selection action timeout", () => {
  it("gives local Explain, Save Terms, and Save Vocab a longer bounded timeout", () => {
    expect(source).toContain("const LOCAL_SELECTION_TIMEOUT_MS = 30_000");
    expect(source).toContain("localSelectionTimeoutMs(input.model)");
    expect((source.match(/localSelectionTimeoutMs\(input\.model\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
