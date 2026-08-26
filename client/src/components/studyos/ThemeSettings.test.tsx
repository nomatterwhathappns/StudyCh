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

  it("lets the dashboard picker apply Lilac Sky explicitly", () => {
    const ui = render(<PaletteProvider><ThemeSettings /></PaletteProvider>);

    fireEvent.click(ui.getByRole("button", { name: /Theme/i }));
    fireEvent.click(ui.getByRole("button", { name: /Lilac Sky/i }));

    expect(document.documentElement.dataset.palette).toBe("lilac-sky");
  });

  it("lets the dashboard picker apply Ocean Depths explicitly", () => {
    const ui = render(<PaletteProvider><ThemeSettings /></PaletteProvider>);

    fireEvent.click(ui.getByRole("button", { name: /Theme/i }));
    fireEvent.click(ui.getByRole("button", { name: /Ocean Depths/i }));

    expect(document.documentElement.dataset.palette).toBe("ocean-depths");
  });

  it("shows the complete batch collection in the manual picker", () => {
    const ui = render(<PaletteProvider><ThemeSettings /></PaletteProvider>);

    fireEvent.click(ui.getByRole("button", { name: /Theme/i }));

    expect(ui.getByRole("button", { name: /Fuchsia Noir/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Tea Olive/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Sapphire Blush/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Grape Rose/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Ink Berry/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Forest Blush/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Noir Saffron/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Grape Soda/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Velvet Orchid/i })).toBeTruthy();
    expect(ui.getByRole("button", { name: /Dusk Grape/i })).toBeTruthy();
  });
});
