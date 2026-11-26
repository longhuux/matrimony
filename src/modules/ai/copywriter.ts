import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiCreditLedger, users } from "@/db/schema";
import { getEnv } from "@/lib/env";

export type CopywriterTone = "romantic" | "formal" | "playful";

export interface CopywriterInput {
  groomName: string;
  brideName: string;
  tone: CopywriterTone;
  meetingStory?: string;
  weddingDate?: string;
  venueName?: string;
}

export interface GeneratedWeddingCopy {
  headline: string;
  badge: string;
  storyTitle: string;
  milestones: Array<{ year: string; caption: string }>;
  inviteMessage: string;
  wishPrompt: string;
  provider: "gemini" | "curated-vn";
}

/**
 * Error thrown when an authenticated user lacks sufficient AI credits.
 */
export class AiCreditError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "AiCreditError";
    this.statusCode = statusCode;
  }
}

const geminiCopyResponseSchema = z.object({
  headline: z.string().min(1).max(120),
  badge: z.string().min(1).max(80),
  storyTitle: z.string().min(1).max(100),
  milestones: z
    .array(
      z.object({
        year: z.string().min(1).max(40),
        caption: z.string().min(1).max(260),
      }),
    )
    .min(2)
    .max(5),
  inviteMessage: z.string().min(1).max(500),
  wishPrompt: z.string().min(1).max(160),
});

function buildCuratedVietnameseCopy(input: CopywriterInput): GeneratedWeddingCopy {
  const groom = input.groomName.trim() || "Chú Rể";
  const bride = input.brideName.trim() || "Cô Dâu";
  const storySnippet = input.meetingStory?.trim();
  const venue = input.venueName?.trim();
  const dateText = input.weddingDate?.trim();

  const venueClause = venue ? ` tại ${venue}` : "";
  const dateClause = dateText ? ` vào ngày ${dateText}` : "";

  if (input.tone === "formal") {
    return {
      headline: `${groom} & ${bride}`,
      badge: "Trân Trọng Kính Mời",
      storyTitle: "Hành Trình Hạnh Phúc",
      milestones: [
        {
          year: "Khởi Đầu Duyên Phận",
          caption: storySnippet
            ? `${storySnippet} — cơ duyên đẹp đưa ${groom} và ${bride} đến bên nhau.`
            : `Cuộc gặp gỡ định mệnh đã mở ra chương mới đầy trân quý cho ${groom} và ${bride}.`,
        },
        {
          year: "Gắn Kết Yêu Thương",
          caption: "Cùng nhau vun đắp niềm tin, sẻ chia từng chặng đường trưởng thành.",
        },
        {
          year: dateText || "Ngày Thành Hôn",
          caption: `Hai gia đình hân hoan đón tiếp quý khách${venueClause}${dateClause}.`,
        },
      ],
      inviteMessage: `Gia đình hai bên trân trọng kính mời quý vị đến chung vui cùng ${groom} và ${bride}${venueClause}${dateClause}. Sự hiện diện của quý khách là niềm vinh hạnh lớn của chúng tôi.`,
      wishPrompt: "Kính mời quý khách gửi lời chúc phúc tốt đẹp nhất đến đôi uyên ương.",
      provider: "curated-vn",
    };
  }

  if (input.tone === "playful") {
    return {
      headline: `${groom} ♥ ${bride}`,
      badge: "Chính Thức Về Chung Một Nhà!",
      storyTitle: "Từ Người Lạ Thành Bạn Đời",
      milestones: [
        {
          year: "Tập 1: Gặp Nhau",
          caption: storySnippet
            ? `${storySnippet} — ai ngờ từ khoảnh khắc đó lại dính nhau luôn tới giờ!`
            : `Một ánh nhìn lướt qua, vài câu chuyện vu vơ, thế là ${groom} & ${bride} chốt đơn tim nhau.`,
        },
        {
          year: "Tập 2: Say Yes!",
          caption: "Trải qua đủ mọi kèo ăn uống, du lịch và giận dỗi dễ thương để cùng về một đội.",
        },
        {
          year: dateText || "Tập Đặc Biệt",
          caption: `Lên đồ thật xinh để cùng nâng ly quẩy hết mình${venueClause}${dateClause} nhé!`,
        },
      ],
      inviteMessage: `Cuối cùng ngày này cũng tới! ${groom} & ${bride} chính thức mở tiệc${venueClause}${dateClause}. Thiếu bạn là tiệc mất vui một nửa đó nha!`,
      wishPrompt: "Thả ngay một lời chúc thật chất hoặc kèo đòi quà cho tụi mình nhé!",
      provider: "curated-vn",
    };
  }

  // Default: "romantic"
  return {
    headline: `${groom} & ${bride}`,
    badge: "Trân Trọng Báo Tin Hỷ",
    storyTitle: "Chuyện Chúng Mình",
    milestones: [
      {
        year: "Lần Đầu Gặp Gỡ",
        caption: storySnippet
          ? `${storySnippet} — khoảnh khắc dịu dàng bắt đầu một hành trình chung đôi.`
          : `Giữa muôn vàn nhịp bước vội vã, ${groom} và ${bride} đã tìm thấy bình yên trong ánh mắt nhau.`,
      },
      {
        year: "Lời Hẹn Ước",
        caption: "Từ những buổi chiều sánh bước đến cái nắm tay vững chãi cho cả một đời sau.",
      },
      {
        year: dateText || "Ngày Chung Đôi",
        caption: `Chúng mình hạnh phúc được đón những người thương yêu nhất${venueClause}${dateClause}.`,
      },
    ],
    inviteMessage: `Thanh xuân đẹp nhất là khi có bạn chứng kiến khoảnh khắc ${groom} & ${bride} trao nhau lời nguyện ước${venueClause}${dateClause}. Hẹn gặp bạn trong ngày vui của chúng mình!`,
    wishPrompt: "Hãy để lại một lời chúc dịu dàng để lưu giữ kỷ niệm ngày cưới cùng chúng mình.",
    provider: "curated-vn",
  };
}

function buildGeminiPrompt(input: CopywriterInput): string {
  const toneDesc: Record<CopywriterTone, string> = {
    romantic: "lãng mạn, sâu lắng, tinh tế kiểu tạp chí cưới",
    formal: "trang trọng, lễ phép, chuẩn mực gia đình Việt Nam",
    playful: "trẻ trung, hóm hỉnh, gần gũi với bạn bè",
  };

  return [
    "Bạn là chuyên gia biên tập thiệp cưới tiếng Việt cao cấp.",
    `Hãy viết nội dung thiệp cưới theo văn phong: ${toneDesc[input.tone]}.`,
    `Thông tin cặp đôi:`,
    `- Chú rể: ${input.groomName}`,
    `- Cô dâu: ${input.brideName}`,
    input.weddingDate ? `- Ngày cưới: ${input.weddingDate}` : "",
    input.venueName ? `- Địa điểm: ${input.venueName}` : "",
    input.meetingStory ? `- Câu chuyện gặp nhau: ${input.meetingStory}` : "",
    "",
    "Trả về DUY NHẤT JSON hợp lệ với đúng cấu trúc sau (tiếng Việt tự nhiên, không markdown):",
    JSON.stringify({
      headline: "Tên cặp đôi ngắn gọn (tối đa 60 ký tự)",
      badge: "Nhãn mở đầu ngắn (3-6 từ)",
      storyTitle: "Tiêu đề chuyện tình yêu (3-6 từ)",
      milestones: [
        { year: "Mốc 1", caption: "Mô tả ngắn 1-2 câu" },
        { year: "Mốc 2", caption: "Mô tả ngắn 1-2 câu" },
        { year: "Mốc 3", caption: "Mô tả ngắn 1-2 câu" },
      ],
      inviteMessage: "Lời mời khách dự tiệc ấm áp (2-3 câu)",
      wishPrompt: "Lời gợi ý khách viết lời chúc (1 câu)",
    }),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Generates customized Vietnamese wedding invitation copy using Gemini 2.0 Flash with curated fallback.
 */
export async function generateWeddingCopy(input: CopywriterInput): Promise<GeneratedWeddingCopy> {
  const apiKey = getEnv().GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildCuratedVietnameseCopy(input);
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildGeminiPrompt(input) }] }],
        generationConfig: {
          temperature: 0.75,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      return buildCuratedVietnameseCopy(input);
    }

    const payload = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return buildCuratedVietnameseCopy(input);
    }

    const cleaned = rawText
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = geminiCopyResponseSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      return buildCuratedVietnameseCopy(input);
    }

    return {
      ...parsed.data,
      provider: "gemini",
    };
  } catch {
    return buildCuratedVietnameseCopy(input);
  }
}

/**
 * Atomically consumes 1 AI credit inside a DB transaction, logs to the ledger, and generates wedding copy.
 */
export async function consumeAiCreditAndGenerate(
  userId: string,
  input: CopywriterInput,
): Promise<{ copy: GeneratedWeddingCopy; remainingCredits: number }> {
  const remainingCredits = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({
        aiCredits: sql`${users.aiCredits} - 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), gt(users.aiCredits, 0)))
      .returning({ aiCredits: users.aiCredits });

    if (!updated) {
      throw new AiCreditError(
        "Bạn đã hết lượt AI Magic Setup. Vui lòng nâng cấp gói để nhận thêm lượt.",
        403,
      );
    }

    await tx.insert(aiCreditLedger).values({
      userId,
      delta: -1,
      balanceAfter: updated.aiCredits,
      reason: "ai_magic_setup",
    });

    return updated.aiCredits;
  });

  try {
    const copy = await generateWeddingCopy(input);
    return { copy, remainingCredits };
  } catch (err) {
    // Best-effort refund if copy generation ever throws unexpectedly.
    await db
      .transaction(async (tx) => {
        const [refunded] = await tx
          .update(users)
          .set({
            aiCredits: sql`${users.aiCredits} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning({ aiCredits: users.aiCredits });

        if (refunded) {
          await tx.insert(aiCreditLedger).values({
            userId,
            delta: 1,
            balanceAfter: refunded.aiCredits,
            reason: "ai_magic_setup_refund",
          });
        }
      })
      .catch(() => {});
    throw err;
  }
}
