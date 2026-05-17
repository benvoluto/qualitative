import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";
import { isHubSpotConfigured } from "@/lib/hubspot";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      googleMeet: !!user.google_access_token,
      teams: !!user.ms_access_token,
      hubspot: isHubSpotConfigured(),
    });
  } catch (error) {
    console.error("Error getting integration status:", error);
    return NextResponse.json(
      { error: "Failed to get integration status" },
      { status: 500 }
    );
  }
}
