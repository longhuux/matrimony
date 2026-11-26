import { describe, expect, it } from "vitest";
import { escapeCsvCell, parseGuestCsv, toCsvWithBom } from "@/lib/csv";

describe("CSV Sanitization, BOM Export & Guest Parsing", () => {
  it("neutralizes spreadsheet formula injection prefixes including after leading whitespace", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe(`"'=SUM(A1:A2)"`);
    expect(escapeCsvCell("+123456")).toBe(`"'+123456"`);
    expect(escapeCsvCell("-100")).toBe(`"'-100"`);
    expect(escapeCsvCell("@evil")).toBe(`"'@evil"`);
    expect(escapeCsvCell("\t=cmd|' /C calc'!A0")).toBe(`"'\t=cmd|' /C calc'!A0"`);
    expect(escapeCsvCell("\r=1+1")).toBe(`"'\r=1+1"`);
    expect(escapeCsvCell("   =HYPERLINK(\"https://evil.example\")")).toBe(
      `"'   =HYPERLINK(""https://evil.example"")"`,
    );
    expect(escapeCsvCell("  +cmd")).toBe(`"'  +cmd"`);
    expect(escapeCsvCell("Nguyễn Văn Minh")).toBe(`"Nguyễn Văn Minh"`);
    expect(escapeCsvCell('Anh "Tý"')).toBe(`"Anh ""Tý"""`);
    expect(escapeCsvCell(null)).toBe(`""`);
    expect(escapeCsvCell(undefined)).toBe(`""`);
  });

  it("prefixes UTF-8 BOM and joins rows with CRLF in toCsvWithBom()", () => {
    const csv = toCsvWithBom(
      ["Họ tên", "Lời chúc"],
      [
        ["Nguyễn Minh", "Chúc hạnh phúc"],
        ["=1+1", "An toàn"],
      ],
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toEqual([
      `"Họ tên","Lời chúc"`,
      `"Nguyễn Minh","Chúc hạnh phúc"`,
      `"'=1+1","An toàn"`,
    ]);
  });

  it("parses Vietnamese CSV with semicolon delimiter and BOM cleanly", () => {
    const rawCsv = [
      "\uFEFFHọ và tên;Xưng hô;Nhóm;Nhà;Lời mời",
      "Nguyễn Văn An;Anh;Đồng nghiệp;Nhà trai;Trân trọng kính mời anh dự tiệc!",
      "Trần Thị Bình;Chị;Bạn đại học;Nhà gái;Hẹn gặp chị tại buổi lễ nhé",
      "Lê Hoàng Nam;Bạn;Cấp 3;Cả hai;Chung vui cùng tụi mình",
    ].join("\n");

    const parsed = parseGuestCsv(rawCsv);
    expect(parsed).toEqual([
      {
        fullName: "Nguyễn Văn An",
        salutation: "Anh",
        groupName: "Đồng nghiệp",
        guestSide: "groom",
        greeting: "Trân trọng kính mời anh dự tiệc!",
      },
      {
        fullName: "Trần Thị Bình",
        salutation: "Chị",
        groupName: "Bạn đại học",
        guestSide: "bride",
        greeting: "Hẹn gặp chị tại buổi lễ nhé",
      },
      {
        fullName: "Lê Hoàng Nam",
        salutation: "Bạn",
        groupName: "Cấp 3",
        guestSide: "both",
        greeting: "Chung vui cùng tụi mình",
      },
    ]);
  });

  it("parses English CSV with comma delimiter, quoted values, and defaults", () => {
    const rawCsv = [
      'fullName,salutation,groupName,guestSide,greeting',
      '"Pham, Quoc Bao",Mr.,VIP,groom,"Welcome to our ""Big Day"", Bao!"',
      'Hoang Mai,,,,',
    ].join("\r\n");

    const parsed = parseGuestCsv(rawCsv);
    expect(parsed).toEqual([
      {
        fullName: "Pham, Quoc Bao",
        salutation: "Mr.",
        groupName: "VIP",
        guestSide: "groom",
        greeting: 'Welcome to our "Big Day", Bao!',
      },
      {
        fullName: "Hoang Mai",
        salutation: "Bạn",
        groupName: "ban-be",
        guestSide: "groom",
        greeting: "",
      },
    ]);
  });
});
