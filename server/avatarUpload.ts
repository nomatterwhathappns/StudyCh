import { TRPCError } from "@trpc/server";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const MAX_AVATAR_BYTES = 1_500_000;

export function decodeAvatarImage(dataUrl: string): { bytes: Buffer; contentType: "image/png" | "image/jpeg"; extension: "png" | "jpg" } {
  const match = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a PNG or JPG image for your profile photo." });
  }

  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Profile images must be PNG or JPG files under 1.5 MB." });
  }
  const declaredType = match[1].toLowerCase();
  const isPng = declaredType === "png";
  const signature = isPng ? PNG_SIGNATURE : JPEG_SIGNATURE;
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `This file is not a valid ${isPng ? "PNG" : "JPG"} image.` });
  }
  return { bytes, contentType: isPng ? "image/png" : "image/jpeg", extension: isPng ? "png" : "jpg" };
}
