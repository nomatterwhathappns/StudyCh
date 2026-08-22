import { beforeEach, describe, expect, it, vi } from "vitest";

const { storagePut } = vi.hoisted(() => ({ storagePut: vi.fn() }));
vi.mock("./storage", () => ({ storagePut }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("study.uploadDocument", () => {
  beforeEach(() => storagePut.mockReset());

  it("extracts text, stores the original file, and returns source metadata", async () => {
    storagePut.mockResolvedValueOnce({ key: "studyos/materials/biology.txt", url: "/manus-storage/biology.txt" });
    const dataUrl = `data:text/plain;base64,${Buffer.from("Cells use membranes to control movement.").toString("base64")}`;
    const result = await appRouter.createCaller(context()).study.uploadDocument({ name: "biology notes.txt", mimeType: "text/plain", dataUrl });

    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/studyos\/materials\/.*biology-notes\.txt$/), expect.any(Buffer), "text/plain");
    expect(result).toEqual({ title: "biology notes.txt", url: "/manus-storage/biology.txt", content: "Cells use membranes to control movement.", format: "TXT" });
  });

  it("rejects a declared PDF whose bytes are not a PDF", async () => {
    const dataUrl = `data:application/pdf;base64,${Buffer.from("not a pdf").toString("base64")}`;
    await expect(appRouter.createCaller(context()).study.uploadDocument({ name: "broken.pdf", mimeType: "application/pdf", dataUrl })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storagePut).not.toHaveBeenCalled();
  });
});
