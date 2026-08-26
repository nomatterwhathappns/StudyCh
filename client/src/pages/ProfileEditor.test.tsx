// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    study: {
      uploadAvatar: {
        useMutation: () => ({ mutateAsync, isPending: false }),
      },
    },
  },
}));

import { ProfileEditor } from "./Home";

describe("ProfileEditor", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ url: "/manus-storage/studyos/avatars/profile_uploaded.png" });
  });

  it("previews a valid PNG and saves the storage URL returned by the upload mutation", async () => {
    const onSave = vi.fn();
    render(<ProfileEditor profile={{ name: "Alya" }} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const input = screen.getByLabelText(/profile photo/i);
    const image = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "avatar.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [image] } });

    await waitFor(() => expect(screen.getByAltText("Profile")).toHaveAttribute("src", expect.stringMatching(/^data:image\/png;base64,/)));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ imageDataUrl: expect.stringMatching(/^data:image\/png;base64,/) }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: "Alya", aiName: "StudyOS", avatar: "/manus-storage/studyos/avatars/profile_uploaded.png" }));
  });

  it("accepts a JPG file, previews it, and uploads its JPEG data URL", async () => {
    const onSave = vi.fn();
    render(<ProfileEditor profile={{ name: "Alya" }} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const input = screen.getByLabelText(/profile photo/i);
    const image = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [image] } });

    await waitFor(() => expect(screen.getByAltText("Profile")).toHaveAttribute("src", expect.stringMatching(/^data:image\/jpeg;base64,/)));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ imageDataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/) }));
  });

  it("saves a custom AI companion name and can reset it to StudyOS", async () => {
    const onSave = vi.fn();
    render(<ProfileEditor profile={{ name: "Alya", aiName: "Aira" }} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const input = screen.getByLabelText(/AI study companion name/i);
    expect(input).toHaveValue("Aira");
    fireEvent.change(input, { target: { value: "Nara" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: "Alya", aiName: "Nara", avatar: undefined }));

    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset to studyos/i }));
    expect(screen.getByLabelText(/AI study companion name/i)).toHaveValue("StudyOS");
  });
});
