import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { meetings, extracts, customers } from "@/lib/db";
import { CustomerType, TranscriptSource } from "@/lib/db/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { accountId } = await requireAccountContext();
    const { id } = await params;
    const meeting = await meetings.getMeetingById(accountId, id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    const participantIds = await meetings.getMeetingParticipantIds(accountId, id);
    return NextResponse.json({ meeting, participantIds });
  } catch (error) {
    console.error("Error fetching meeting:", error);
    return NextResponse.json({ error: "Failed to fetch meeting" }, { status: 500 });
  }
}

interface UpdateMeetingBody {
  name?: string;
  meeting_date?: string | null;
  user_notes?: string;
  customer_id?: string | null;
  host_name?: string;
  host_email?: string;
  host_hubspot_contact_id?: string | null;
  customer_type?: CustomerType;
  participant_ids?: string[];
  transcript?: string;
  transcript_source?: TranscriptSource;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { accountId } = await requireAccountContext();
    const { id } = await params;
    const body: UpdateMeetingBody = await request.json();

    const existingMeeting = await meetings.getMeetingById(accountId, id);
    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingUpdate: Parameters<typeof meetings.updateMeeting>[2] = {};
    if (body.name !== undefined) meetingUpdate.name = body.name;
    if (body.meeting_date !== undefined) {
      meetingUpdate.meeting_date = body.meeting_date ? new Date(body.meeting_date) : null;
    }
    if (body.user_notes !== undefined) meetingUpdate.user_notes = body.user_notes;
    if (body.host_name !== undefined) meetingUpdate.host_name = body.host_name;
    if (body.host_email !== undefined) meetingUpdate.host_email = body.host_email;
    if (body.transcript !== undefined) meetingUpdate.transcript = body.transcript;
    if (body.transcript_source !== undefined) meetingUpdate.transcript_source = body.transcript_source;

    // Customer change cascades the derived company_id onto the meeting and its extracts.
    let derivedCompanyId: string | null | undefined;
    if (body.customer_id !== undefined) {
      meetingUpdate.customer_id = body.customer_id;
      derivedCompanyId = body.customer_id
        ? (await customers.getCustomerById(accountId, body.customer_id))?.company_id ?? null
        : null;
      meetingUpdate.company_id = derivedCompanyId;
    }

    const meeting = await meetings.updateMeeting(accountId, id, meetingUpdate);

    if (body.customer_id !== undefined && body.customer_id !== existingMeeting.customer_id) {
      await extracts.updateExtractsCustomerByMeetingId(
        accountId,
        id,
        body.customer_id,
        derivedCompanyId ?? null
      );
    }

    if (body.customer_type && body.customer_id) {
      const customer = await customers.getCustomerById(accountId, body.customer_id);
      if (customer && customer.customer_type !== body.customer_type) {
        await customers.updateCustomer(accountId, body.customer_id, {
          customer_type: body.customer_type,
        });
      }
    }

    if (body.participant_ids !== undefined) {
      const currentParticipantIds = await meetings.getMeetingParticipantIds(accountId, id);
      const newParticipantIds = body.participant_ids;

      for (const personnelId of currentParticipantIds) {
        if (!newParticipantIds.includes(personnelId)) {
          await meetings.removeMeetingParticipant(accountId, id, personnelId);
        }
      }

      for (const personnelId of newParticipantIds) {
        if (!currentParticipantIds.includes(personnelId)) {
          await meetings.addMeetingParticipant(accountId, id, personnelId);
        }
      }
    }

    const participants = await meetings.getMeetingParticipantsWithDetails(accountId, id);

    return NextResponse.json({ meeting, participants });
  } catch (error) {
    console.error("Error updating meeting:", error);
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { accountId } = await requireAccountContext();
    const { id } = await params;

    const meeting = await meetings.getMeetingById(accountId, id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingExtracts = await extracts.getExtractsByMeetingId(accountId, id);
    for (const extract of meetingExtracts) {
      await extracts.removeAllExtractTags(accountId, extract.id);
      await extracts.deleteExtract(accountId, extract.id);
    }

    await meetings.deleteMeeting(accountId, id);

    return NextResponse.json({
      success: true,
      deletedExtracts: meetingExtracts.length,
    });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
  }
}
