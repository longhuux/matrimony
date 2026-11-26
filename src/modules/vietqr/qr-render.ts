import QRCode from "qrcode";

/** Renders a scannable SVG string for an EMVCo VietQR or URL payload. */
export async function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: {
      dark: "#231B18",
      light: "#FFFFFF",
    },
  });
}

/** Renders a PNG Data URL for an EMVCo VietQR or URL payload. */
export async function renderQrDataUrl(payload: string, width = 320): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width,
    color: {
      dark: "#231B18",
      light: "#FFFFFF",
    },
  });
}
