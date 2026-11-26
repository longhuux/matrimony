"use client";

export interface ExtractedWeddingPalette {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
}

export interface PortraitFocalPoint {
  x: number;
  y: number;
}

export interface CompressedWebPResult {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_PALETTE: ExtractedWeddingPalette = {
  primary: "#8B2635",
  secondary: "#F5ECE6",
  accent: "#C89D66",
  text: "#231B18",
  background: "#FFFCF9",
};

const DEFAULT_FOCAL_POINT: PortraitFocalPoint = { x: 0.5, y: 0.34 };

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex({ r, g, b }: RgbColor): string {
  const toHex = (v: number) => clampByte(v).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixRgb(a: RgbColor, b: RgbColor, weightB: number): RgbColor {
  const w = Math.max(0, Math.min(1, weightB));
  return {
    r: a.r * (1 - w) + b.r * w,
    g: a.g * (1 - w) + b.g * w,
    b: a.b * (1 - w) + b.b * w,
  };
}

function relativeLuminance({ r, g, b }: RgbColor): number {
  const linearize = (channel: number) => {
    const srgb = clampByte(channel) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(a: RgbColor, b: RgbColor): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorSaturation({ r, g, b }: RgbColor): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

function colorDistance(a: RgbColor, b: RgbColor): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function ensureWcagContrast(fg: RgbColor, bg: RgbColor, minRatio = 4.5): RgbColor {
  let candidate = { ...fg };
  const darkAnchor: RgbColor = { r: 22, g: 18, b: 16 };
  for (let step = 0; step < 12; step += 1) {
    if (contrastRatio(candidate, bg) >= minRatio) {
      return candidate;
    }
    candidate = mixRgb(candidate, darkAnchor, 0.25);
  }
  return darkAnchor;
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = objectUrl;
    });
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readSampledPixels(img: HTMLImageElement, size = 64): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Extracts a cohesive editorial wedding palette from an uploaded photo, enforcing WCAG AA contrast (>= 4.5:1).
 */
export async function extractWeddingPaletteFromImage(
  file: File,
): Promise<ExtractedWeddingPalette> {
  if (typeof document === "undefined") {
    return DEFAULT_PALETTE;
  }

  try {
    const img = await loadImageElement(file);
    const imageData = readSampledPixels(img, 64);
    if (!imageData) return DEFAULT_PALETTE;

    const buckets = new Map<string, { rSum: number; gSum: number; bSum: number; count: number }>();
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const key = `${Math.floor(r / 24)}-${Math.floor(g / 24)}-${Math.floor(b / 24)}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.rSum += r;
        bucket.gSum += g;
        bucket.bSum += b;
        bucket.count += 1;
      } else {
        buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
      }
    }

    const clusters = Array.from(buckets.values())
      .map((b) => {
        const color: RgbColor = {
          r: b.rSum / b.count,
          g: b.gSum / b.count,
          b: b.bSum / b.count,
        };
        return {
          color,
          count: b.count,
          sat: colorSaturation(color),
          lum: relativeLuminance(color),
        };
      })
      .sort((a, b) => b.count * (1 + b.sat * 1.4) - a.count * (1 + a.sat * 1.4));

    const expressive = clusters.filter((c) => c.lum > 0.03 && c.lum < 0.85 && c.sat > 0.14);
    const primarySeed = expressive[0]?.color ?? clusters[0]?.color ?? { r: 139, g: 38, b: 53 };

    const accentCluster =
      expressive.find((c) => colorDistance(c.color, primarySeed) > 55) ??
      clusters.find((c) => colorDistance(c.color, primarySeed) > 65);
    const accentSeed = accentCluster?.color ?? mixRgb(primarySeed, { r: 200, g: 157, b: 102 }, 0.6);

    const warmIvory: RgbColor = { r: 255, g: 252, b: 249 };
    const backgroundRgb = mixRgb(warmIvory, primarySeed, 0.04);
    const secondaryRgb = mixRgb(warmIvory, accentSeed, 0.14);
    const primaryRgb = ensureWcagContrast(primarySeed, backgroundRgb, 4.5);
    const textRgb = ensureWcagContrast(mixRgb({ r: 30, g: 24, b: 22 }, primarySeed, 0.15), backgroundRgb, 7.0);

    return {
      primary: rgbToHex(primaryRgb),
      secondary: rgbToHex(secondaryRgb),
      accent: rgbToHex(accentSeed),
      text: rgbToHex(textRgb),
      background: rgbToHex(backgroundRgb),
    };
  } catch {
    return DEFAULT_PALETTE;
  }
}

function isLikelySkinTone(r: number, g: number, b: number): boolean {
  if (r <= 95 || g <= 40 || b <= 20) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min > 15 && Math.abs(r - g) > 15 && r > g && r > b;
}

/**
 * Estimates a portrait focal point (x, y) using skin-tone and upper-center edge weights on a 64x64 canvas.
 */
export async function detectPortraitFocalPoint(file: File): Promise<PortraitFocalPoint> {
  if (typeof document === "undefined") {
    return DEFAULT_FOCAL_POINT;
  }

  try {
    const img = await loadImageElement(file);
    const size = 64;
    const imageData = readSampledPixels(img, size);
    if (!imageData) return DEFAULT_FOCAL_POINT;

    const data = imageData.data;
    const lum = new Float32Array(size * size);
    for (let i = 0; i < size * size; i += 1) {
      const idx = i * 4;
      lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    let weightSum = 0;
    let xWeighted = 0;
    let yWeighted = 0;

    for (let y = 1; y < size - 1; y += 1) {
      const normY = y / size;
      // Bias slightly toward the upper half where faces/heads typically sit in wedding portraits.
      const upperPrior = normY <= 0.65 ? 1.35 - Math.abs(normY - 0.34) : 0.45;

      for (let x = 1; x < size - 1; x += 1) {
        const normX = x / size;
        const centerPrior = 1.2 - Math.abs(normX - 0.5) * 0.8;

        const pIdx = (y * size + x) * 4;
        const r = data[pIdx];
        const g = data[pIdx + 1];
        const b = data[pIdx + 2];

        const gx = Math.abs(lum[y * size + (x + 1)] - lum[y * size + (x - 1)]);
        const gy = Math.abs(lum[(y + 1) * size + x] - lum[(y - 1) * size + x]);
        const edge = Math.min(1, (gx + gy) / 140);
        const skin = isLikelySkinTone(r, g, b) ? 1.8 : 0;

        const weight = (skin + edge * 0.9) * upperPrior * centerPrior;
        if (weight > 0.1) {
          weightSum += weight;
          xWeighted += normX * weight;
          yWeighted += normY * weight;
        }
      }
    }

    if (weightSum < 1) {
      return DEFAULT_FOCAL_POINT;
    }

    const x = Math.max(0.15, Math.min(0.85, Number((xWeighted / weightSum).toFixed(3))));
    const y = Math.max(0.15, Math.min(0.75, Number((yWeighted / weightSum).toFixed(3))));
    return { x, y };
  } catch {
    return DEFAULT_FOCAL_POINT;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Resizes and compresses an image to WebP in the browser, stepping down quality to fit maxBytes.
 */
export async function compressImageToWebP(
  file: File,
  opts?: { maxDimension?: number; quality?: number; maxBytes?: number },
): Promise<CompressedWebPResult> {
  const maxDimension = opts?.maxDimension ?? 1600;
  const startQuality = opts?.quality ?? 0.86;
  const maxBytes = opts?.maxBytes ?? 1.5 * 1024 * 1024;

  if (typeof document === "undefined") {
    return {
      blob: file,
      width: 0,
      height: 0,
      mimeType: file.type || "application/octet-stream",
    };
  }

  try {
    const img = await loadImageElement(file);
    const naturalWidth = img.naturalWidth || maxDimension;
    const naturalHeight = img.naturalHeight || maxDimension;
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { blob: file, width: naturalWidth, height: naturalHeight, mimeType: file.type || "image/jpeg" };
    }

    ctx.drawImage(img, 0, 0, width, height);

    let bestBlob: Blob | null = null;
    for (let q = startQuality; q >= 0.42; q = Number((q - 0.08).toFixed(2))) {
      const candidate = await canvasToBlob(canvas, "image/webp", q);
      if (!candidate || candidate.type !== "image/webp") break;
      bestBlob = candidate;
      if (candidate.size <= maxBytes) {
        return { blob: candidate, width, height, mimeType: "image/webp" };
      }
    }

    if (bestBlob) {
      return { blob: bestBlob, width, height, mimeType: "image/webp" };
    }

    const jpegFallback = await canvasToBlob(canvas, "image/jpeg", Math.min(startQuality, 0.84));
    if (jpegFallback) {
      return { blob: jpegFallback, width, height, mimeType: jpegFallback.type || "image/jpeg" };
    }

    return { blob: file, width: naturalWidth, height: naturalHeight, mimeType: file.type || "image/jpeg" };
  } catch {
    return { blob: file, width: 0, height: 0, mimeType: file.type || "image/jpeg" };
  }
}
