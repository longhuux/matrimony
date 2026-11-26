import { describe, expect, it } from "vitest";
import { buildWeddingIcs } from "@/modules/invitation-engine/ics";

describe("Wedding ICS Calendar Generator", () => {
  it("outputs RFC 5545 VCALENDAR/VEVENT with CRLF line endings and UTC+7 -> UTC conversion", () => {
    const ics = buildWeddingIcs({
      title: "Lễ Thành Hôn Minh & Linh",
      date: "2026-02-17",
      time: "11:00",
      venueName: "Trung tâm Tiệc cưới Lotus",
      venueAddress: "123 Lê Lợi, Hà Nội",
      description: "Hân hạnh đón tiếp quý khách.",
      url: "https://matrimony.vn/i/minh-linh",
    });

    // Strictly uses CRLF (\r\n) with no bare LF
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");

    const lines = ics.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("CALSCALE:GREGORIAN");
    expect(lines).toContain("METHOD:PUBLISH");
    expect(lines).toContain("BEGIN:VEVENT");
    // 11:00 Asia/Ho_Chi_Minh (UTC+7) == 04:00 UTC; +3h duration == 07:00 UTC
    expect(lines).toContain("DTSTART:20260217T040000Z");
    expect(lines).toContain("DTEND:20260217T070000Z");
    expect(lines).toContain("SUMMARY:Lễ Thành Hôn Minh & Linh");
    expect(lines).toContain("LOCATION:Trung tâm Tiệc cưới Lotus — 123 Lê Lợi\\, Hà Nội");
    expect(lines).toContain("DESCRIPTION:Hân hạnh đón tiếp quý khách.");
    expect(lines).toContain("URL:https://matrimony.vn/i/minh-linh");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain("END:VEVENT");
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
  });

  it("supports DD/MM/YYYY date format and handles UTC day rollover cleanly", () => {
    const ics = buildWeddingIcs({
      title: "Lễ Vu Quy",
      date: "01/03/2026",
      time: "02:30",
    });

    // 02:30 UTC+7 on 2026-03-01 == 19:30 UTC on 2026-02-28
    expect(ics).toContain("DTSTART:20260228T193000Z");
    expect(ics).toContain("DTEND:20260228T223000Z");
  });

  it("escapes backslashes, commas, semicolons, and newlines per RFC 5545", () => {
    const ics = buildWeddingIcs({
      title: "Tiệc Cưới; Minh, Linh \\ Gia Đình",
      date: "2026-05-20",
      time: "18:00",
      venueName: "Sảnh A, Tầng 2",
      venueAddress: "Quận 1; TP.HCM",
      description: "Đón khách lúc 17:30\r\nKhai tiệc lúc 18:00\nTrang phục: Lịch sự, trang nhã",
    });

    expect(ics).toContain("SUMMARY:Tiệc Cưới\\; Minh\\, Linh \\\\ Gia Đình");
    expect(ics).toContain("LOCATION:Sảnh A\\, Tầng 2 — Quận 1\\; TP.HCM");
    expect(ics).toContain(
      "DESCRIPTION:Đón khách lúc 17:30\\nKhai tiệc lúc 18:00\\nTrang phục: Lịch sự\\, trang nhã",
    );
  });
});
