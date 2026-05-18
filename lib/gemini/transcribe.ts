import { getGeminiClient, getFileManager, waitForFileProcessing, GEMINI_MODEL } from "./client";
import { getDriveClient } from "@/lib/google/client";
import { meetings } from "@/lib/db";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Transcription prompt
const TRANSCRIPTION_PROMPT = `Please transcribe this audio/video recording.
Provide a complete, accurate transcription of all spoken content.
Format the transcription with speaker labels where identifiable (e.g., "Speaker 1:", "Speaker 2:").
Include timestamps at natural breaks in the conversation.
Do not summarize - provide the full verbatim transcription.`;

// Stream a file from Google Drive and upload to Gemini
export async function uploadDriveFileToGemini(
  userId: string,
  driveFileId: string,
  mimeType: string
): Promise<string> {
  const drive = await getDriveClient(userId);
  const fileManager = getFileManager();

  // Get file metadata
  const fileMetadata = await drive.files.get({
    fileId: driveFileId,
    fields: "name,mimeType,size",
  });

  const fileName = fileMetadata.data.name || `recording-${driveFileId}`;
  const extension = mimeType.includes("mp4") ? ".mp4" : mimeType.includes("webm") ? ".webm" : ".video";

  // Download file from Drive as a stream
  const response = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    { responseType: "stream" }
  );

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  const stream = response.data as Readable;

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });

  const buffer = Buffer.concat(chunks);

  // Write to temporary file (Gemini SDK requires file path)
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `gemini-upload-${Date.now()}${extension}`);

  try {
    fs.writeFileSync(tempFilePath, buffer);

    // Upload to Gemini Files API
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: mimeType,
      displayName: fileName,
    });

    // Wait for processing
    await waitForFileProcessing(uploadResult.file.name);

    return uploadResult.file.name;
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Transcribe a file using Gemini
export async function transcribeWithGemini(geminiFileName: string): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent([
    {
      fileData: {
        mimeType: "video/mp4", // Will be overridden by actual file type
        fileUri: `https://generativelanguage.googleapis.com/v1beta/files/${geminiFileName}`,
      },
    },
    { text: TRANSCRIPTION_PROMPT },
  ]);

  const response = result.response;
  return response.text();
}

// Full pipeline: Get recording from Drive, upload to Gemini, transcribe
export async function transcribeMeetingRecording(
  accountId: string,
  userId: string,
  meetingId: string
): Promise<{ success: boolean; transcript?: string; error?: string }> {
  const meeting = await meetings.getMeetingById(accountId, meetingId);
  if (!meeting) {
    return { success: false, error: "Meeting not found" };
  }

  if (!meeting.recording_url || !meeting.recording_url.startsWith("drive:")) {
    return { success: false, error: "No recording available for this meeting" };
  }

  const driveFileId = meeting.recording_url.replace("drive:", "");

  try {
    await meetings.updateMeetingStatus(accountId, meetingId, "processing");

    const drive = await getDriveClient(userId);
    const fileInfo = await drive.files.get({
      fileId: driveFileId,
      fields: "mimeType,name",
    });

    const mimeType = fileInfo.data.mimeType || "video/mp4";

    const geminiFileName = await uploadDriveFileToGemini(userId, driveFileId, mimeType);
    const transcript = await transcribeWithGemini(geminiFileName);

    await meetings.updateMeetingTranscript(accountId, meetingId, transcript, "gemini");
    await meetings.updateMeetingStatus(accountId, meetingId, "completed");

    try {
      const fileManager = getFileManager();
      await fileManager.deleteFile(geminiFileName);
    } catch (cleanupError) {
      console.error("Failed to delete Gemini file:", cleanupError);
    }

    return { success: true, transcript };
  } catch (error) {
    console.error("Transcription error:", error);
    await meetings.updateMeetingStatus(accountId, meetingId, "failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// Check if a meeting needs Gemini transcription
export function needsGeminiTranscription(meeting: {
  transcript: string | null;
  recording_url: string | null;
  workflow_status: string;
}): boolean {
  return (
    !meeting.transcript &&
    meeting.recording_url?.startsWith("drive:") === true &&
    meeting.workflow_status !== "processing"
  );
}
