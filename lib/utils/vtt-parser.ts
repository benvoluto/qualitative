/**
 * Parse VTT (WebVTT) subtitle format to plain text
 * VTT format is used by both Zoom and Microsoft Teams for transcripts
 */
export function parseVttToText(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];
  let isTextLine = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and reset state
    if (!trimmed) {
      isTextLine = false;
      continue;
    }

    // Skip WEBVTT header
    if (trimmed.startsWith("WEBVTT")) {
      continue;
    }

    // Skip NOTE comments
    if (trimmed.startsWith("NOTE")) {
      continue;
    }

    // Skip cue identifiers (numeric or alphanumeric)
    if (/^\d+$/.test(trimmed) || /^[a-zA-Z0-9-]+$/.test(trimmed)) {
      continue;
    }

    // Skip timestamp lines (e.g., "00:00:00.000 --> 00:00:05.000")
    if (trimmed.includes("-->")) {
      isTextLine = true;
      continue;
    }

    // If we're after a timestamp line, this is text content
    if (isTextLine) {
      // Remove VTT formatting tags like <v Speaker Name>, </v>, <c>, etc.
      let text = trimmed
        .replace(/<v\s+[^>]*>/gi, "") // <v Speaker Name>
        .replace(/<\/v>/gi, "") // </v>
        .replace(/<c[^>]*>/gi, "") // <c.class>
        .replace(/<\/c>/gi, "") // </c>
        .replace(/<[^>]+>/g, ""); // Any other tags

      // Clean up any double spaces
      text = text.replace(/\s+/g, " ").trim();

      if (text) {
        textLines.push(text);
      }
    }
  }

  // Join all text lines and clean up duplicates that might occur at cue boundaries
  return deduplicateTranscriptLines(textLines);
}

/**
 * Remove duplicate lines that often occur at VTT cue boundaries
 * VTT files often have overlapping text for smooth subtitle display
 */
function deduplicateTranscriptLines(lines: string[]): string {
  if (lines.length === 0) return "";

  const result: string[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const current = lines[i];
    const previous = result[result.length - 1];

    // Skip if current line is contained in previous (partial overlap)
    if (previous.includes(current)) {
      continue;
    }

    // If previous is contained in current, replace it (continuation)
    if (current.includes(previous)) {
      result[result.length - 1] = current;
      continue;
    }

    // Otherwise, add as new line
    result.push(current);
  }

  return result.join(" ");
}

/**
 * Extract speaker-attributed transcript from VTT with speaker tags
 * Returns formatted text like "Speaker Name: Their words..."
 */
export function parseVttWithSpeakers(vtt: string): string {
  const lines = vtt.split("\n");
  const segments: { speaker: string; text: string }[] = [];
  let currentSpeaker = "";
  let isTextLine = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      isTextLine = false;
      continue;
    }

    if (trimmed.startsWith("WEBVTT") || trimmed.startsWith("NOTE")) {
      continue;
    }

    if (/^\d+$/.test(trimmed) || /^[a-zA-Z0-9-]+$/.test(trimmed)) {
      continue;
    }

    if (trimmed.includes("-->")) {
      isTextLine = true;
      continue;
    }

    if (isTextLine) {
      // Extract speaker from <v Speaker Name> tag
      const speakerMatch = trimmed.match(/<v\s+([^>]+)>/i);
      if (speakerMatch) {
        currentSpeaker = speakerMatch[1].trim();
      }

      // Clean text
      const text = trimmed
        .replace(/<v\s+[^>]*>/gi, "")
        .replace(/<\/v>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (text) {
        segments.push({ speaker: currentSpeaker, text });
      }
    }
  }

  // Format with speaker attribution
  if (segments.length === 0) return "";

  const result: string[] = [];
  let lastSpeaker = "";

  for (const segment of segments) {
    if (segment.speaker && segment.speaker !== lastSpeaker) {
      result.push(`\n${segment.speaker}: ${segment.text}`);
      lastSpeaker = segment.speaker;
    } else {
      // Continuation of same speaker
      if (result.length > 0) {
        result[result.length - 1] += ` ${segment.text}`;
      } else {
        result.push(segment.text);
      }
    }
  }

  return result.join("").trim();
}
