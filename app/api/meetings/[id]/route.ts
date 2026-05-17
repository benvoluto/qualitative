import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { meetings, extracts, customers } from "@/lib/db";
import { CustomerType, TranscriptSource } from "@/lib/db/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const meeting = await meetings.getMeetingById(id);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Get participants
    const participantIds = await meetings.getMeetingParticipantIds(id);

    return NextResponse.json({
      meeting,
      participantIds,
    });
  } catch (error) {
    console.error("Error fetching meeting:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting" },
      { status: 500 }
    );
  }
}

interface UpdateMeetingBody {
  name?: string;
  meeting_date?: string;
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body: UpdateMeetingBody = await request.json();

    // Verify meeting exists
    const existingMeeting = await meetings.getMeetingById(id);
    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Update meeting basic fields
    const meetingUpdate: Parameters<typeof meetings.updateMeeting>[1] = {};
    if (body.name !== undefined) meetingUpdate.name = body.name;
    if (body.meeting_date !== undefined) meetingUpdate.meeting_date = new Date(body.meeting_date);
    if (body.user_notes !== undefined) meetingUpdate.user_notes = body.user_notes;
    if (body.customer_id !== undefined) meetingUpdate.customer_id = body.customer_id;
    if (body.host_name !== undefined) meetingUpdate.host_name = body.host_name;
    if (body.host_email !== undefined) meetingUpdate.host_email = body.host_email;
    if (body.transcript !== undefined) meetingUpdate.transcript = body.transcript;
    if (body.transcript_source !== undefined) meetingUpdate.transcript_source = body.transcript_source;

    const meeting = await meetings.updateMeeting(id, meetingUpdate);

    // If customer_id changed, cascade update to all extracts for this meeting
    if (body.customer_id !== undefined && body.customer_id !== existingMeeting.customer_id) {
      await extracts.updateExtractsCustomerByMeetingId(id, body.customer_id);
    }

    // If customer_type is provided and customer_id exists, update the customer's type
    if (body.customer_type && body.customer_id) {
      const customer = await customers.getCustomerById(body.customer_id);
      if (customer && customer.customer_type !== body.customer_type) {
        await customers.updateCustomer(body.customer_id, {
          customer_type: body.customer_type,
        });
      }
    }

    // Handle participant updates if provided
    if (body.participant_ids !== undefined) {
      // Get current participants
      const currentParticipantIds = await meetings.getMeetingParticipantIds(id);
      const newParticipantIds = body.participant_ids;

      // Remove participants no longer in the list
      for (const personnelId of currentParticipantIds) {
        if (!newParticipantIds.includes(personnelId)) {
          await meetings.removeMeetingParticipant(id, personnelId);
        }
      }

      // Add new participants
      for (const personnelId of newParticipantIds) {
        if (!currentParticipantIds.includes(personnelId)) {
          await meetings.addMeetingParticipant(id, personnelId);
        }
      }
    }

    // Get updated participants with details
    const participants = await meetings.getMeetingParticipantsWithDetails(id);

    return NextResponse.json({
      meeting,
      participants,
    });
  } catch (error) {
    console.error("Error updating meeting:", error);
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify meeting exists
    const meeting = await meetings.getMeetingById(id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Delete all extracts associated with this meeting first
    const meetingExtracts = await extracts.getExtractsByMeetingId(id);
    for (const extract of meetingExtracts) {
      await extracts.removeAllExtractTags(extract.id);
      await extracts.deleteExtract(extract.id);
    }

    // Delete the meeting
    await meetings.deleteMeeting(id);

    return NextResponse.json({
      success: true,
      deletedExtracts: meetingExtracts.length,
    });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return NextResponse.json(
      { error: "Failed to delete meeting" },
      { status: 500 }
    );
  }
}
