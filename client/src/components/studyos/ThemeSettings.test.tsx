// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaletteProvider } from "@/contexts/PaletteContext";
import { ThemeSettings, ThemeShuffleButton } from "./ThemeSettings";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.palette;
});

describe("ThemeSettings", () => {
  it("switches to the Vintage Rose palette and saves the browser-local preference", () => {
    const ui = render(<PaletteProvider><ThemeSettings /></PaletteProvider>);

    fireEvent.click(ui.getByRole("button", { name: /Theme/i }));
    fireEvent.click(ui.getByRole("button", { name: /Vintage Rose/i }));

    expect(document.documentElement.dataset.palette).toBe("vintage-rose");
    expect(localStorage.getItem("studyos_theme_palette")).toBe("vintage-rose");
  });

  it("shuffles to a different available palette without opening the manual picker", () => {
    const ui = render(<PaletteProvider><ThemeShuffleButton /></PaletteProvider>);

    fireEvent.click(ui.getByRole("button", { name: "Shuffle theme" }));

    expect(document.documentElement.dataset.palette).not.toBe("vintage-rose");
  });

  it("lets the dashboard picker apply Midnight Blue explicitly", () => {
    const ui = render(<PaletteProvider><ThemeSettings /></PaletteProvider>);

    fireEvent.click(ui.getByRole("button", { name: /Theme/i }));
    fireEvent.click(ui.getByRole("button", { name: /Midnight Blue/i }));

    expect(document.documentElement.dataset.palette).toBe("midnight-blue");
  });
});
