import { describe, expect, it } from "vitest";
import { signPayosWebhook, verifyPayosSignature } from "@/modules/billing/payos";

describe("PayOS Webhook Signing & Verification", () => {
  const checksumKey = "payos_test_checksum_secret_key_2026";

  it("verifies valid HMAC-SHA256 signatures regardless of input key ordering", () => {
    const payloadOrderA = {
      orderCode: 20260217001,
      amount: 399_000,
      description: "MATRIMONY PRO",
      accountNumber: "0123456789",
      reference: "FT26048123456",
      transactionDateTime: "2026-02-17 11:00:00",
      currency: "VND",
      paymentLinkId: "plink_abc123",
      code: "00",
      desc: "success",
      meta: { plan: "pro", months: 12 },
    };

    const payloadOrderB = {
      desc: "success",
      code: "00",
      meta: { months: 12, plan: "pro" },
      paymentLinkId: "plink_abc123",
      currency: "VND",
      transactionDateTime: "2026-02-17 11:00:00",
      reference: "FT26048123456",
      accountNumber: "0123456789",
      description: "MATRIMONY PRO",
      amount: 399_000,
      orderCode: 20260217001,
    };

    const sigA = signPayosWebhook(payloadOrderA, checksumKey);
    const sigB = signPayosWebhook(payloadOrderB, checksumKey);

    expect(sigA).toMatch(/^[0-9a-f]{64}$/);
    expect(sigB).toBe(sigA);
    expect(verifyPayosSignature(payloadOrderB, sigA, checksumKey)).toBe(true);
    expect(verifyPayosSignature(payloadOrderA, `  ${sigA.toUpperCase()}  `, checksumKey)).toBe(true);
  });

  it("returns false when amount, orderCode, or checksumKey is tampered", () => {
    const baseData = {
      orderCode: 99887766,
      amount: 599_000,
      description: "Thanh toan goi VIP",
      code: "00",
    };

    const signature = signPayosWebhook(baseData, checksumKey);

    expect(verifyPayosSignature({ ...baseData, amount: 1_000 }, signature, checksumKey)).toBe(false);
    expect(verifyPayosSignature({ ...baseData, orderCode: 99887765 }, signature, checksumKey)).toBe(
      false,
    );
    expect(verifyPayosSignature(baseData, signature, "wrong-checksum-key")).toBe(false);
    expect(verifyPayosSignature(baseData, signature, "")).toBe(false);
  });

  it("returns false on wrong-length or non-hex signatures", () => {
    const data = { orderCode: 12345, amount: 199_000 };
    const validSig = signPayosWebhook(data, checksumKey);

    expect(verifyPayosSignature(data, validSig.slice(0, 62), checksumKey)).toBe(false);
    expect(verifyPayosSignature(data, `${validSig}00`, checksumKey)).toBe(false);
    expect(verifyPayosSignature(data, "z".repeat(64), checksumKey)).toBe(false);
    expect(verifyPayosSignature(data, "", checksumKey)).toBe(false);
  });
});
