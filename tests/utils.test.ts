import { describe, expect, it } from "vitest";
import { formatVnd, slugify } from "@/lib/utils";

describe("Utility Helpers", () => {
  it("slugifies Vietnamese text including Đ/đ and trims trailing hyphens after truncation", () => {
    expect(slugify("Đám cưới Đông Đô & Ngọc Linh!")).toBe("dam-cuoi-dong-do-ngoc-linh");
    expect(slugify("---   Thiệp Cưới   ---")).toBe("thiep-cuoi");

    // 59 'a' chars + space + 'bbbbb' becomes 59 'a' chars + '-' at char 60 before trim
    const boundaryInput = `${"a".repeat(59)} bbbbb`;
    const slug = slugify(boundaryInput);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("a".repeat(59));
  });

  it("formats VND amounts and returns 0đ for non-positive or non-finite values", () => {
    expect(formatVnd(0)).toBe("0đ");
    expect(formatVnd(-50)).toBe("0đ");
    expect(formatVnd(Number.NaN)).toBe("0đ");
    expect(formatVnd(Number.POSITIVE_INFINITY)).toBe("0đ");
    expect(formatVnd(Number.NEGATIVE_INFINITY)).toBe("0đ");
    expect(formatVnd(149_000)).toBe("149.000đ");
    expect(formatVnd(1_250_000)).toBe("1.250.000đ");
  });
});
