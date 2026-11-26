import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { verifyFileMagicBytes } from "@/modules/storage/r2";

const LOCAL_UPLOAD_ROOT = path.resolve(process.cwd(), ".local-uploads");
const MAX_LOCAL_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".woff2": "font/woff2",
};

function resolveSafeUploadPath(segments: string[]): { safeKey: string; absPath: string } | null {
  if (segments.length === 0) return null;
  const joined = segments.join("/");
  if (joined.includes("..") || joined.includes("\0")) return null;
  const absPath = path.resolve(LOCAL_UPLOAD_ROOT, joined);
  if (!absPath.startsWith(`${LOCAL_UPLOAD_ROOT}${path.sep}`)) return null;
  return { safeKey: joined, absPath };
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
        return { ok: false, status: 413, error: "Payload exceeds allowed size" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return { ok: false, status: 400, error: "Empty upload payload" };
  }

  return { ok: true, buffer: Buffer.concat(chunks, totalBytes) };
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  if (getEnv().STORAGE_DRIVER !== "local") {
    return NextResponse.json({ error: "Local upload endpoint disabled" }, { status: 404 });
  }
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await context.params;
  const resolved = resolveSafeUploadPath(key);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }
  const safeUserPrefix = `u/${user.id.replace(/[^a-zA-Z0-9-]/g, "")}/`;
  if (!resolved.safeKey.startsWith(safeUserPrefix)) {
    return NextResponse.json({ error: "Forbidden key prefix" }, { status: 403 });
  }

  const [asset] = await db
    .select({
      id: mediaAssets.id,
      mimeType: mediaAssets.mimeType,
      sizeBytes: mediaAssets.sizeBytes,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.r2Key, resolved.safeKey),
        eq(mediaAssets.userId, user.id),
        eq(mediaAssets.status, "pending"),
      ),
    )
    .limit(1);

  if (!asset) {
    return NextResponse.json({ error: "Upload token not found or already used" }, { status: 403 });
  }

  if (!req.body) {
    return NextResponse.json({ error: "Empty upload payload" }, { status: 400 });
  }

  const maxBytes = Math.min(MAX_LOCAL_BYTES, asset.sizeBytes);
  const bodyResult = await readBoundedBody(req.body, maxBytes);
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const bytes = bodyResult.buffer;
  if (!verifyFileMagicBytes(bytes, asset.mimeType)) {
    return NextResponse.json(
      { error: "Nội dung tệp không hợp lệ với định dạng đã đăng ký." },
      { status: 400 },
    );
  }

  await fs.mkdir(path.dirname(resolved.absPath), { recursive: true });
  await fs.writeFile(resolved.absPath, bytes);

  await db
    .update(mediaAssets)
    .set({ status: "confirmed", sizeBytes: bytes.byteLength })
    .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.status, "pending")));

  return NextResponse.json({ ok: true, key: resolved.safeKey, bytes: bytes.byteLength });
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  if (getEnv().STORAGE_DRIVER !== "local") {
    return NextResponse.json({ error: "Local upload endpoint disabled" }, { status: 404 });
  }
  const { key } = await context.params;
  const resolved = resolveSafeUploadPath(key);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  try {
    const [realRoot, realTarget] = await Promise.all([
      fs.realpath(LOCAL_UPLOAD_ROOT),
      fs.realpath(resolved.absPath),
    ]);
    if (!realTarget.startsWith(`${realRoot}${path.sep}`)) {
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
