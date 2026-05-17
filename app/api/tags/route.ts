import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { tags } from "@/lib/db";
import { TAG_COLORS } from "@/lib/constants/colors";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [allTags, usedColors] = await Promise.all([
      tags.getTags(),
      tags.getUsedColors(),
    ]);

    // Calculate available colors
    const usedColorSet = new Set(usedColors);
    const availableColors = TAG_COLORS.filter((c) => !usedColorSet.has(c));

    return NextResponse.json({ tags: allTags, availableColors });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, color } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    // Check if tag already exists
    const existing = await tags.getTagByName(name.trim());
    if (existing) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 400 }
      );
    }

    // Validate color if provided
    if (color) {
      const usedColors = await tags.getUsedColors();
      if (usedColors.includes(color)) {
        return NextResponse.json(
          { error: "This color is already assigned to another tag" },
          { status: 400 }
        );
      }
      if (!TAG_COLORS.includes(color)) {
        return NextResponse.json(
          { error: "Invalid color" },
          { status: 400 }
        );
      }
    }

    const tag = await tags.createTag({
      name: name.trim(),
      type: type || "user",
      color: color || null,
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
