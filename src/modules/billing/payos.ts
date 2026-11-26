import crypto from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiCreditLedger, orders, paymentWebhooks, users } from "@/db/schema";
import { getPlanConfig, type PlanTier } from "@/modules/billing/plans";

/**
 * Typed billing error carrying an HTTP status code.
 */
export class BillingError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "BillingError";
    this.statusCode = statusCode;
  }
}

/**
 * Returns a new object with top-level keys sorted alphabetically (PayOS signature convention).
 */
export function sortObjDataByKey(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return sorted;
}

function serializePayosValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? sortObjDataByKey(item as Record<string, unknown>)
          : item,
      ),
    );
  }
  if (typeof value === "object") {
    return JSON.stringify(sortObjDataByKey(value as Record<string, unknown>));
  }
  return String(value);
}

/**
 * Computes the PayOS HMAC-SHA256 hex signature over sorted `key=value&...` pairs.
 */
export function signPayosWebhook(data: Record<string, unknown>, checksumKey: string): string {
  const sorted = sortObjDataByKey(data);
  const queryString = Object.keys(sorted)
    .map((key) => `${key}=${serializePayosValue(sorted[key])}`)
    .join("&");

  return crypto.createHmac("sha256", checksumKey).update(queryString).digest("hex");
}

/**
 * Verifies a PayOS HMAC-SHA256 signature in constant time using `crypto.timingSafeEqual`.
 */
export function verifyPayosSignature(
  data: Record<string, unknown>,
  signature: string,
  checksumKey: string,
): boolean {
  const cleanedSig = signature.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(cleanedSig) || !checksumKey) {
    return false;
  }

  const expectedHex = signPayosWebhook(data, checksumKey).toLowerCase();
  const actualBuf = Buffer.from(cleanedSig, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  return actualBuf.length === expectedBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function addMonths(baseDate: Date, months: number): Date {
  const next = new Date(baseDate.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export interface SettlePaidOrderInput {
  orderCode: string;
  provider: string;
  providerTxId: string;
  rawPayload: Record<string, unknown>;
}

export interface SettlePaidOrderResult {
  ok: true;
  alreadyProcessed: boolean;
  orderId: string;
  plan?: PlanTier;
  aiCredits?: number;
}

/**
 * Idempotently settles a paid order inside a database transaction, upgrading the user's plan and AI credits.
 */
export async function settlePaidOrder(input: SettlePaidOrderInput): Promise<SettlePaidOrderResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.orderCode, input.orderCode))
      .limit(1);

    if (!order) {
      throw new BillingError(`Không tìm thấy đơn hàng ${input.orderCode}.`, 404);
    }

    const [insertedWebhook] = await tx
      .insert(paymentWebhooks)
      .values({
        orderId: order.id,
        provider: input.provider,
        providerTxId: input.providerTxId,
        rawPayload: input.rawPayload,
      })
      .onConflictDoNothing({ target: paymentWebhooks.providerTxId })
      .returning({ id: paymentWebhooks.id });

    if (!insertedWebhook || order.status === "paid") {
      return {
        ok: true,
        alreadyProcessed: true,
        orderId: order.id,
      };
    }

    const now = new Date();
    const [updatedOrder] = await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt: now,
      })
      .where(and(eq(orders.id, order.id), ne(orders.status, "paid")))
      .returning({ id: orders.id });

    if (!updatedOrder) {
      return {
        ok: true,
        alreadyProcessed: true,
        orderId: order.id,
      };
    }

    const planCfg = getPlanConfig(order.sku);
    const [currentUser] = await tx
      .select({
        id: users.id,
        planExpiresAt: users.planExpiresAt,
      })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);

    if (!currentUser) {
      throw new BillingError("Không tìm thấy tài khoản người dùng của đơn hàng.", 404);
    }

    const extensionBase =
      currentUser.planExpiresAt && currentUser.planExpiresAt.getTime() > now.getTime()
        ? currentUser.planExpiresAt
        : now;
    const nextPlanExpiresAt = addMonths(extensionBase, planCfg.durationMonths);

    const [updatedUser] = await tx
      .update(users)
      .set({
        plan: planCfg.sku,
        planExpiresAt: nextPlanExpiresAt,
        aiCredits: sql`${users.aiCredits} + ${planCfg.aiCreditsGrant}`,
        updatedAt: now,
      })
      .where(eq(users.id, order.userId))
      .returning({ aiCredits: users.aiCredits });

    await tx.insert(aiCreditLedger).values({
      userId: order.userId,
      delta: planCfg.aiCreditsGrant,
      balanceAfter: updatedUser.aiCredits,
      reason: "plan_upgrade",
      refId: order.orderCode,
    });

    return {
      ok: true,
      alreadyProcessed: false,
      orderId: order.id,
      plan: planCfg.sku,
      aiCredits: updatedUser.aiCredits,
    };
  });
}
