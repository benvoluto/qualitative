import { NextResponse } from "next/server";

/**
 * HUBSPOT MEETING SYNC IS PERMANENTLY DISABLED
 *
 * This endpoint has been disabled to prevent HubSpot meetings from being synced.
 * Meeting sources are now limited to: Google Meet, Zoom, and Microsoft Teams.
 *
 * The sync functionality has been removed (not just disabled) to prevent any
 * possibility of accidental re-enablement.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "HubSpot meeting sync is permanently disabled",
      message: "Meeting sync is only available for Google Meet, Zoom, and Microsoft Teams."
    },
    { status: 410 } // 410 Gone - endpoint is permanently unavailable
  );
}

export async function GET() {
  // Always return not configured since HubSpot meeting sync is permanently disabled
  return NextResponse.json({
    configured: false,
    disabled: true,
    message: "HubSpot meeting sync is permanently disabled"
  });
}
