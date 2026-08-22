// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceProfileButton } from "./StudyWorkspace";

describe("WorkspaceProfileButton", () => {
  it("renders the uploaded profile PNG in the workspace header and retains profile navigation", () => {
    const openProfile = vi.fn();
    render(<WorkspaceProfileButton profile={{ name: "Alya", avatar: "/manus-storage/studyos/avatars/profile_uploaded.png" }} onOpenProfile={openProfile} />);

    expect(screen.getByAltText("Profile")).toHaveAttribute("src", "/manus-storage/studyos/avatars/profile_uploaded.png");
    fireEvent.click(screen.getByRole("button", { name: /open profile/i }));
    expect(openProfile).toHaveBeenCalledOnce();
  });
});
