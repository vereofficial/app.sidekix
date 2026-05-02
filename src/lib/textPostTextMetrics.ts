/**
 * Dynamic type scale for text-only post tiles: short copy reads larger; long copy shrinks
 * so the card doesn’t feel empty or overflow awkwardly. Card size stays fixed.
 * Compact tiles stay readable (no sub‑9px type).
 */
export function textMetricsForLength(length: number, compact: boolean): {
  fontSize: number;
  lineHeight: number;
  maxLines: number;
} {
  if (compact) {
    if (length <= 40) return { fontSize: 11, lineHeight: 15, maxLines: 6 };
    if (length <= 90) return { fontSize: 10, lineHeight: 13, maxLines: 7 };
    return { fontSize: 9, lineHeight: 12, maxLines: 8 };
  }
  if (length <= 45) return { fontSize: 23, lineHeight: 31, maxLines: 7 };
  if (length <= 90) return { fontSize: 20, lineHeight: 28, maxLines: 9 };
  if (length <= 160) return { fontSize: 17, lineHeight: 25, maxLines: 11 };
  if (length <= 260) return { fontSize: 15, lineHeight: 22, maxLines: 13 };
  return { fontSize: 13, lineHeight: 19, maxLines: 16 };
}
