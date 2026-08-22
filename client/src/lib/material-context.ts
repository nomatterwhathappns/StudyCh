import type { Material } from "./study-types";

export type MaterialCitation = { materialId: string; title: string; ordinal: number };
export type ContextChunk = MaterialCitation & { text: string; score: number };
export type ResponseMode = "Fast" | "Balanced" | "Deep";

export function normalizeResponseMode(value: string | undefined): ResponseMode {
  if (value === "Fast" || value === "Concise") return "Fast";
  if (value === "Deep" || value === "Detailed") return "Deep";
  return "Balanced";
}

export function contextBudgetForResponseMode(mode: ResponseMode, query = "") {
  const hasFocusedQuestion = query.trim().length > 0;
  if (mode === "Fast") return hasFocusedQuestion ? 2_800 : 5_500;
  // Keep the client context safely below the shared 10k chat payload limit.
  if (mode === "Deep") return hasFocusedQuestion ? 9_000 : 9_500;
  return hasFocusedQuestion ? 6_500 : 9_000;
}

export function buildMaterialChunks(material: Material, size = 1250): ContextChunk[] {
  const paragraphs = material.content.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > size) { chunks.push(current); current = ""; }
    if (paragraph.length > size) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
      for (const sentence of sentences) {
        if (current && current.length + sentence.length + 1 > size) { chunks.push(current); current = ""; }
        current = `${current}${current ? " " : ""}${sentence.trim()}`;
      }
    } else current = `${current}${current ? "\n\n" : ""}${paragraph}`;
  }
  if (current) chunks.push(current);
  return chunks.map((text, index) => ({ materialId: material.id, text, title: material.title, ordinal: index + 1, score: 0 }));
}

function meaningfulTerms(query: string) {
  return Array.from(new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])).slice(0, 12);
}

export function buildMaterialContextWithCitations(materials: Material[], query = "", maxCharacters = 10_000) {
  const terms = meaningfulTerms(query);
  const chunks = materials.flatMap((material) => buildMaterialChunks(material)).map((chunk) => ({
    ...chunk,
    score: terms.reduce((total, term) => total + (chunk.text.toLowerCase().split(term).length - 1), 0),
  }));
  const ordered = terms.length ? chunks.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.ordinal - b.ordinal) : chunks;
  let result = "";
  const citations: MaterialCitation[] = [];
  for (const chunk of ordered) {
    const labelled = `[Source: ${chunk.title} · part ${chunk.ordinal}]\n${chunk.text}`;
    if (result && result.length + labelled.length + 2 > maxCharacters) continue;
    result = `${result}${result ? "\n\n" : ""}${labelled}`;
    citations.push({ materialId: chunk.materialId, title: chunk.title, ordinal: chunk.ordinal });
    if (result.length >= maxCharacters) break;
  }
  return { text: result.slice(0, maxCharacters), citations };
}

export function buildMaterialContext(materials: Material[], query = "", maxCharacters = 10_000) {
  return buildMaterialContextWithCitations(materials, query, maxCharacters).text;
}

export function buildAdaptiveMaterialContext(materials: Material[], query = "", responseStyle?: string) {
  const mode = normalizeResponseMode(responseStyle);
  return buildMaterialContext(materials, query, contextBudgetForResponseMode(mode, query));
}

export function materialChunkDomId(materialId: string, ordinal: number) {
  return `study-material-${materialId.replace(/[^a-z0-9_-]/gi, "-")}-part-${ordinal}`;
}
