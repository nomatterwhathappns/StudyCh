import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const workspace = readFileSync(resolve(projectRoot, "client/src/pages/StudyWorkspace.tsx"), "utf8");
const styles = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");

describe("responsive Chat workspace", () => {
  it("uses one switchable panel below 1200px and preserves three-panel desktop above it", () => {
    expect(workspace).toContain('window.matchMedia("(max-width: 1199px)")');
    expect(workspace).toContain('isCompact ? "h-[100dvh] min-h-0" : "h-screen min-h-[600px]"');
    expect(workspace).toContain('<CompactWorkspaceNavigation activePanel={compactPanel} onChange={setCompactPanel} />');
    expect(workspace).toContain('<ResizablePanelGroup direction="horizontal"');
  });

  it("keeps compact Chat content within the panel and reserves space for the composer plus panel navigation", () => {
    expect(styles).toContain("@media (max-width: 1199px)");
    expect(styles).toContain(".study-compact-workspace .study-chat-panel { height: 100%; }");
    expect(styles).toContain(".study-compact-workspace .study-message-bubble { max-width: calc(100% - 1rem) !important; }");
    expect(styles).toContain(".study-compact-workspace .study-chat-message.is-ai .study-message-bubble { width: calc(100% - 1rem) !important; }");
    expect(styles).toContain("max-inline-size: 100%; min-inline-size: 0; overflow-wrap: anywhere;");
    expect(styles).toContain("white-space: normal !important;");
    expect(styles).toContain(".study-compact-workspace .study-chat-composer { flex: 0 0 auto;");
    expect(styles).toContain(".study-compact-panel-nav { flex: 0 0 auto; }");
  });
});
