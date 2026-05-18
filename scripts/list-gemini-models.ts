// Script to list available Gemini models
// Run with: npx tsx scripts/list-gemini-models.ts

import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^=]+)=["']?([^"'\n]+)["']?$/);
      if (match) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

async function listModels() {
  loadEnv();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY not set");
    process.exit(1);
  }

  console.log("Fetching available Gemini models...\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  const data = await response.json();

  if (data.error) {
    console.error("API Error:", data.error.message);
    process.exit(1);
  }

  console.log("Models that support generateContent:\n");

  const contentModels = data.models.filter(
    (m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes("generateContent")
  );

  for (const model of contentModels) {
    console.log(`- ${model.name.replace("models/", "")}`);
    console.log(`    Display: ${model.displayName}`);
    console.log(`    Input limit: ${model.inputTokenLimit} tokens`);
    console.log(`    Output limit: ${model.outputTokenLimit} tokens`);
    console.log("");
  }

  console.log(`\nTotal: ${contentModels.length} models available`);
}

listModels().catch(console.error);
