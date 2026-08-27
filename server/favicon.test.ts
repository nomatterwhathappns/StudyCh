import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("StudyOS favicon", () => {
  it("uses the StudyOS logo asset in the app tab", () => {
    const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(html).toContain('<link rel="icon" type="image/x-icon" href="/studyos-favicon-v5.ico" />');
    expect(html).toContain('<link rel="shortcut icon" type="image/x-icon" href="/studyos-favicon-v5.ico" />');
  });
});
