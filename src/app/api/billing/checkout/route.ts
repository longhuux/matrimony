import crypto from "node:crypto";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { getPlanConfig } from "@/modules/billing/plans";
import { buildVietQrPayload } from "@/modules/vietqr";

const checkoutSchema = z.object({
  sku: z.enum(["pro", "combo", "studio_pilot"]),
});

const PLATFORM_RECEIVER_BIN = "970422"; // MB Bank
const PLATFORM_RECEIVER_ACCOUNT = "0909000999";

/**
 * Creates a billing checkout order and returns a VietQR payment payload and QR data URL.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Gói nâng cấp không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const planCfg = getPlanConfig(parsed.data.sku);
  if (planCfg.priceVnd <= 0) {
    return NextResponse.json({ error: "Gói này không yêu cầu thanh toán." }, { status: 400 });
  }

  const env = getEnv();
  const sandboxMode = !env.PAYOS_CHECKSUM_KEY || !env.PAYOS_CLIENT_ID || !env.PAYOS_API_KEY;
  const orderCode = `MTR-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const qrPayload = buildVietQrPayload({
    bankBin: PLATFORM_RECEIVER_BIN,
    accountNumber: PLATFORM_RECEIVER_ACCOUNT,
    amount: planCfg.priceVnd,
    description: orderCode,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 320,
    margin: 2,
  });

  const checkoutUrl = `${env.APP_URL.replace(/\/$/, "")}/dashboard/billing?order=${encodeURIComponent(orderCode)}`;

  const [order] = await db
    .insert(orders)
    .values({
      userId: user.id,
      orderCode,
      sku: planCfg.sku,
      amountVnd: planCfg.priceVnd,
      status: "pending",
      provider: "payos",
      checkoutUrl,
      expiresAt,
    })
    .returning();

  return NextResponse.json(
    {
      order,
      qrPayload,
      qrDataUrl,
      sandboxMode,
    },
    { status: 201 },
  );
}
