import { describe, expect, it, vi } from "vitest";

const { invokeLLM } = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM }));

import { appRouter, formatStudyResponse, parseChatTranslations, parseKeyTermDraft, parseQuizQuestions, responseMode, responseTokenBudget, systemPrompt } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const materials = "[Source: Biology.pdf · part 1]\nPhotosynthesis converts light energy into chemical energy.";

describe("StudyOS AI prompt regression", () => {
  it("maps Fast, Balanced, and Deep to distinct response budgets and instructions", () => {
    expect(responseMode("Concise")).toBe("Fast");
    expect(responseMode("Balanced")).toBe("Balanced");
    expect(responseMode("Detailed")).toBe("Deep");
    expect(responseTokenBudget("chat", "Fast")).toBe(900);
    expect(responseTokenBudget("chat", "Balanced")).toBe(2400);
    expect(responseTokenBudget("chat", "Deep")).toBe(4200);
    expect(systemPrompt("Cloud", "", false, "Fast")).toContain("one short, direct explanation");
    expect(systemPrompt("Cloud", "", false, "Deep")).toContain("structured and thorough explanation");
  });

  it("uses the natural study-companion persona and source grounding in chat", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "Photosynthesis changes light into stored chemical energy. [Biology.pdf]" } }] });
    await appRouter.createCaller(context()).study.chat({
      sessionName: "Plant biology", materials, translate: true, responseStyle: "Balanced", model: "gpt-5-mini",
      history: [{ role: "user", content: "Jelasin fotosintesis dong" }],
    });

    const request = invokeLLM.mock.calls[0]?.[0];
    const prompt = request.messages[0].content as string;
    expect(prompt).toContain("Sound natural and human");
    expect(prompt).toContain("[Source: Biology.pdf · part 1]");
    expect(prompt).toContain("Always respond in natural Bahasa Indonesia");
    expect(prompt).toContain("Never invent a source");
  });

  it("prepares the requested translation direction and preserves every persisted chat message id", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
      translations: [
        { id: "english-user", content: "Bisa jelaskan penyimpanan cloud?" },
        { id: "indonesian-ai", content: "Cloud storage menyimpan file lewat internet." },
      ],
    }) }, finish_reason: "stop" }] });
    const result = await appRouter.createCaller(context()).study.translateChat({
      model: "gpt-5-mini",
      target: "indonesian",
      messages: [
        { id: "english-user", content: "Can you explain cloud storage?" },
        { id: "indonesian-ai", content: "Cloud storage menyimpan file lewat internet." },
      ],
    });

    expect(result).toEqual({ translations: {
      english: [
        { id: "english-user", content: "Can you explain cloud storage?" },
        { id: "indonesian-ai", content: "Cloud storage menyimpan file lewat internet." },
      ],
      indonesian: [
        { id: "english-user", content: "Bisa jelaskan penyimpanan cloud?" },
        { id: "indonesian-ai", content: "Cloud storage menyimpan file lewat internet." },
      ],
    } });
    const request = invokeLLM.mock.calls.at(-1)?.[0];
    expect(request.messages[0].content).toContain("The opposite language will use the original chat text");
    expect(request.messages[0].content).toContain("Preserve Markdown");
  });

  it("rejects incomplete translation JSON instead of assigning text to the wrong chat bubble", () => {
    expect(() => parseChatTranslations(JSON.stringify({ translations: [{ id: "only-one", content: "Satu" }] }), ["only-one", "missing"])).toThrow("could not translate every chat message");
  });

  it("keeps the supplied chunk labels in quiz generation", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ questions: Array.from({ length: 5 }, (_, index) => ({ question: `Question ${index + 1}`, options: ["A", "B", "C", "D"], correct: 0, explanation: "Because the source says so." })) }) } }] });
    await appRouter.createCaller(context()).study.quiz({ sessionName: "Plant biology", materials, translate: false, responseStyle: "Balanced", model: "gpt-5-mini" });

    const request = invokeLLM.mock.calls.at(-1)?.[0];
    expect(request.messages[1].content).toContain("[Source: Biology.pdf · part 1]");
  });

  it("accepts a quiz JSON payload wrapped in a Markdown code fence", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "```json\n{\"questions\":[{\"question\":\"What powers photosynthesis?\",\"options\":[\"Light\",\"Sound\",\"Wind\",\"Heat\"],\"correct\":0,\"explanation\":\"Light provides energy.\"},{\"question\":\"Where does photosynthesis happen?\",\"options\":[\"Chloroplasts\",\"Roots\",\"Ribosomes\",\"Nuclei\"],\"correct\":0,\"explanation\":\"Chloroplasts capture light.\"},{\"question\":\"What gas is used?\",\"options\":[\"Carbon dioxide\",\"Oxygen\",\"Helium\",\"Nitrogen\"],\"correct\":0,\"explanation\":\"Plants use carbon dioxide.\"},{\"question\":\"What is produced?\",\"options\":[\"Glucose\",\"Salt\",\"Iron\",\"Water only\"],\"correct\":0,\"explanation\":\"Glucose stores energy.\"},{\"question\":\"What pigment helps?\",\"options\":[\"Chlorophyll\",\"Keratin\",\"Insulin\",\"Collagen\"],\"correct\":0,\"explanation\":\"Chlorophyll absorbs light.\"}]}\n```" }, finish_reason: "stop" }] });
    await expect(appRouter.createCaller(context()).study.quiz({ sessionName: "Plant biology", materials, translate: false, responseStyle: "Balanced", model: "gpt-5-mini" })).resolves.toHaveProperty("questions", expect.any(Array));
  });

  it("normalizes a fallback Quiz answer key supplied as correctIndex", () => {
    const payload = JSON.stringify({ questions: Array.from({ length: 5 }, (_, index) => ({ question: `Question ${index + 1}`, options: ["A", "B", "C", "D"], correctIndex: index % 4, explanation: "From the source." })) });
    expect(parseQuizQuestions(payload)).toEqual(expect.arrayContaining([expect.objectContaining({ correct: 0 }), expect.objectContaining({ correct: 1 })]));
  });

  it("returns clean chat text, structured citations, and a continuation signal when a model reaches its output limit", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "Fotosintesis mengubah cahaya menjadi energi kimia. [Source: Biology.pdf · part 1]", }, finish_reason: "length" }] });
    const result = await appRouter.createCaller(context()).study.chat({
      sessionName: "Plant biology", materials, translate: true, responseStyle: "Balanced", model: "gpt-5-mini",
      history: [{ role: "user", content: "Jelasin fotosintesis dong" }],
    });

    expect(result).toEqual({ text: "Fotosintesis mengubah cahaya menjadi energi kimia.", citations: [{ title: "Biology.pdf", ordinal: 1 }], truncated: true, provider: "StudyOS AI gateway · GPT-5 mini" });
    expect(invokeLLM.mock.calls.at(-1)?.[0]?.maxTokens).toBe(2400);
  });

  it("extracts and removes raw source labels before the answer reaches the chat UI", () => {
    expect(formatStudyResponse("A claim. [Source: Notes.md · part 3]")).toEqual({ text: "A claim.", citations: [{ title: "Notes.md", ordinal: 3 }] });
  });

  it("continues the latest answer with the larger chat output budget", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "Sisa penjelasan yang selesai. [Source: Biology.pdf · part 1]" }, finish_reason: "stop" }] });
    const result = await appRouter.createCaller(context()).study.continue({
      sessionName: "Plant biology", materials, translate: true, responseStyle: "Balanced", model: "gpt-5-mini",
      history: [{ role: "user", content: "Jelaskan fotosintesis" }, { role: "assistant", content: "Fotosintesis adalah" }],
    });

    expect(result).toEqual({ text: "Sisa penjelasan yang selesai.", citations: [{ title: "Biology.pdf", ordinal: 1 }], truncated: false, provider: "StudyOS AI gateway · GPT-5 mini" });
    const request = invokeLLM.mock.calls.at(-1)?.[0];
    expect(request.maxTokens).toBe(2400);
    expect(request.messages.at(-1)?.content).toContain("Continue the immediately preceding answer");
  });

  it("returns a validated structured draft for a selected Key Term", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ term: "AWS S3", definition: "Object storage from AWS.", context: "The source describes S3 as durable cloud object storage.", example: "A study app can store uploaded PDFs in an S3 bucket." }) }, finish_reason: "stop" }] });
    const result = await appRouter.createCaller(context()).study.draftKeyTerm({
      sessionName: "Cloud basics", materials: "[Source: Cloud.md · part 1]\nAWS S3 stores objects in buckets.", translate: true, responseStyle: "Balanced", model: "gpt-5-mini", selection: "AWS S3",
    });

    expect(result).toEqual({ term: "AWS S3", definition: "Object storage from AWS.", context: "The source describes S3 as durable cloud object storage.", example: "A study app can store uploaded PDFs in an S3 bucket." });
    const request = invokeLLM.mock.calls.at(-1)?.[0];
    expect(request.maxTokens).toBe(700);
    expect(request.response_format).toBeUndefined();
    expect(request.messages[0].content).toContain("Make term the shortest standard name or acronym");
    expect(request.messages[0].content).toContain("definition one plain-language sentence of at most 180 characters");
  });

  it("returns a compact vocabulary translation without Key Term details", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ term: "resilient", meaning: "tangguh" }) }, finish_reason: "stop" }] });
    const result = await appRouter.createCaller(context()).study.draftVocabulary({
      sessionName: "English vocabulary", materials: "", translate: false, responseStyle: "Balanced", model: "gpt-5-mini", selection: "resilient",
    });

    expect(result).toEqual({ term: "resilient", meaning: "tangguh" });
    const request = invokeLLM.mock.calls.at(-1)?.[0];
    expect(request.maxTokens).toBe(250);
    expect(request.messages[0].content).toContain("minimal vocabulary cards");
    expect(request.messages[0].content).toContain("short, natural Bahasa Indonesia translation");
    expect(request.messages[0].content).toContain("string fields: term, meaning");
  });

  it("returns a safe gateway error when a Key Term draft is not valid JSON", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "This is not JSON." }, finish_reason: "stop" }] });
    await expect(appRouter.createCaller(context()).study.draftKeyTerm({
      sessionName: "Cloud basics", materials: "", translate: false, responseStyle: "Balanced", model: "gpt-5-mini", selection: "AWS S3",
    })).rejects.toMatchObject({ code: "BAD_GATEWAY", message: "StudyOS AI returned an invalid Key Term draft. Please try again." });
  });

  it("accepts a Key Term draft wrapped in a JSON code fence", () => {
    expect(parseKeyTermDraft("```json\n{\"term\":\"Amazon S3\",\"definition\":\"AWS object storage.\",\"context\":\"Stores objects in buckets.\",\"example\":\"Save a PDF in S3.\"}\n```")).toMatchObject({ term: "Amazon S3", example: "Save a PDF in S3." });
  });

  it("accepts a labelled Markdown Key Term draft when a provider ignores JSON mode", () => {
    expect(parseKeyTermDraft("**Istilah:** Amazon S3\n**Definisi:** Layanan penyimpanan objek AWS.\n**Konteks:** Menyimpan objek di bucket.\n**Contoh:** Simpan PDF ke bucket S3.")).toEqual({ term: "Amazon S3", definition: "Layanan penyimpanan objek AWS.", context: "Menyimpan objek di bucket.", example: "Simpan PDF ke bucket S3." });
  });

  it("compacts overly detailed Key Term drafts into flashcard-sized fields", () => {
    const detailed = "Amazon S3 is an object storage service that stores and retrieves any amount of data from anywhere, with durability, availability, encryption, lifecycle controls, and many storage classes for cost optimization across workloads.";
    const result = parseKeyTermDraft(JSON.stringify({ term: "Amazon Simple Storage Service (Amazon S3) for every cloud workload and data pipeline", definition: detailed, context: detailed, example: detailed }));
    expect(result.term.length).toBeLessThanOrEqual(80);
    expect(result.definition.length).toBeLessThanOrEqual(180);
    expect(result.context.length).toBeLessThanOrEqual(150);
    expect(result.example.length).toBeLessThanOrEqual(150);
  });

  it("returns a usable draft through the router when a provider wraps JSON in Markdown", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "```json\n{\"term\":\"Amazon S3\",\"definition\":\"Object storage AWS.\",\"context\":\"Stores objects in buckets.\",\"example\":\"Save a PDF in S3.\"}\n```" }, finish_reason: "stop" }] });
    await expect(appRouter.createCaller(context()).study.draftKeyTerm({
      sessionName: "Cloud basics", materials, translate: false, responseStyle: "Balanced", model: "gpt-5-mini", selection: "Amazon S3",
    })).resolves.toMatchObject({ term: "Amazon S3", context: "Stores objects in buckets." });
  });
});
