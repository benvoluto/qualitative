import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { tags } from "@/lib/db";
import { TAG_COLORS } from "@/lib/constants/colors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const tag = await tags.getTagById(accountId, id);

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    console.error("Error fetching tag:", error);
    return NextResponse.json({ error: "Failed to fetch tag" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const body = await request.json();
    const { name, type, color } = body;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Tag name cannot be empty" }, { status: 400 });
      }

      const existing = await tags.getTagByName(accountId, name.trim());
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "A tag with this name already exists" }, { status: 400 });
      }
    }

    if (color !== undefined && color !== null) {
      if (!TAG_COLORS.includes(color)) {
        return NextResponse.json({ error: "Invalid color" }, { status: 400 });
      }

      const allTags = await tags.getTags(accountId);
      const colorTaken = allTags.some((t) => t.color === color && t.id !== id);
      if (colorTaken) {
        return NextResponse.json({ error: "This color is already assigned to another tag" }, { status: 400 });
      }
    }

    const tag = await tags.updateTag(accountId, id, {
      name: name?.trim(),
      type,
      color,
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    console.error("Error updating tag:", error);
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const deleted = await tags.deleteTag(accountId, id);

    if (!deleted) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}
