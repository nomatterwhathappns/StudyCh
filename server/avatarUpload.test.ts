import { describe, expect, it } from "vitest";
import { decodeAvatarImage } from "./avatarUpload";

const validPngDataUrl = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]).toString("base64")}`;
const validJpegDataUrl = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64")}`;

describe("decodeAvatarImage", () => {
  it("accepts a data URL with a PNG signature", () => {
    expect(decodeAvatarImage(validPngDataUrl)).toMatchObject({ contentType: "image/png", extension: "png" });
  });

  it("accepts JPEG data URLs and normalizes them to a JPG storage extension", () => {
    expect(decodeAvatarImage(validJpegDataUrl)).toMatchObject({ contentType: "image/jpeg", extension: "jpg" });
  });

  it("rejects invalid image signatures", () => {
    expect(() => decodeAvatarImage("data:image/jpeg;base64,SGVsbG8=")).toThrow(/valid JPG/i);
    expect(() => decodeAvatarImage("data:image/png;base64,SGVsbG8=")).toThrow(/valid PNG/i);
  });

  it("rejects images larger than 1.5 MB", () => {
    const oversized = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1_500_000)]);
    expect(() => decodeAvatarImage(`data:image/png;base64,${oversized.toString("base64")}`)).toThrow(/under 1.5 MB/i);
  });
});
