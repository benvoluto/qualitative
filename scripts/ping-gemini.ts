import { config } from "dotenv";
config({ path: ".env.local" });

import { GoogleGenerativeAI } from "@google/generative-ai";

async function main(): Promise<void> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const model = process.env.GEMINI_MODEL_FAST || "gemini-2.5-flash";
  const client = new GoogleGenerativeAI(key);
  const generative = client.getGenerativeModel({ model });
  const result = await generative.generateContent("Say the single word PONG and nothing else.");
  const text = result.response.text();
  console.log(`[ping-gemini] model=${model} response=${JSON.stringify(text)}`);
}

main().catch((err: unknown) => {
  console.error("[ping-gemini] FAILED:", err);
  process.exit(1);
});
