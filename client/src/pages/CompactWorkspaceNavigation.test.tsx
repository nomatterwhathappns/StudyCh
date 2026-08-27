// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompactWorkspaceNavigation } from "./StudyWorkspace";

afterEach(cleanup);

describe("CompactWorkspaceNavigation", () => {
  it("shows Source, Chat, and Watch with the active panel announced accessibly", () => {
    const ui = render(<CompactWorkspaceNavigation activePanel="chat" onChange={vi.fn()} />);
    expect(ui.getByRole("navigation", { name: "Workspace panels" })).toBeTruthy();
    expect(ui.getByRole("button", { name: "Source" }).getAttribute("aria-pressed")).toBe("false");
    expect(ui.getByRole("button", { name: "Chat" }).getAttribute("aria-pressed")).toBe("true");
    expect(ui.getByRole("button", { name: "Watch" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("changes the focused compact panel without unmounting the workspace shell", () => {
    const onChange = vi.fn();
    const ui = render(<CompactWorkspaceNavigation activePanel="chat" onChange={onChange} />);
    fireEvent.click(ui.getByRole("button", { name: "Watch" }));
    expect(onChange).toHaveBeenCalledWith("watch");
    fireEvent.click(ui.getByRole("button", { name: "Source" }));
    expect(onChange).toHaveBeenCalledWith("source");
  });
});
