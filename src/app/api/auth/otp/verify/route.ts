import { NextResponse } from "next/server";
import { z } from "zod";
import { extractClientIp, isTrustedOrigin } from "@/modules/auth/csrf";
import { OtpAuthError, verifyEmailOtp } from "@/modules/auth/otp";

const bodySchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  code: z.string().regex(/^\d{6}$/, "Mã OTP phải gồm 6 chữ số"),
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

    const result = await verifyEmailOtp(parsed.data.email, parsed.data.code, {
      ipAddress: extractClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, isNewUser: result.isNewUser });
  } catch (err) {
    if (err instanceof OtpAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: "Không thể xác thực OTP lúc này. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}
