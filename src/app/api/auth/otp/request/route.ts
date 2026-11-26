import { NextResponse } from "next/server";
import { z } from "zod";
import { extractClientIp, isTrustedOrigin } from "@/modules/auth/csrf";
import { OtpAuthError, requestEmailOtp } from "@/modules/auth/otp";

const bodySchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

export async function POST(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }

    await requestEmailOtp(parsed.data.email, {
      ipAddress: extractClientIp(req),
    });

    return NextResponse.json({
      ok: true,
      message: "Mã OTP đã được gửi. Vui lòng kiểm tra hộp thư (hoặc server log ở môi trường dev).",
    });
  } catch (err) {
    if (err instanceof OtpAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: "Không thể gửi mã OTP lúc này. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}
