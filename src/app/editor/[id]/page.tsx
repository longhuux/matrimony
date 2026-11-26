import { and, asc, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import {
  EditorWorkspace,
  type EditorProfileOption,
  type EditorTemplateOption,
} from "@/components/editor/editor-workspace";
import { db } from "@/db";
import { invitations, templates, weddingProfiles } from "@/db/schema";
import { getCurrentUser } from "@/modules/auth/session";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";
import { FLAGSHIP_TEMPLATES } from "@/modules/invitation-engine/templates";

const uuidSchema = z.string().uuid();

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    notFound();
  }

  const [[invitation], dbTemplates, dbProfiles] = await Promise.all([
    db
      .select()
      .from(invitations)
      .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
      .limit(1),
    db
      .select()
      .from(templates)
      .where(eq(templates.isActive, true))
      .orderBy(asc(templates.tier), asc(templates.createdAt)),
    db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.userId, user.id))
      .orderBy(desc(weddingProfiles.updatedAt)),
  ]);

  if (!invitation) {
    notFound();
  }

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const planConfig = getPlanConfig(effectivePlan);

  const templateOptions: EditorTemplateOption[] =
    dbTemplates.length > 0
      ? dbTemplates.map((tpl) => ({
          slug: tpl.slug,
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          tier: tpl.tier === "free" ? "free" : "pro",
          thumbnailUrl:
            tpl.thumbnailUrl ||
            FLAGSHIP_TEMPLATES.find((f) => f.slug === tpl.slug)?.thumbnailUrl ||
            "/images/wedding/hero-couple.webp",
          defaultDoc: tpl.defaultDoc,
        }))
      : FLAGSHIP_TEMPLATES.map((tpl) => ({
          slug: tpl.slug,
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          tier: tpl.tier,
          thumbnailUrl: tpl.thumbnailUrl,
          defaultDoc: tpl.defaultDoc,
        }));

  const profileOptions: EditorProfileOption[] = dbProfiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    data: {
      groom: profile.groomInfo,
      bride: profile.brideInfo,
      events: profile.events,
      bankAccounts: profile.bankAccounts,
      mainEventId: profile.events[0]?.id,
    },
  }));

  return (
    <EditorWorkspace
      initialInvitation={{
        id: invitation.id,
        slug: invitation.slug,
        title: invitation.title,
        status: invitation.status,
        version: invitation.version,
        docJson: invitation.docJson,
        updatedAt: invitation.updatedAt.toISOString(),
      }}
      templates={templateOptions}
      profiles={profileOptions}
      userPlan={{
        tier: effectivePlan,
        name: planConfig.name,
        aiCredits: user.aiCredits,
        features: {
          removeWatermark: planConfig.features.removeWatermark,
          premiumTemplates: planConfig.features.premiumTemplates,
          dynamicZaloOg: planConfig.features.dynamicZaloOg,
          customMusic: planConfig.features.customMusic,
        },
      }}
    />
  );
}
