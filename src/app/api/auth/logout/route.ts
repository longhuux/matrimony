import { NextResponse } from "next/server";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { destroySession } from "@/modules/auth/session";

export async function POST(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  await destroySession();
  return NextResponse.json({ ok: true });
}
