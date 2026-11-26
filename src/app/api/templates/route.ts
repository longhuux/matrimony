import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { templates } from "@/db/schema";

/**
 * Lists active wedding invitation templates, ordered with free templates first.
 */
export async function GET(): Promise<NextResponse> {
  const rows = await db
    .select({
      id: templates.id,
      slug: templates.slug,
      name: templates.name,
      description: templates.description,
      category: templates.category,
      tier: templates.tier,
      thumbnailUrl: templates.thumbnailUrl,
      defaultDoc: templates.defaultDoc,
      usageCount: templates.usageCount,
      createdAt: templates.createdAt,
    })
    .from(templates)
    .where(eq(templates.isActive, true))
    .orderBy(asc(templates.tier), asc(templates.createdAt));

  return NextResponse.json({ templates: rows });
}
