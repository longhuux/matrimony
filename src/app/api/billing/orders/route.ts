import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { BillingError, settlePaidOrder } from "@/modules/billing/payos";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";

const testSettleSchema = z.object({
  orderCode: z.string().trim().min(1).max(80),
});

/**
 * Returns the authenticated user's order history and effective plan details.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const config = getPlanConfig(effectivePlan);

  return NextResponse.json({
    orders: rows,
    plan: {
      current: user.plan,
      effective: effectivePlan,
      expiresAt: user.planExpiresAt,
      aiCredits: user.aiCredits,
      config,
    },
  });
}

/**
 * Development-only instant order settlement endpoint (explicitly disabled in production or when PayOS keys are live).
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const env = getEnv();
  if (env.NODE_ENV === "production" || Boolean(env.PAYOS_CHECKSUM_KEY?.trim())) {
    return NextResponse.json(
      { error: "Thanh toán thử nghiệm bị vô hiệu hóa khi đang chạy production hoặc PayOS live." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = testSettleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Mã đơn hàng không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [ownedOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.orderCode, parsed.data.orderCode), eq(orders.userId, user.id)))
    .limit(1);

  if (!ownedOrder) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  }

  try {
    const result = await settlePaidOrder({
      orderCode: parsed.data.orderCode,
      provider: "sandbox",
      providerTxId: `sandbox-${parsed.data.orderCode}`,
      rawPayload: {
        orderCode: parsed.data.orderCode,
        settledBy: user.id,
        mode: "sandbox",
      },
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
