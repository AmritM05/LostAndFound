// Render only inside the staff workspace; never import into a student/public DTO.
const labels: Record<string, string> = {
  very_strong_match: "Strong potential match",
  strong_match: "Strong potential match",
  possible_match: "Possible match",
  weak_match: "Weak potential match",
  no_match: "No match",
};
export function staffAssessment(value: unknown) {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const strings = (value: unknown) => Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && !!entry.trim()).slice(0, 20) : [];
  const contradictions = strings(data.contradictions);
  const label = data.eligible === false || contradictions.length ? "No match"
    : typeof data.classification === "string" ? labels[data.classification] : undefined;
  return { label: label || "Assessment unavailable for this historical match", contradictions,
    factors: strings(data.matchingFactors) };
}
export default function StaffMatchAssessment({ reasoning }: { reasoning: unknown }) {
  const assessment = staffAssessment(reasoning);
  return <div className="staff-help" aria-label="Private staff matching assessment">
    <strong>{assessment.label}</strong>
    {assessment.contradictions.length > 0 && <ul>{assessment.contradictions.map((text, index) => <li key={index}>{text}</li>)}</ul>}
    {assessment.factors.length > 0 && <p>{assessment.factors.join(" · ")}</p>}
    <p>Heuristic ranking only. Staff must verify ownership independently.</p>
  </div>;
}
