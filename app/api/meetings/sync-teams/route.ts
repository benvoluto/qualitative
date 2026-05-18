import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { users } from "@/lib/db";
import {
  isMicrosoftConfigured,
  userHasMicrosoftTokens,
  getTeamsMeetingsForSync,
  syncTeamsMeetingToDatabase,
} from "@/lib/teams";

/** Maximum duration for this serverless function (seconds) - Vercel Pro allows up to 300s */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { accountId, userId } = await requireAccountContext();

    if (!isMicrosoftConfigured()) {
      return NextResponse.json({ error: "Microsoft Teams is not configured" }, { status: 400 });
    }

    const user = await users.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has Microsoft tokens
    const hasTokens = await userHasMicrosoftTokens(user.id);
    if (!hasTokens) {
      return NextResponse.json(
        {
          error: "Microsoft account not connected",
          needsAuth: true,
          message: "Please connect your Microsoft account to sync Teams meetings",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { days = 30, skipExternalIds = [] } = body as {
      days?: number;
      skipExternalIds?: string[];
    };

    const skipSet = new Set<string>(skipExternalIds);

    const teamsMeetings = await getTeamsMeetingsForSync(accountId, user.id, days);

    // Filter out already synced and skipped meetings
    const toSync = teamsMeetings.filter(
      (m) => !m.alreadySynced && !skipSet.has(m.externalId)
    );

    const results = {
      synced: [] as Array<{ id: string; name: string; date: Date }>,
      skipped: 0,
      alreadyExists: 0,
      errors: [] as Array<{ meeting: string; error: string }>,
    };

    results.alreadyExists = teamsMeetings.filter((m) => m.alreadySynced).length;
    results.skipped = skipSet.size;

    for (const teamsMeeting of toSync) {
      try {
        const meeting = await syncTeamsMeetingToDatabase(accountId, user.id, teamsMeeting);
        results.synced.push({
          id: meeting.id,
          name: meeting.name || teamsMeeting.subject,
          date: teamsMeeting.startTime,
        });

      } catch (error) {
        results.errors.push({
          meeting: teamsMeeting.subject,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.synced.length} Teams meeting(s)`,
      ...results,
    });
  } catch (error) {
    console.error("Teams sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync Teams meetings",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { accountId, userId } = await requireAccountContext();

    if (!isMicrosoftConfigured()) {
      return NextResponse.json({
        configured: false,
        error: "Microsoft Teams is not configured",
      });
    }

    const user = await users.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has Microsoft tokens
    const hasTokens = await userHasMicrosoftTokens(user.id);
    if (!hasTokens) {
      return NextResponse.json({
        configured: true,
        connected: false,
        needsAuth: true,
        message: "Microsoft account not connected",
      });
    }

    const meetings = await getTeamsMeetingsForSync(accountId, user.id, 30);

    return NextResponse.json({
      configured: true,
      connected: true,
      meetings: meetings.map((m) => ({
        externalId: m.externalId,
        subject: m.subject,
        startTime: m.startTime,
        endTime: m.endTime,
        hasJoinUrl: !!m.joinUrl,
        alreadySynced: m.alreadySynced,
      })),
    });
  } catch (error) {
    console.error("Teams preview error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch Teams meetings",
      },
      { status: 500 }
    );
  }
}
