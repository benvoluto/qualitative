import * as dotenv from "dotenv";
dotenv.config({ path: ".env.development.local" });

import { fetchHubSpotMeetingsLastDays } from "../lib/hubspot/meetings";

async function checkMeetings() {
  console.log("Checking HubSpot meetings for recording/transcript info...\n");

  const meetings = await fetchHubSpotMeetingsLastDays(30);
  console.log(`Found ${meetings.length} meetings in the last 30 days.\n`);

  // Check what data is available
  let withExternalUrl = 0;
  let withLocation = 0;
  let zoomMeetings = 0;
  let googleMeetMeetings = 0;
  let teamsMeetings = 0;
  let otherMeetings = 0;

  const sampleMeetings: typeof meetings = [];

  for (const meeting of meetings) {
    if (meeting.externalUrl) {
      withExternalUrl++;

      const url = meeting.externalUrl.toLowerCase();
      if (url.includes("zoom")) {
        zoomMeetings++;
      } else if (url.includes("meet.google") || url.includes("hangouts")) {
        googleMeetMeetings++;
      } else if (url.includes("teams.microsoft")) {
        teamsMeetings++;
      } else {
        otherMeetings++;
      }
    }

    if (meeting.location) {
      withLocation++;

      const loc = meeting.location.toLowerCase();
      if (loc.includes("zoom") && !meeting.externalUrl?.toLowerCase().includes("zoom")) {
        zoomMeetings++;
      }
    }

    // Collect samples with URLs
    if (meeting.externalUrl && sampleMeetings.length < 10) {
      sampleMeetings.push(meeting);
    }
  }

  console.log("=== Summary ===");
  console.log(`Meetings with external URL: ${withExternalUrl}`);
  console.log(`Meetings with location: ${withLocation}`);
  console.log("");
  console.log("=== Meeting Platform Breakdown ===");
  console.log(`Zoom meetings: ${zoomMeetings}`);
  console.log(`Google Meet meetings: ${googleMeetMeetings}`);
  console.log(`Microsoft Teams meetings: ${teamsMeetings}`);
  console.log(`Other/Unknown: ${otherMeetings}`);
  console.log("");

  if (sampleMeetings.length > 0) {
    console.log("=== Sample Meetings with URLs ===");
    sampleMeetings.forEach((m, i) => {
      console.log(`\n${i + 1}. ${m.title || "Untitled"}`);
      console.log(`   Date: ${m.startTime?.toLocaleDateString() || "No date"}`);
      console.log(`   External URL: ${m.externalUrl || "None"}`);
      console.log(`   Location: ${m.location || "None"}`);
    });
  }
}

checkMeetings().catch(console.error);
