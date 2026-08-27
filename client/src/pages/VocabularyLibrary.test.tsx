// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({ trpc: { study: { uploadAvatar: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } } } }));

import { VocabularyView } from "./Home";

describe("VocabularyView library", () => {
  it("filters a clean term library, keeps extra context collapsed, and deletes a selected term", () => {
    const onDelete = vi.fn();
    const sessions = [{ id: "security", name: "Security", vocabulary: [{ id: "term-1", term: "Encryption", definition: "Turns data into a protected format.", context: "Used to protect confidential files.", example: "TLS encrypts website traffic." }, { id: "term-2", term: "Latency", definition: "Time delay before data arrives." }] }] as unknown as Parameters<typeof VocabularyView>[0]["sessions"];
    render(<VocabularyView sessions={sessions} onDelete={onDelete} />);

    expect(screen.getByLabelText("Key terms library")).toBeTruthy();
    expect(screen.getByText(/2 terms saved/)).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
    expect(screen.getByLabelText("Delete Encryption")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search key terms"), { target: { value: "latency" } });
    expect(screen.getByText("Latency")).toBeTruthy();
    expect(screen.queryByText("Encryption")).toBeNull();

    fireEvent.change(screen.getByLabelText("Search key terms"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Delete Encryption"));
    expect(onDelete).toHaveBeenCalledWith("security", "term-1");
  });
});
