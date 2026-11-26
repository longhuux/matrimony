import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getPlanConfig } from "@/modules/billing/plans";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user,
    planConfig: getPlanConfig(user.plan),
  });
}
