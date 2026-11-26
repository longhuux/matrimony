import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invitations, ledSessions } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { extractClientIp } from "@/modules/auth/csrf";
import {
  checkIpRateLimit,
  resolveLedPhotoPublicUrl,
  sanitizeLedSlug,
} from "@/modules/led-realtime";
import { verifyFileMagicBytes } from "@/modules/storage/r2";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
const LOCAL_UPLOAD_ROOT = path.resolve(process.cwd(), ".local-uploads");

const ALLOWED_LED_MIMES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const MIME_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

let cachedR2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedR2Client) return cachedR2Client;
  const env = getEnv();
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("Cloudflare R2 credentials are not configured");
  }
  cachedR2Client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return cachedR2Client;
}

async function readBoundedBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; status: number; error: string }> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "Ảnh tải lên vượt quá giới hạn 2 MB." };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return { ok: false, status: 400, error: "Tệp ảnh trống." };
  }

  return { ok: true, buffer: Buffer.concat(chunks, totalBytes) };
}

function normalizeMime(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.split(";")[0]?.trim().toLowerCase() ?? "";
}

async function extractUploadedPhoto(
  req: Request,
): Promise<
  | { ok: true; buffer: Buffer; mimeType: string; ext: string }
  | { ok: false; status: number; error: string }
> {
  const contentType = normalizeMime(req.headers.get("content-type"));

  if (contentType === "multipart/form-data") {
    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const declared = Number(contentLengthHeader);
      if (Number.isFinite(declared) && declared > MAX_BYTES + 256 * 1024) {
        return { ok: false, status: 413, error: "Ảnh tải lên vượt quá giới hạn 2 MB." };
      }
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return { ok: false, status: 400, error: "Không thể đọc dữ liệu biểu mẫu tải lên." };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, status: 400, error: "Thiếu trường ảnh (file)." };
    }
    if (file.size <= 0) {
      return { ok: false, status: 400, error: "Tệp ảnh trống." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, status: 413, error: "Ảnh tải lên vượt quá giới hạn 2 MB." };
    }

    const mimeType = normalizeMime(file.type || req.headers.get("x-mime-type"));
    const ext = ALLOWED_LED_MIMES[mimeType];
    if (!ext) {
      return {
        ok: false,
        status: 400,
        error: "Chỉ hỗ trợ ảnh định dạng JPEG, PNG hoặc WebP.",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return { ok: true, buffer, mimeType, ext };
  }

  const mimeType = normalizeMime(req.headers.get("x-mime-type") ?? contentType);
  const ext = ALLOWED_LED_MIMES[mimeType];
  if (!ext) {
    return {
      ok: false,
      status: 400,
      error: "Chỉ hỗ trợ ảnh định dạng JPEG, PNG hoặc WebP.",
    };
  }
  if (!req.body) {
    return { ok: false, status: 400, error: "Tệp ảnh trống." };
  }

  const bodyResult = await readBoundedBody(req.body, MAX_BYTES);
  if (!bodyResult.ok) {
    return bodyResult;
  }

  return { ok: true, buffer: bodyResult.buffer, mimeType, ext };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const ip = extractClientIp(req);
  const allowed = await checkIpRateLimit("led-upload", ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Bạn đang tải ảnh quá nhanh. Vui lòng thử lại sau ít phút." },
      { status: 429 },
    );
  }

  const { slug } = await context.params;
  const safeSlug = sanitizeLedSlug(slug);
  if (!safeSlug) {
    return NextResponse.json({ error: "Slug không hợp lệ." }, { status: 400 });
  }

  const [activeLed] = await db
    .select({
      sessionId: ledSessions.id,
    })
    .from(invitations)
    .innerJoin(ledSessions, eq(ledSessions.invitationId, invitations.id))
    .where(and(eq(invitations.slug, slug), eq(ledSessions.isActive, true)))
    .limit(1);

  if (!activeLed) {
    return NextResponse.json(
      { error: "Không tìm thấy phiên check-in LED đang hoạt động." },
      { status: 404 },
    );
  }

  const upload = await extractUploadedPhoto(req);
  if (!upload.ok) {
    return NextResponse.json({ error: upload.error }, { status: upload.status });
  }

  if (!verifyFileMagicBytes(upload.buffer, upload.mimeType)) {
    return NextResponse.json(
      { error: "Nội dung ảnh không khớp với định dạng tệp khai báo." },
      { status: 400 },
    );
  }

  const fileId = crypto.randomUUID();
  const photoKey = `led/${safeSlug}/${fileId}.${upload.ext}`;
  const env = getEnv();

  if (env.STORAGE_DRIVER === "r2") {
    if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
      return NextResponse.json(
        { error: "R2 storage is not properly configured." },
        { status: 500 },
      );
    }

    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: photoKey,
        Body: upload.buffer,
        ContentType: upload.mimeType,
        ContentLength: upload.buffer.byteLength,
      }),
    );

    return NextResponse.json(
      {
        photoKey,
        publicUrl: resolveLedPhotoPublicUrl(slug, photoKey),
      },
      { status: 201 },
    );
  }

  const slugDir = path.resolve(LOCAL_UPLOAD_ROOT, "led", safeSlug);
  const targetPath = path.resolve(LOCAL_UPLOAD_ROOT, photoKey);
  if (!targetPath.startsWith(`${slugDir}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  await fs.mkdir(slugDir, { recursive: true });
  await fs.writeFile(targetPath, upload.buffer);

  return NextResponse.json(
    {
      photoKey,
      publicUrl: resolveLedPhotoPublicUrl(slug, photoKey),
    },
    { status: 201 },
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  if (getEnv().STORAGE_DRIVER !== "local") {
    return NextResponse.json({ error: "Local upload endpoint disabled" }, { status: 404 });
  }

  const { slug } = await context.params;
  const safeSlug = sanitizeLedSlug(slug);
  if (!safeSlug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const key = new URL(req.url).searchParams.get("key")?.trim() ?? "";
  const expectedPrefix = `led/${safeSlug}/`;
  if (!key || !key.startsWith(expectedPrefix) || key.includes("..") || key.includes("\0")) {
    return NextResponse.json({ error: "Invalid photo key" }, { status: 400 });
  }

  const slugDir = path.resolve(LOCAL_UPLOAD_ROOT, "led", safeSlug);
  const absTarget = path.resolve(LOCAL_UPLOAD_ROOT, key);
  if (!absTarget.startsWith(`${slugDir}${path.sep}`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [realSlugDir, realTarget] = await Promise.all([
      fs.realpath(slugDir),
      fs.realpath(absTarget),
    ]);
    if (!realTarget.startsWith(`${realSlugDir}${path.sep}`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await fs.readFile(realTarget);
    const ext = path.extname(realTarget).toLowerCase();
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
