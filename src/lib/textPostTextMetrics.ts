/**
 * Dynamic type scale for text-only post tiles: short copy reads larger; long copy shrinks
 * so the card doesn’t feel empty or overflow awkwardly. Card size stays fixed.
 */
export function textMetricsForLength(length: number, compact: boolean): {
  fontSize: number;
  lineHeight: number;
  maxLines: number;
} {
  if (compact) {
    if (length <= 40) return { fontSize: 9, lineHeight: 12, maxLines: 6 };
    if (length <= 90) return { fontSize: 8, lineHeight: 11, maxLines: 7 };
    return { fontSize: 7, lineHeight: 10, maxLines: 8 };
  }
  if (length <= 45) return { fontSize: 22, lineHeight: 30, maxLines: 8 };
  if (length <= 90) return { fontSize: 19, lineHeight: 26, maxLines: 10 };
  if (length <= 160) return { fontSize: 16, lineHeight: 23, maxLines: 12 };
  if (length <= 260) return { fontSize: 14, lineHeight: 20, maxLines: 14 };
  return { fontSize: 12, lineHeight: 17, maxLines: 18 };
}
