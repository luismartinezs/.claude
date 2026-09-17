export const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;

export function getScrollPercent(
  scrollTop: number,
  scrollableHeight: number,
): number {
  if (scrollableHeight <= 0) return 100;
  return Math.round((scrollTop / scrollableHeight) * 100);
}

export function getNewThresholds(
  percent: number,
  firedThresholds: ReadonlySet<number>,
): number[] {
  return SCROLL_THRESHOLDS.filter(
    (t) => percent >= t && !firedThresholds.has(t),
  );
}

export function allThresholdsFired(
  firedThresholds: ReadonlySet<number>,
): boolean {
  return firedThresholds.size >= SCROLL_THRESHOLDS.length;
}
