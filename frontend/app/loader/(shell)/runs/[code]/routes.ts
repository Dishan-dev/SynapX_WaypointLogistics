// Where "Review & confirm" goes: Sanduni's confirm & release page (L6).
// The one place to change it if the route moves again.
export function reviewHref(runCode: string): string {
  return `/loader/runs/${encodeURIComponent(runCode)}/review`;
}
