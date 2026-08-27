// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({ trpc: { study: { uploadAvatar: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } } } }));

import { SessionsView } from "./Home";

describe("SessionsView compact cards", () => {
  it("shows compact session metadata and preserves open, pin, and delete actions", () => {
    const onOpen = vi.fn(); const onPin = vi.fn(); const onDelete = vi.fn();
    const sessions = [{ id: "session-1", name: "Cloud security", createdAt: new Date("2026-08-27").getTime(), isPinned: false, materials: [{ id: "source" }], vocabulary: [{ id: "term-1" }, { id: "term-2" }] }] as unknown as Parameters<typeof SessionsView>[0]["sessions"];
    render(<SessionsView sessions={sessions} onOpen={onOpen} onTogglePin={onPin} onDelete={onDelete} />);

    expect(screen.getByText(/1 source.*2 terms/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Open Cloud security"));
    expect(onOpen).toHaveBeenCalledWith("session-1");
    fireEvent.click(screen.getByLabelText("Favorite session"));
    expect(onPin).toHaveBeenCalledWith("session-1", false);
    fireEvent.click(screen.getByLabelText("Delete Cloud security"));
    expect(onDelete).toHaveBeenCalledWith("session-1");
  });
});
