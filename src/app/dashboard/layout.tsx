import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/db";
import { aiCreditLedger, invitations } from "@/db/schema";
import { getCurrentUser } from "@/modules/auth/session";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const planConfig = getPlanConfig(effectivePlan);

  const [invSummary, ledgerRows] = await Promise.all([
    db
      .select({
        id: invitations.id,
        title: invitations.title,
        slug: invitations.slug,
        status: invitations.status,
      })
      .from(invitations)
      .where(eq(invitations.userId, user.id))
      .orderBy(desc(invitations.updatedAt))
      .limit(20),
    db
      .select({
        id: aiCreditLedger.id,
        delta: aiCreditLedger.delta,
        balanceAfter: aiCreditLedger.balanceAfter,
        reason: aiCreditLedger.reason,
        refId: aiCreditLedger.refId,
        createdAt: aiCreditLedger.createdAt,
      })
      .from(aiCreditLedger)
      .where(eq(aiCreditLedger.userId, user.id))
      .orderBy(desc(aiCreditLedger.createdAt))
      .limit(15),
  ]);

  return (
    <DashboardShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        aiCredits: user.aiCredits,
      }}
      planSku={effectivePlan}
      planName={planConfig.name}
      invitations={invSummary}
      aiCreditLedger={ledgerRows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      }))}
    >
      {children}
    </DashboardShell>
  );
}
