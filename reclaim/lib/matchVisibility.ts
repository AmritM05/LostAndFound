// Candidate visibility is separate from student notification strength.
export const MIN_MATCH_SCORE = 50;
export const MIN_MATCH_NOTICE_SCORE = 60;

export function isPotentialMatch(match: {
  score: number;
  dismissed?: boolean;
  staff_reasoning?: { eligible?: boolean; classification?: string } | null;
}) {
  return Number.isFinite(match.score) && match.score >= MIN_MATCH_SCORE &&
    !match.dismissed && match.staff_reasoning?.eligible !== false &&
    match.staff_reasoning?.classification !== "no_match";
}
export function rankPotentialMatches<T extends Parameters<typeof isPotentialMatch>[0] & { id: string }>(matches: T[]): T[] {
  return matches.filter(isPotentialMatch).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
