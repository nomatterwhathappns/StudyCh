import { describe, expect, it } from "vitest";
import { buildAdaptiveMaterialContext, buildMaterialContext, buildMaterialContextWithCitations, contextBudgetForResponseMode } from "./material-context";
import type { Material } from "./study-types";

const material = (title: string, content: string): Material => ({ id: title, title, type: "file", content, createdAt: 1 });

describe("buildMaterialContext", () => {
  it("labels chunks with their source title", () => {
    const context = buildMaterialContext([material("Biology.pdf", "Cells have membranes.\n\nMitochondria produce energy.")]);
    expect(context).toContain("[Source: Biology.pdf · part 1]");
  });

  it("prioritises chunks relevant to the learner question", () => {
    const context = buildMaterialContext([
      material("History.txt", "Ancient trade connected coastal cities."),
      material("Biology.pdf", "Photosynthesis converts light energy into chemical energy in plants."),
    ], "How does photosynthesis use energy?");
    expect(context.startsWith("[Source: Biology.pdf · part 1]")).toBe(true);
    expect(context.indexOf("Biology.pdf")).toBeLessThan(context.indexOf("History.txt"));
  });

  it("moves a matching chunk ahead of unrelated chunks from the same document", () => {
    const context = buildMaterialContext([
      material("Biology.pdf", `${"Cell membranes regulate movement across the cell. ".repeat(25)}\n\n${"Mitochondria release usable energy from nutrients. ".repeat(25)}`),
    ], "What do mitochondria do?");
    expect(context.startsWith("[Source: Biology.pdf · part 2]")).toBe(true);
    expect(context.indexOf("Mitochondria release")).toBeLessThan(context.indexOf("Cell membranes regulate"));
  });

  it("preserves source chunk metadata for citation controls", () => {
    const context = buildMaterialContextWithCitations([material("Biology.pdf", "Cells have membranes.")]);
    expect(context.citations).toEqual([{ materialId: "Biology.pdf", title: "Biology.pdf", ordinal: 1 }]);
    expect(context.text).toContain("[Source: Biology.pdf · part 1]");
  });

  it("uses a small focused context for Fast and retains more source material for Deep", () => {
    const longSource = `${"Caching keeps repeated reads fast. ".repeat(160)}\n\n${"Replication improves availability. ".repeat(160)}\n\n${"Encryption protects stored data. ".repeat(160)}`;
    const materials = [material("Systems.md", longSource)];
    const fast = buildAdaptiveMaterialContext(materials, "How does caching help?", "Fast");
    const balanced = buildAdaptiveMaterialContext(materials, "How does caching help?", "Balanced");
    const deep = buildAdaptiveMaterialContext(materials, "How does caching help?", "Deep");

    expect(contextBudgetForResponseMode("Fast", "focused question")).toBe(2800);
    expect(contextBudgetForResponseMode("Balanced", "focused question")).toBe(6500);
    expect(contextBudgetForResponseMode("Deep", "focused question")).toBe(9000);
    expect(fast).toContain("Caching keeps repeated reads fast.");
    expect(fast.length).toBeLessThanOrEqual(2800);
    expect(balanced.length).toBeGreaterThan(fast.length);
    expect(deep.length).toBeGreaterThan(balanced.length);
    expect(deep.length).toBeLessThanOrEqual(9000);
  });
});
