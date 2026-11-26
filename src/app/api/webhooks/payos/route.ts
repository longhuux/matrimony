import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { BillingError, settlePaidOrder, verifyPayosSignature } from "@/modules/billing/payos";

/**
 * Receives PayOS payment webhook callbacks, verifies HMAC-SHA256 signatures, and settles orders idempotently.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (rawBody === null || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return NextResponse.json({ error: "Invalid webhook body" }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const dataObj =
    body.data !== null && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body;

  const env = getEnv();
  const checksumKey = env.PAYOS_CHECKSUM_KEY?.trim();
  const headerSig = req.headers.get("x-payos-signature")?.trim();
  const bodySig = typeof body.signature === "string" ? body.signature.trim() : "";
  const signature = headerSig || bodySig;

  if (env.NODE_ENV === "production" && !checksumKey) {
    return NextResponse.json(
      { error: "PAYOS_CHECKSUM_KEY is required in production" },
      { status: 401 },
    );
  }

  if (checksumKey) {
    const signedObject = { ...dataObj };
    if (dataObj === body) {
      delete signedObject.signature;
    }

    if (!signature || !verifyPayosSignature(signedObject, signature, checksumKey)) {
      return NextResponse.json({ error: "Invalid PayOS webhook signature" }, { status: 401 });
    }
  }

  const rawOrderCode = dataObj.orderCode ?? body.orderCode;
  const orderCode =
    typeof rawOrderCode === "string" || typeof rawOrderCode === "number"
      ? String(rawOrderCode).trim()
      : "";

  if (!orderCode) {
    return NextResponse.json({ error: "Missing orderCode in webhook payload" }, { status: 400 });
  }

  const rawTxId =
    dataObj.reference ??
    dataObj.paymentLinkId ??
    dataObj.id ??
    body.id ??
    `payos-${orderCode}-${signature.slice(0, 12) || "unsigned"}`;

  try {
    const result = await settlePaidOrder({
      orderCode,
      provider: "payos",
      providerTxId: String(rawTxId),
      rawPayload: body,
    });
    return NextResponse.json({ ok: true, alreadyProcessed: result.alreadyProcessed });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
