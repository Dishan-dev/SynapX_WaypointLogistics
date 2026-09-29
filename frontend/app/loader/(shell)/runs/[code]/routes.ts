// Where "Review & confirm" goes. The page is Sanduni's (L6), and whether it is
// /release or /review is still being agreed, so this is the one place to change.
export function reviewHref(runCode: string): string {
  return `/loader/runs/${encodeURIComponent(runCode)}/release`;
}
