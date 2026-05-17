import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extracts } from "@/lib/db";
import { ActionItemStatus, RequestStatus } from "@/lib/db/types";

/**
 * PATCH /api/extracts/[id]/status
 * Update the status of an extract (action item or request)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const { statusType, status } = body as {
      statusType: "action" | "request";
      status: ActionItemStatus | RequestStatus;
    };

    if (!statusType || !["action", "request"].includes(statusType)) {
      return NextResponse.json(
        { error: "Invalid statusType. Must be 'action' or 'request'" },
        { status: 400 }
      );
    }

    // Validate status values
    if (statusType === "action") {
      if (status !== null && !["pending", "assigned", "done"].includes(status as string)) {
        return NextResponse.json(
          { error: "Invalid action status. Must be 'pending', 'assigned', 'done', or null" },
          { status: 400 }
        );
      }
    } else {
      if (status !== null && !["pending", "ticket_added"].includes(status as string)) {
        return NextResponse.json(
          { error: "Invalid request status. Must be 'pending', 'ticket_added', or null" },
          { status: 400 }
        );
      }
    }

    // Check if extract exists
    const extract = await extracts.getExtractById(id);
    if (!extract) {
      return NextResponse.json({ error: "Extract not found" }, { status: 404 });
    }

    // Update the appropriate status field
    let updatedExtract;
    if (statusType === "action") {
      updatedExtract = await extracts.updateActionItemStatus(id, status as ActionItemStatus);
    } else {
      updatedExtract = await extracts.updateRequestStatus(id, status as RequestStatus);
    }

    return NextResponse.json({
      success: true,
      extract: updatedExtract,
    });
  } catch (error) {
    console.error("Error updating extract status:", error);
    return NextResponse.json(
      { error: "Failed to update extract status" },
      { status: 500 }
    );
  }
}
