import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

let genAI: GoogleGenerativeAI | null = null;
let fileManager: GoogleAIFileManager | null = null;

// Default models - can be overridden via environment variables
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
export const GEMINI_MODEL_FAST = process.env.GEMINI_MODEL_FAST || "gemini-2.5-flash";

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

export function getFileManager(): GoogleAIFileManager {
  if (!fileManager) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
  }
  return fileManager;
}

// Wait for file processing to complete
export async function waitForFileProcessing(
  fileName: string,
  maxWaitMs: number = 300000 // 5 minutes max
): Promise<void> {
  const fm = getFileManager();
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const file = await fm.getFile(fileName);

    if (file.state === FileState.ACTIVE) {
      return;
    }

    if (file.state === FileState.FAILED) {
      throw new Error(`File processing failed: ${fileName}`);
    }

    // Wait 5 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(`File processing timed out: ${fileName}`);
}
