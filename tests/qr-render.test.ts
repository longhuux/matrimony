import { describe, expect, it } from "vitest";
import { buildVietQrPayload } from "@/modules/vietqr";
import { renderQrDataUrl, renderQrSvg } from "@/modules/vietqr/qr-render";

describe("VietQR SVG & PNG Data URL Renderer", () => {
  const samplePayload = buildVietQrPayload({
    bankBin: "970436",
    accountNumber: "0123456789",
    amount: 500_000,
    description: "Mung cuoi Minh Linh",
  });

  it("renders valid SVG XML for a Napas VietQR payload", async () => {
    const svg = await renderQrSvg(samplePayload);

    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<path");
  });

  it("renders a valid base64 PNG data URL for a Napas VietQR payload", async () => {
    const dataUrl = await renderQrDataUrl(samplePayload, 280);

    expect(dataUrl).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    const base64Body = dataUrl.slice("data:image/png;base64,".length);
    const pngBytes = Buffer.from(base64Body, "base64");
    // Verify PNG magic signature: 89 50 4E 47 0D 0A 1A 0A
    expect(pngBytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });
});
