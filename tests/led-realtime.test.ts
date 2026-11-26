import { describe, expect, it } from "vitest";
import {
  allocateLuckyTicket,
  containsBlockedWord,
  normalizeForFilter,
  pickLuckyDrawWinner,
} from "@/modules/led-realtime";

describe("LED Realtime Moderation & Lucky Draw Helpers", () => {
  it("normalizes Vietnamese diacritics and đ/Đ cleanly", () => {
    expect(normalizeForFilter("  Đám Cưới   Đông Đủ  ")).toBe("dam cuoi dong du");
  });

  it("detects normalized Vietnamese/English blocked words and custom blocked words", () => {
    // Vietnamese & English profanity + spam terms
    expect(containsBlockedWord("Đụ má tụi bay")).toBe(true);
    expect(containsBlockedWord("Địt Mẹ bọn này")).toBe(true);
    expect(containsBlockedWord("Quá VCL luôn")).toBe(true);
    expect(containsBlockedWord("What the FUCK is this")).toBe(true);
    expect(containsBlockedWord("Vào ngay nhà cái uy tín nhận thưởng")).toBe(true);
    expect(containsBlockedWord("Link nhận quà https://spam.example.com")).toBe(true);
    expect(containsBlockedWord("Truy cập bit.ly/abc123")).toBe(true);

    // Custom blocked words (including Vietnamese diacritics)
    expect(containsBlockedWord("Mời mọi người ghé Tiệm Vàng ABC", ["tiệm vàng"])).toBe(true);
    expect(containsBlockedWord("Quảng cáo sản phẩm XYZ", ["quang cao"])).toBe(true);
  });

  it("passes warm Vietnamese wedding wishes without false positives", () => {
    const cleanWishes = [
      "Chúc mừng hạnh phúc trăm năm hai bạn Minh & Linh!",
      "Chúc cô dâu chú rể sớm có tin vui, đầu bạc răng long.",
      "Mong các bạn luôn vui vẻ, thành công lớn trong chặng đường mới!",
      "Đám cưới thật ấm áp và rực rỡ, chúc gia đình hai bên vạn sự như ý.",
    ];

    for (const wish of cleanWishes) {
      expect(containsBlockedWord(wish)).toBe(false);
    }
  });

  it("allocates zero-padded lucky ticket numbers #0001..#9999", () => {
    expect(allocateLuckyTicket(1)).toBe("#0001");
    expect(allocateLuckyTicket(42)).toBe("#0042");
    expect(allocateLuckyTicket(9999)).toBe("#9999");
    expect(allocateLuckyTicket(0)).toBe("#0000");
    expect(allocateLuckyTicket(-5)).toBe("#0000");
    expect(allocateLuckyTicket(10000)).toBe("#10000");
  });

  it("picks a valid lucky draw winner or null when candidate list is empty", () => {
    expect(pickLuckyDrawWinner([])).toBeNull();

    const single = [{ ticketNumber: "#0001", guestName: "Nguyễn Văn An" }];
    expect(pickLuckyDrawWinner(single)).toEqual(single[0]);

    const candidates = [
      { ticketNumber: "#0001", guestName: "Nguyễn Văn An" },
      { ticketNumber: "#0002", guestName: "Trần Thị Bình" },
      { ticketNumber: "#0003", guestName: "Lê Hoàng Nam" },
    ];
    for (let i = 0; i < 20; i += 1) {
      const winner = pickLuckyDrawWinner(candidates);
      expect(winner).not.toBeNull();
      expect(candidates).toContainEqual(winner);
    }
  });
});
