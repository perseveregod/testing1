import { getCategory, SEVERITY_RANK } from "./categories";
import type { CategoryId, Severity } from "./types";

// Keyword nudges on top of a category's default severity. User reports can
// raise severity at most to "high"; "critical" is reserved for official
// sources or community-confirmed escalation, so one person can't trigger
// critical alerts for a whole area.

const ESCALATE: RegExp[] = [
  /\b(shots?\s+fired|gunshots?|shooting|explosion|explod|trapped|collapse|evacuat)/i,
  /\b(multiple|several)\s+(vehicles|cars|people|injur)/i,
  /\b(spreading|fully\s+engulfed|structure\s+fire|wildfire)/i,
];

const SOFTEN: RegExp[] = [/\b(minor|small|no\s+injur|cleared|just\s+a)\b/i];

export function estimateSeverity(category: CategoryId, description: string): Severity {
  let rank = SEVERITY_RANK[getCategory(category).defaultSeverity];
  if (ESCALATE.some((re) => re.test(description))) rank += 1;
  if (SOFTEN.some((re) => re.test(description))) rank -= 1;
  rank = Math.max(0, Math.min(2, rank));
  return (["low", "moderate", "high"] as const)[rank];
}

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}
