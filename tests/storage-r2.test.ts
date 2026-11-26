import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";
import { createPresignedUpload, verifyFileMagicBytes } from "@/modules/storage/r2";

describe("Storage & Media Magic Bytes Validation", () => {
  const originalStorageDriver = process.env.STORAGE_DRIVER;

  beforeEach(() => {
    resetEnvCacheForTests();
    delete process.env.STORAGE_DRIVER;
  });

  afterEach(() => {
    if (originalStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = originalStorageDriver;
    }
    resetEnvCacheForTests();
  });

  it("returns relative uploadUrl starting with /api/media/local/ under local driver", async () => {
    const result = await createPresignedUpload({
      userId: "user-123",
      kind: "image",
      mimeType: "image/webp",
      sizeBytes: 1024,
    });

    expect(result.driver).toBe("local");
    expect(result.uploadUrl.startsWith("/api/media/local/")).toBe(true);
    expect(result.uploadUrl.startsWith("http://localhost")).toBe(false);
    expect(result.publicUrl).toBe(result.uploadUrl);
    expect(result.r2Key).toMatch(/^u\/user-123\/image\/[0-9a-f-]+\.webp$/);
  });

  it("accepts genuine image, audio, and font magic headers", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const webp = Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ", "latin1");
    const avif = Buffer.from("\x00\x00\x00\x1cftypavif\x00\x00\x00\x00", "latin1");
    const mp3Id3 = Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00", "latin1");
    const mp3Sync = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
    const wav = Buffer.from("RIFF\x24\x00\x00\x00WAVEfmt ", "latin1");
    const m4a = Buffer.from("\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00", "latin1");
    const woff2 = Buffer.from("wOF2\x00\x01\x00\x00", "ascii");

    expect(verifyFileMagicBytes(png, "image/png")).toBe(true);
    expect(verifyFileMagicBytes(jpeg, "image/jpeg")).toBe(true);
    expect(verifyFileMagicBytes(webp, "image/webp")).toBe(true);
    expect(verifyFileMagicBytes(avif, "image/avif")).toBe(true);
    expect(verifyFileMagicBytes(mp3Id3, "audio/mpeg")).toBe(true);
    expect(verifyFileMagicBytes(mp3Sync, "audio/mp3")).toBe(true);
    expect(verifyFileMagicBytes(wav, "audio/wav")).toBe(true);
    expect(verifyFileMagicBytes(m4a, "audio/mp4")).toBe(true);
    expect(verifyFileMagicBytes(m4a, "audio/x-m4a")).toBe(true);
    expect(verifyFileMagicBytes(woff2, "font/woff2")).toBe(true);
    expect(verifyFileMagicBytes(woff2, "application/font-woff2")).toBe(true);
  });

  it("rejects spoofed HTML/text payloads and mismatched MIME types", () => {
    const htmlPayload = Buffer.from("<html><body><script>alert(1)</script></body></html>", "utf8");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(verifyFileMagicBytes(htmlPayload, "image/png")).toBe(false);
    expect(verifyFileMagicBytes(htmlPayload, "image/webp")).toBe(false);
    expect(verifyFileMagicBytes(htmlPayload, "image/jpeg")).toBe(false);
    expect(verifyFileMagicBytes(png, "image/webp")).toBe(false);
    expect(verifyFileMagicBytes(Buffer.alloc(0), "image/png")).toBe(false);
    expect(verifyFileMagicBytes(png, "application/x-sh")).toBe(false);
  });
});
