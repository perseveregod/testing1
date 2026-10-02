// First-line content safety for user-written text. It runs on the server for
// every report and update. It is deliberately conservative: it strips personal
// data rather than trusting people not to post it, and it rejects text that
// targets individuals. A production deployment should add a hosted moderation
// model behind `moderateText` (see server/moderation.ts) for nuance.

export const MAX_DESCRIPTION = 280;
export const MAX_UPDATE = 280;

export type ModerationResult =
  | { ok: true; text: string; redacted: boolean }
  | { ok: false; reason: string };

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|ly|gg|me|xyz)\b\S*/gi;
// 7+ digits with common separators: phone numbers, IDs.
const PHONE = /(?:\+?\d[\s().-]*){7,}\d/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const HANDLE = /(^|\s)@[a-z0-9_.]{2,}/gi;
// "123 Main St" style house numbers. Block-level street names are fine.
const HOUSE_NUMBER = /\b\d{2,6}\s+(?=[A-Z][a-z]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place)\b)/g;
// License plates mentioned explicitly.
const PLATE = /\b(plate|license|tag)\s*(?:#|number|no\.?)?\s*[:\-]?\s*[A-Z0-9-]{4,8}\b/gi;

// Phrases that single out a private person. Reports describe events, not people.
const DOXXING = [
  /\b(his|her|their)\s+(name|address|number|phone|instagram|ig|snap|twitter|facebook)\s+is\b/i,
  /\b(lives|living|stays)\s+(at|on|in)\s+(apt|apartment|unit|#|\d)/i,
  /\bname\s*(is|:)\s*[A-Z][a-z]+\s+[A-Z][a-z]+/,
];

const THREATS = [
  /\b(i'?ll|i\s+will|gonna|going\s+to|we\s+will)\s+(kill|shoot|stab|hurt|beat|find)\b/i,
  /\b(kill|shoot|hurt)\s+(yourself|urself|him|her|them)\b/i,
];

// Kept short and non-exhaustive on purpose; extend via a hosted model.
const ABUSIVE = [/\bf+u+c+k+\s*(you|u|off)\b/i, /\bkys\b/i, /\bretard(ed)?\b/i, /\bwhore\b/i];

// Describing people by race/ethnicity in "suspicious" reports drives profiling.
const PROFILING = /\b(black|white|hispanic|latino|latina|asian|arab|mexican|indian|african|middle[-\s]eastern)\s+(guy|man|men|male|woman|women|female|kid|kids|teen|teens|person|people|dude|lady)\b/i;

export function moderateText(input: string, max = MAX_DESCRIPTION): ModerationResult {
  let text = (input ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  text = text.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (text.length > max) return { ok: false, reason: `Keep it under ${max} characters.` };
  if (!text) return { ok: true, text: "", redacted: false };

  for (const re of THREATS) {
    if (re.test(text)) return { ok: false, reason: "Threats aren't allowed." };
  }
  for (const re of ABUSIVE) {
    if (re.test(text)) return { ok: false, reason: "Please keep it respectful." };
  }
  for (const re of DOXXING) {
    if (re.test(text)) {
      return { ok: false, reason: "Don't include names, addresses or contact details of people." };
    }
  }
  if (PROFILING.test(text)) {
    return {
      ok: false,
      reason: "Describe what's happening, not someone's race or ethnicity.",
    };
  }

  // Spam heuristics.
  const letters = text.replace(/[^a-z]/gi, "");
  if (letters.length >= 12 && letters === letters.toUpperCase()) {
    text = text.charAt(0) + text.slice(1).toLowerCase();
  }
  if (/(.)\1{7,}/.test(text)) return { ok: false, reason: "That looks like spam." };

  const before = text;
  text = text
    .replace(EMAIL, "[removed]")
    .replace(URL_RE, "[link removed]")
    .replace(SSN, "[removed]")
    .replace(PHONE, "[removed]")
    .replace(PLATE, "$1 [removed]")
    .replace(HANDLE, "$1[removed]")
    .replace(HOUSE_NUMBER, "");
  return { ok: true, text: text.trim(), redacted: text !== before };
}
