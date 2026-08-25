// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultQuizGenerationSettings, QuizGeneratorDialog, type QuizGenerationSettings } from "./QuizGeneratorDialog";

function Harness({ onGenerate = vi.fn() }: { onGenerate?: () => void }) {
  const [settings, setSettings] = useState<QuizGenerationSettings>(defaultQuizGenerationSettings);
  return <QuizGeneratorDialog open settings={settings} pending={false} hasMaterials onOpenChange={vi.fn()} onSettingsChange={setSettings} onGenerate={onGenerate} />;
}

afterEach(cleanup);

describe("QuizGeneratorDialog", () => {
  it("applies the Quick preset and lets the learner customize question and option counts", () => {
    const ui = render(<Harness />);

    expect(ui.getByRole("button", { name: "Generate 5 questions" })).toBeTruthy();
    fireEvent.click(ui.getByText("Quick"));
    expect(ui.getByRole("button", { name: "Generate 3 questions" })).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "A–B" }));
    fireEvent.click(ui.getByRole("button", { name: "Hard" }));
    expect(ui.getByRole("button", { name: "Generate 3 questions" })).toBeTruthy();
  });

  it("blocks generation when no source material is available", () => {
    const onGenerate = vi.fn();
    const ui = render(<QuizGeneratorDialog open settings={defaultQuizGenerationSettings} pending={false} hasMaterials={false} onOpenChange={vi.fn()} onSettingsChange={vi.fn()} onGenerate={onGenerate} />);

    expect(ui.getByText(/Tambahkan atau impor materi/i)).toBeTruthy();
    expect(ui.getByRole("button", { name: "Generate 5 questions" }).hasAttribute("disabled")).toBe(true);
  });
});
