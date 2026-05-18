import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { emailDrafts } from "@/lib/db";
import { regenerateEmailDraft } from "@/lib/workflows/email-workflow";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const draft = await emailDrafts.getEmailDraftById(accountId, id);

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Error fetching email draft:", error);
    return NextResponse.json({ error: "Failed to fetch email draft" }, { status: 500 });
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

    if (body.regenerate) {
      const additionalInstructions = body.additionalInstructions || null;
      const draft = await regenerateEmailDraft(accountId, id, undefined, additionalInstructions);
      return NextResponse.json({ draft });
    }

    const draft = await emailDrafts.updateEmailDraft(accountId, id, {
      subject: body.subject,
      body: body.body,
      recipient_email: body.recipient_email,
      recipient_name: body.recipient_name,
      status: body.status,
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Error updating email draft:", error);
    return NextResponse.json({ error: "Failed to update email draft" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const deleted = await emailDrafts.deleteEmailDraft(accountId, id);

    if (!deleted) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email draft:", error);
    return NextResponse.json({ error: "Failed to delete email draft" }, { status: 500 });
  }
}
