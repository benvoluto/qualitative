import { getGeminiClient, GEMINI_MODEL_FAST } from "./client";

export interface ParticipantAnalysis {
  name: string;
  email: string | null;
  participated: boolean;
  speakerIndicators: string[];
}

export interface ParticipationAnalysisResult {
  participants: ParticipantAnalysis[];
  analyzedSpeakers: string[];
}

const PARTICIPATION_ANALYSIS_PROMPT = `Analyze this meeting transcript to determine which participants actively participated in the discussion.

## Known Participants (from meeting invite/calendar):
{participants}

## Meeting Transcript:
{transcript}

---

Analyze the transcript to determine:
1. Which of the known participants actually spoke during the meeting
2. Any speaker names or labels mentioned in the transcript (e.g., "John:", "Speaker 1:", "[John Smith]:")

For each known participant, determine if they participated by:
- Looking for their name as a speaker label in the transcript
- Looking for mentions of them speaking or being addressed
- Looking for first name matches in speaker labels

## Output Format:
Return a JSON object:
{
  "participants": [
    {
      "name": "Full Name from known participants",
      "email": "email@example.com or null",
      "participated": true/false,
      "speakerIndicators": ["John:", "John Smith:"] // speaker labels found that match this person
    }
  ],
  "analyzedSpeakers": ["John:", "Mary:", "Speaker 1:"] // all unique speaker labels found in transcript
}

Rules:
- Match speaker labels to participant names using first name, last name, or full name
- If a speaker label clearly matches a participant's name, mark them as participated=true
- If no clear match is found for a participant, mark them as participated=false
- Include all speaker labels found in the transcript in analyzedSpeakers

Return only valid JSON.`;

/**
 * Analyze a meeting transcript to determine which participants actually spoke
 */
export async function analyzeTranscriptParticipation(
  transcript: string,
  participants: Array<{ name: string; email: string | null }>
): Promise<ParticipationAnalysisResult> {
  if (!transcript || transcript.trim().length === 0) {
    return {
      participants: participants.map((p) => ({
        ...p,
        participated: false,
        speakerIndicators: [],
      })),
      analyzedSpeakers: [],
    };
  }
  if (participants.length === 0) {
    return {
      participants: [],
      analyzedSpeakers: extractSpeakerLabels(transcript),
    };
  }
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });
  const participantsText = participants
    .map((p) => (p.email ? `- ${p.name} <${p.email}>` : `- ${p.name}`))
    .join("\n");
  const transcriptPreview = transcript.length > 50000
    ? transcript.substring(0, 50000) + "\n\n[Transcript truncated for analysis...]"
    : transcript;
  const prompt = PARTICIPATION_ANALYSIS_PROMPT
    .replace("{participants}", participantsText)
    .replace("{transcript}", transcriptPreview);
  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("Failed to parse participation analysis response, using fallback");
      return fallbackParticipationAnalysis(transcript, participants);
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      participants: parsed.participants || [],
      analyzedSpeakers: parsed.analyzedSpeakers || [],
    };
  } catch (error) {
    console.error("Error in participation analysis:", error);
    return fallbackParticipationAnalysis(transcript, participants);
  }
}

/**
 * Fallback analysis using simple pattern matching when Gemini fails
 */
function fallbackParticipationAnalysis(
  transcript: string,
  participants: Array<{ name: string; email: string | null }>
): ParticipationAnalysisResult {
  const speakerLabels = extractSpeakerLabels(transcript);
  const results: ParticipantAnalysis[] = participants.map((p) => {
    const nameParts = p.name.toLowerCase().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const matchingLabels: string[] = [];
    for (const label of speakerLabels) {
      const labelLower = label.toLowerCase().replace(":", "").trim();
      if (
        labelLower === p.name.toLowerCase() ||
        labelLower === firstName ||
        (lastName && labelLower === lastName) ||
        labelLower.includes(firstName)
      ) {
        matchingLabels.push(label);
      }
    }
    const nameRegex = new RegExp(`\\b${firstName}\\b.*?:`, "i");
    const hasNameMatch = nameRegex.test(transcript) || matchingLabels.length > 0;
    return {
      name: p.name,
      email: p.email,
      participated: hasNameMatch,
      speakerIndicators: matchingLabels,
    };
  });
  return {
    participants: results,
    analyzedSpeakers: speakerLabels,
  };
}

/**
 * Extract speaker labels from transcript using common patterns
 */
function extractSpeakerLabels(transcript: string): string[] {
  const speakerPatterns = [
    /^([A-Z][a-zA-Z\s]+):/gm,
    /^\[([^\]]+)\]/gm,
    /^(Speaker\s*\d+):/gim,
    /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*\(\d{1,2}:\d{2}\)/gm,
  ];
  const speakers = new Set<string>();
  for (const pattern of speakerPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(transcript)) !== null) {
      const speaker = match[1].trim();
      if (speaker.length > 0 && speaker.length < 50) {
        speakers.add(speaker);
      }
    }
  }
  return Array.from(speakers);
}

export { extractSpeakerLabels };
