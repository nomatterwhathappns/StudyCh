// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveKey = vi.fn();
const removeKey = vi.fn();
const invalidate = vi.fn();
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ study: { personalGeminiStatus: { invalidate } } }),
    study: {
      personalGeminiStatus: { useQuery: () => ({ data: { configured: true, keySuffix: "cD9x", model: "gemini-3.6-flash" }, isLoading: false }) },
      savePersonalGeminiKey: { useMutation: () => ({ mutate: saveKey, isPending: false, isError: false }) },
      removePersonalGeminiKey: { useMutation: () => ({ mutate: removeKey, isPending: false, isError: false }) },
    },
  },
}));

import { PersonalAiSettings } from "./PersonalAiSettings";

describe("PersonalAiSettings", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    localStorageMock.clear();
    saveKey.mockReset();
    removeKey.mockReset();
    invalidate.mockReset();
  });

  it("accepts a replacement Gemini key without rendering the saved key value", () => {
    render(<PersonalAiSettings />);
    fireEvent.click(screen.getByRole("button", { name: /AI settings/i }));
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "gemini-3-flash-preview" } });

    expect(screen.getByText(/ending cD9x/i)).toBeTruthy();
    expect(screen.queryByText("AIzaSavedSecretNeverShown")).toBeNull();

    fireEvent.change(screen.getByLabelText("Gemini API key"), { target: { value: "AIzaReplacementKey123456789" } });
    fireEvent.click(screen.getByRole("button", { name: "Replace key" }));

    expect(saveKey).toHaveBeenCalledWith({ apiKey: "AIzaReplacementKey123456789" });
    expect(screen.getByLabelText("Gemini API key").getAttribute("type")).toBe("password");
  });

  it("keeps the gateway model setting separate from a personal Gemini key", () => {
    render(<PersonalAiSettings />);
    fireEvent.click(screen.getByRole("button", { name: /AI settings/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(localStorageMock.getItem("studyos_ai_model")).toBe("gpt-5-mini");
    expect(saveKey).not.toHaveBeenCalled();
  });
});
