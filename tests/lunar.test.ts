import { describe, expect, it } from "vitest";
import { isoDateToLunar, solarToLunar } from "@/modules/invitation-engine/lunar";

describe("Vietnamese Solar-to-Lunar Calendar (UTC+7)", () => {
  it("converts Tet 2024 (2024-02-10) to 1/1 Giap Thin", () => {
    const lunar = solarToLunar(2024, 2, 10);
    expect(lunar.day).toBe(1);
    expect(lunar.month).toBe(1);
    expect(lunar.year).toBe(2024);
    expect(lunar.isLeap).toBe(false);
    expect(lunar.canChiYear).toBe("Giáp Thìn");
  });

  it("converts Tet 2025 (2025-01-29) to 1/1 At Ty", () => {
    const lunar = solarToLunar(2025, 1, 29);
    expect(lunar.day).toBe(1);
    expect(lunar.month).toBe(1);
    expect(lunar.year).toBe(2025);
    expect(lunar.canChiYear).toBe("Ất Tỵ");
  });

  it("converts Tet 2026 (2026-02-17) to 1/1 Binh Ngo", () => {
    const lunar = isoDateToLunar("2026-02-17");
    expect(lunar).not.toBeNull();
    expect(lunar?.day).toBe(1);
    expect(lunar?.month).toBe(1);
    expect(lunar?.year).toBe(2026);
    expect(lunar?.canChiYear).toBe("Bính Ngọ");
    expect(lunar?.formatted).toContain("Bính Ngọ");
  });

  it("accurately computes leap months across 2017, 2020, 2023, 2025, and 2028", () => {
    const cases = [
      {
        iso: "2017-07-23",
        day: 1,
        month: 6,
        year: 2017,
        canChiYear: "Đinh Dậu",
        formatted: "Ngày 1 tháng 6 (nhuận) năm Đinh Dậu",
      },
      {
        iso: "2020-05-23",
        day: 1,
        month: 4,
        year: 2020,
        canChiYear: "Canh Tý",
        formatted: "Ngày 1 tháng 4 (nhuận) năm Canh Tý",
      },
      {
        iso: "2023-03-22",
        day: 1,
        month: 2,
        year: 2023,
        canChiYear: "Quý Mão",
        formatted: "Ngày 1 tháng 2 (nhuận) năm Quý Mão",
      },
      {
        iso: "2023-04-06",
        day: 16,
        month: 2,
        year: 2023,
        canChiYear: "Quý Mão",
        formatted: "Ngày 16 tháng 2 (nhuận) năm Quý Mão",
      },
      {
        iso: "2025-07-25",
        day: 1,
        month: 6,
        year: 2025,
        canChiYear: "Ất Tỵ",
        formatted: "Ngày 1 tháng 6 (nhuận) năm Ất Tỵ",
      },
      {
        iso: "2028-06-23",
        day: 1,
        month: 5,
        year: 2028,
        canChiYear: "Mậu Thân",
        formatted: "Ngày 1 tháng 5 (nhuận) năm Mậu Thân",
      },
    ];

    for (const c of cases) {
      const lunar = isoDateToLunar(c.iso);
      expect(lunar).not.toBeNull();
      expect(lunar?.day).toBe(c.day);
      expect(lunar?.month).toBe(c.month);
      expect(lunar?.year).toBe(c.year);
      expect(lunar?.isLeap).toBe(true);
      expect(lunar?.canChiYear).toBe(c.canChiYear);
      expect(lunar?.formatted).toBe(c.formatted);
    }
  });

  it("returns null for invalid Gregorian calendar dates and malformed ISO strings", () => {
    expect(isoDateToLunar("2026-02-31")).toBeNull();
    expect(isoDateToLunar("2025-02-29")).toBeNull();
    expect(isoDateToLunar("2026-13-01")).toBeNull();
    expect(isoDateToLunar("not-a-date")).toBeNull();
    expect(isoDateToLunar("2026/02/17")).toBeNull();
    expect(isoDateToLunar("invalid")).toBeNull();
    expect(() => solarToLunar(2026, 2, 31)).toThrow(RangeError);
  });

  it("keeps Can Chi modulo indices non-negative for old and edge years", () => {
    const yearOne = solarToLunar(1, 1, 1);
    expect(yearOne.year).toBe(0);
    expect(yearOne.canChiYear).toBe("Canh Thân");
    expect(yearOne.canChiYear).not.toContain("undefined");
    expect(yearOne.canChiMonth).not.toContain("undefined");
    expect(yearOne.canChiDay).not.toContain("undefined");

    const yearTwo = solarToLunar(2, 2, 1);
    expect(yearTwo.canChiYear).toBe("Nhâm Tuất");
    expect(yearTwo.canChiMonth).not.toContain("undefined");
    expect(yearTwo.canChiDay).not.toContain("undefined");

    const yearFour = solarToLunar(4, 6, 15);
    expect(yearFour.canChiYear).toBe("Giáp Tý");
    expect(yearFour.canChiMonth).not.toContain("undefined");
    expect(yearFour.canChiDay).not.toContain("undefined");
  });
});
