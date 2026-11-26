import { describe, expect, it } from "vitest";
import { buildVietQrPayload, crc16CcittFalse, tlv, VIETNAM_BANKS } from "@/modules/vietqr";

describe("Napas EMVCo VietQR Generator", () => {
  it("computes standard CRC-16/CCITT-FALSE checksum", () => {
    expect(crc16CcittFalse("123456789")).toBe("29B1");
  });

  it("builds valid dynamic and static VietQR payloads ending with 6304 + 4-hex CRC", () => {
    const dynamicPayload = buildVietQrPayload({
      bankBin: "970436",
      accountNumber: "0123456789",
      amount: 500_000,
      description: "Mừng cưới Minh & Linh",
    });

    expect(dynamicPayload.startsWith("000201010212")).toBe(true);
    expect(dynamicPayload).toContain("A000000727");
    expect(dynamicPayload).toContain("970436");
    expect(dynamicPayload).toContain("0123456789");
    expect(dynamicPayload).toContain("5303704");
    expect(dynamicPayload).toContain("5406500000");
    expect(dynamicPayload).toContain("5802VN");
    expect(dynamicPayload).toContain("Mung cuoi Minh Linh");

    const dynamicPrefix = dynamicPayload.slice(0, -4);
    const dynamicCrc = dynamicPayload.slice(-4);
    expect(dynamicPrefix.endsWith("6304")).toBe(true);
    expect(crc16CcittFalse(dynamicPrefix)).toBe(dynamicCrc);

    const staticPayload = buildVietQrPayload({
      bankBin: "970436",
      accountNumber: "0123456789",
    });

    expect(staticPayload.startsWith("000201010211")).toBe(true);
    expect(staticPayload).toContain("A000000727");
    expect(staticPayload).toContain("5303704");
    expect(staticPayload).toContain("5802VN");
    expect(staticPayload).not.toContain("530370454");
    const staticPrefix = staticPayload.slice(0, -4);
    const staticCrc = staticPayload.slice(-4);
    expect(staticPrefix.endsWith("6304")).toBe(true);
    expect(crc16CcittFalse(staticPrefix)).toBe(staticCrc);
  });

  it("rejects invalid bank BINs and account numbers", () => {
    expect(() =>
      buildVietQrPayload({ bankBin: "123", accountNumber: "0123456789" }),
    ).toThrow();
    expect(() =>
      buildVietQrPayload({ bankBin: "970436", accountNumber: "12" }),
    ).toThrow();
    expect(VIETNAM_BANKS.length).toBeGreaterThanOrEqual(10);
  });

  it("throws explicit Error on invalid amounts", () => {
    for (const invalidAmount of [
      -100,
      0,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      12.5,
      1_000_000_000_000,
    ]) {
      expect(() =>
        buildVietQrPayload({
          bankBin: "970436",
          accountNumber: "0123456789",
          amount: invalidAmount,
        }),
      ).toThrow(/amount must be a positive integer/);
    }
  });

  it("throws explicit Error when TLV value exceeds 99 UTF-8 bytes", () => {
    expect(() => tlv("08", "a".repeat(100))).toThrow(/TLV field 08 exceeds 99 bytes/);
    // 50 multi-byte UTF-8 characters = 100 bytes > 99
    expect(() => tlv("08", "đ".repeat(50))).toThrow(/TLV field 08 exceeds 99 bytes/);
    expect(tlv("08", "a".repeat(99))).toBe(`0899${"a".repeat(99)}`);
  });

  it("sanitizes Vietnamese Đ/đ, strips special symbols, and omits empty descriptions", () => {
    const payload = buildVietQrPayload({
      bankBin: "970436",
      accountNumber: "0123456789",
      description: "Đám cưới Đông Đô & Ngọc Linh @ 2026!!!",
    });
    expect(payload).toContain("Dam cuoi Dong Do Ngoc Linh 2026");

    const emptyAfterSanitize = buildVietQrPayload({
      bankBin: "970436",
      accountNumber: "0123456789",
      description: "!!! @@@ ### ---",
    });
    const withoutDescription = buildVietQrPayload({
      bankBin: "970436",
      accountNumber: "0123456789",
    });
    expect(emptyAfterSanitize).toBe(withoutDescription);
  });
});
