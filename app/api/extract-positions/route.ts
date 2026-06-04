import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { extractPositions } from "@/lib/db";

interface UpsertBody {
  extract_id?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  color?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    const body = (await request.json()) as UpsertBody;
    const extractId = typeof body.extract_id === "string" ? body.extract_id : null;
    const x = typeof body.x === "number" ? Math.round(body.x) : null;
    const y = typeof body.y === "number" ? Math.round(body.y) : null;
    if (!extractId || x === null || y === null) {
      return NextResponse.json({ error: "extract_id, x, y required" }, { status: 400 });
    }
    const result = await extractPositions.upsertPosition(accountId, {
      extract_id: extractId,
      x,
      y,
      width: typeof body.width === "number" ? Math.round(body.width) : undefined,
      height: typeof body.height === "number" ? Math.round(body.height) : undefined,
      color: typeof body.color === "string" ? body.color : undefined,
    });
    if (!result) {
      return NextResponse.json({ error: "Extract not found" }, { status: 404 });
    }
    return NextResponse.json({ position: result });
  } catch (error) {
    console.error("Error upserting extract position:", error);
    return NextResponse.json({ error: "Failed to save position" }, { status: 500 });
  }
}
