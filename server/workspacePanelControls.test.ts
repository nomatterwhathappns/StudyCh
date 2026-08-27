import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace panel controls", () => {
  it("keeps Source and Watch hide controls available at desktop widths", () => {
    const workspace = readFileSync(resolve(process.cwd(), "client/src/pages/StudyWorkspace.tsx"), "utf8");
    const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(workspace).toContain('className="study-icon-button" aria-label="Toggle source panel"');
    expect(workspace).toContain('className="study-icon-button" aria-label="Toggle watch panel"');
    expect(workspace).not.toContain('study-icon-button lg:hidden" aria-label="Toggle source panel"');
    expect(workspace).not.toContain('study-icon-button lg:hidden" aria-label="Toggle watch panel"');
    expect(workspace).toContain('isCompact ? "p-0" : "p-3 sm:p-4"');
    expect(styles).toContain('.study-panel-group [data-slot="resizable-panel"]');
    expect(styles).toContain('margin-inline: 0.55rem');
  });
});
