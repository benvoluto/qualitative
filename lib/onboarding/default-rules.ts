/**
 * Default extract rules seeded for new accounts during onboarding.
 *
 * Each rule's `summary` is the prompt the LLM follows when looking for matching
 * insights. `quotes` are example phrasings that help the LLM calibrate.
 * The user can skip, edit, or add to these from the onboarding screen, and
 * later from the /extract-rules page.
 */

export interface DefaultRule {
  /** Stable key used in the onboarding UI to identify the rule */
  key: string;
  name: string;
  summary: string;
  quotes: string[];
  /** System tags this rule should be associated with (created lazily) */
  tags: string[];
}

export const DEFAULT_RULES: DefaultRule[] = [
  {
    key: "feature_requests",
    name: "Feature Requests",
    summary:
      "Extract any requests for features, capabilities, or changes that don't exist yet. Listen for phrases like 'I wish it could…', 'It would be great if…', 'Can you add…', 'Why can't I…'. Capture both the requested feature and the underlying problem the user is trying to solve.",
    quotes: [
      "It would be great if we could export this to CSV",
      "I wish there was a way to filter by date range",
      "Can you add SSO support? Our IT team requires it",
    ],
    tags: ["feature_request"],
  },
  {
    key: "bug_reports",
    name: "Bug Reports & Complaints",
    summary:
      "Extract anything broken, frustrating, or not working as expected. Includes UI issues, crashes, slow performance, confusing behavior, and complaints. Capture what they were trying to do, what actually happened, and how often it occurs if mentioned.",
    quotes: [
      "It keeps timing out when I upload a large file",
      "I clicked save but nothing happened",
      "The search results are usually wrong",
    ],
    tags: ["bug_report"],
  },
  {
    key: "positive_feedback",
    name: "Positive Feedback",
    summary:
      "Extract praise, compliments, or descriptions of features the customer finds valuable. Useful for case studies, testimonials, and understanding what's working well.",
    quotes: [
      "Honestly this has saved my team hours every week",
      "I love how fast the search is",
      "This is exactly what we were missing",
    ],
    tags: ["positive_feedback"],
  },
  {
    key: "competitive_mentions",
    name: "Competitive & Vendor Mentions",
    summary:
      "Extract any mentions of competitors, alternative products the customer is using, has tried, or is evaluating. Capture the competitor name, what the customer said about them (sentiment), and any feature comparisons.",
    quotes: [
      "We tried [Competitor] last year but the onboarding was painful",
      "Our other team uses [Competitor] for this",
      "How does this compare to [Competitor]?",
    ],
    tags: ["competitive_mention"],
  },
  {
    key: "action_items",
    name: "Action Items & Commitments",
    summary:
      "Extract concrete next steps, commitments, or follow-ups that anyone (your team or the customer) agreed to during the meeting. Each action item should have a clear owner and ideally a timeframe.",
    quotes: [
      "I'll send over the pricing breakdown by Friday",
      "Can you loop in your CTO before our next call?",
      "We'll have a decision by end of next week",
    ],
    tags: ["action_item"],
  },
];
