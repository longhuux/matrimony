import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { fetchLedPublicFeed, getLedChannel } from "@/modules/led-realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  const initialFeed = await fetchLedPublicFeed(slug);
  if (!initialFeed) {
    return NextResponse.json({ error: "Không tìm thấy phiên LED." }, { status: 404 });
  }

  const initPayload = {
    invitation: initialFeed.invitation,
    session: initialFeed.session,
    approved: initialFeed.approved,
  };

  const encoder = new TextEncoder();
  let cleanupRef: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      const sub = getRedis().duplicate();
      sub.on("error", () => {
        // Keep SSE stream alive with heartbeats even if Redis momentarily drops.
      });

      const safeEnqueue = (chunk: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const cleanup = (): void => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        req.signal.removeEventListener("abort", cleanup);
        sub.removeAllListeners("message");
        void sub.unsubscribe().catch(() => {});
        sub.disconnect();
        try {
          controller.close();
        } catch {
          // Stream may already be closed.
        }
      };

      cleanupRef = cleanup;
      req.signal.addEventListener("abort", cleanup);

      safeEnqueue(`event: init\ndata: ${JSON.stringify(initPayload)}\n\n`);

      sub.on("message", (_channel, message) => {
        let eventType = "message";
        try {
          const parsed = JSON.parse(message) as { type?: unknown };
          if (typeof parsed.type === "string" && parsed.type.length > 0) {
            eventType = parsed.type;
          }
        } catch {
          // Forward raw payload as generic message event.
        }
        safeEnqueue(`event: ${eventType}\ndata: ${message}\n\n`);
      });

      try {
        if (sub.status === "wait") {
          await sub.connect();
        }
        if (!closed) {
          await sub.subscribe(getLedChannel(slug));
        }
      } catch (err) {
        console.warn(
          "[led-stream] Redis Pub/Sub unavailable, degrading to heartbeat-only SSE:",
          err instanceof Error ? err.message : err,
        );
      }

      if (!closed) {
        heartbeatTimer = setInterval(() => {
          safeEnqueue(": heartbeat\n\n");
        }, HEARTBEAT_INTERVAL_MS);
      }
    },
    cancel() {
      cleanupRef?.();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
