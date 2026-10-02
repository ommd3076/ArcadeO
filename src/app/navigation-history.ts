// A document may have browser history from another site. Only routes observed by
// this router are eligible for the app's Back control.
const visitedIndices = new Set<number>();

export function rememberAppLocation(): void {
  if (typeof window === "undefined") return;
  const index: unknown = window.history.state?.idx;
  if (typeof index === "number") visitedIndices.add(index);
}

export function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;
  const index: unknown = window.history.state?.idx;
  return typeof index === "number" && visitedIndices.has(index - 1);
}
