import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { getEnv } from "@/lib/env";

export const mediaKindSchema = z.enum(["image", "audio", "font", "led_checkin"]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const presignRequestSchema = z.object({
  kind: mediaKindSchema,
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive(),
  invitationId: z.string().uuid().optional(),
});

const ALLOWED_MEDIA_RULES: Record<
  MediaKind,
  { maxBytes: number; mimes: Record<string, string> }
> = {
  image: {
    maxBytes: 5 * 1024 * 1024,
    mimes: {
      "image/webp": "webp",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/avif": "avif",
    },
  },
  led_checkin: {
    maxBytes: 2 * 1024 * 1024,
    mimes: {
      "image/webp": "webp",
      "image/jpeg": "jpg",
      "image/png": "png",
    },
  },
  audio: {
    maxBytes: 10 * 1024 * 1024,
    mimes: {
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
    },
  },
  font: {
    maxBytes: 2 * 1024 * 1024,
    mimes: {
      "font/woff2": "woff2",
      "application/font-woff2": "woff2",
    },
  },
};

export function validateUploadSpec(input: z.infer<typeof presignRequestSchema>): {
  ext: string;
} {
  const rule = ALLOWED_MEDIA_RULES[input.kind];
  const ext = rule.mimes[input.mimeType.toLowerCase()];
  if (!ext) {
    throw new Error(`Định dạng tệp không được hỗ trợ cho loại ${input.kind}`);
  }
  if (input.sizeBytes > rule.maxBytes) {
    const maxMb = (rule.maxBytes / (1024 * 1024)).toFixed(1);
    throw new Error(`Dung lượng tệp vượt quá giới hạn ${maxMb} MB`);
  }
  return { ext };
}

/**
 * Verifies binary file magic headers match the declared media MIME type.
 */
export function verifyFileMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();

  switch (normalized) {
    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );
    case "image/avif":
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 4, 8) === "ftyp" &&
        ["avif", "avis", "mif1"].includes(buffer.toString("ascii", 8, 12))
      );
    case "audio/wav":
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WAVE"
      );
    case "audio/mpeg":
    case "audio/mp3":
      return (
        buffer.length >= 3 &&
        (buffer.toString("ascii", 0, 3) === "ID3" ||
          (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))
      );
    case "audio/mp4":
    case "audio/x-m4a":
      return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
    case "font/woff2":
    case "application/font-woff2":
      return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "wOF2";
    default:
      return false;
  }
}

let cachedS3: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedS3) return cachedS3;
  const env = getEnv();
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("Cloudflare R2 credentials are not configured");
  }
  cachedS3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return cachedS3;
}

export interface PresignedUploadResult {
  driver: "local" | "r2";
  r2Key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
}

/**
 * Generates either a Cloudflare R2 presigned PUT URL or a local-dev PUT endpoint.
 */
export async function createPresignedUpload(params: {
  userId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
}): Promise<PresignedUploadResult> {
  const { ext } = validateUploadSpec(params);
  const env = getEnv();
  const safeUserId = params.userId.replace(/[^a-zA-Z0-9-]/g, "");
  const fileId = crypto.randomUUID();
  const r2Key = `u/${safeUserId}/${params.kind}/${fileId}.${ext}`;

  if (env.STORAGE_DRIVER === "r2") {
    if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
      throw new Error("R2_BUCKET_NAME and R2_PUBLIC_URL are required when STORAGE_DRIVER=r2");
    }
    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: r2Key,
      ContentType: params.mimeType,
      ContentLength: params.sizeBytes,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    const base = env.R2_PUBLIC_URL.replace(/\/+$/, "");
    return {
      driver: "r2",
      r2Key,
      uploadUrl,
      publicUrl: `${base}/${r2Key}`,
      expiresInSeconds: 300,
    };
  }

  const localPath = `/api/media/local/${r2Key}`;
  return {
    driver: "local",
    r2Key,
    uploadUrl: localPath,
    publicUrl: localPath,
    expiresInSeconds: 300,
  };
}
