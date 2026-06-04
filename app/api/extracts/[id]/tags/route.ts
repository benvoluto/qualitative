import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { extracts, tags } from "@/lib/db";

interface AttachTagBody {
  tag_id?: unknown;
  tag_name?: unknown;
}

/**
 * Attach a tag to an extract. Accepts either an existing tag_id or a tag_name
 * (which gets resolved via getOrCreateTag so the picker can create new tags
 * on demand). Returns the tag so the client can render its color immediately.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id: extractId } = await params;
    const body = (await request.json()) as AttachTagBody;
    const tagIdParam = typeof body.tag_id === "string" ? body.tag_id : null;
    const tagNameParam =
      typeof body.tag_name === "string" ? body.tag_name.trim() : "";
    if (!tagIdParam && !tagNameParam) {
      return NextResponse.json(
        { error: "tag_id or tag_name required" },
        { status: 400 }
      );
    }
    const tag = tagIdParam
      ? await tags.getTagById(accountId, tagIdParam)
      : await tags.getOrCreateTag(accountId, tagNameParam, "user");
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    await extracts.addExtractTag(accountId, extractId, tag.id);
    return NextResponse.json({
      tag: { id: tag.id, name: tag.name, color: tag.color },
    });
  } catch (error) {
    console.error("Error attaching tag to extract:", error);
    return NextResponse.json({ error: "Failed to attach tag" }, { status: 500 });
  }
}
