/** Map stored category tokens to friendlier chip labels (legacy DB rows use `legacy`). */
export function displayCategoryChip(raw: string): string {
  const k = raw.toLowerCase();
  if (k === 'legacy' || k === 'classic') return 'earlier';
  return raw;
}

/**
 * Emoji for feed category pills (screenshot-style). Unknown tokens fall back to ✨ so Supabase-added tags still read well.
 */
export function categoryChipEmoji(raw: string): string {
  const key = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  const map: Record<string, string> = {
    'food/drink': '🍜',
    'food / drink': '🍜',
    food: '🍜',
    drink: '🍹',
    outdoor: '🌲',
    social: '🤝',
    trend: '📈',
    creative: '🎨',
    chaotic: '🌀',
    legacy: '🌌',
    earlier: '🌌',
    classic: '🌌',
    explore: '🏙️',
    solo: '🧘',
    group: '👥',
    campus: '🏫',
    music: '🎵',
    art: '🖼️',
    fitness: '💪',
  };
  if (map[key]) return map[key];
  /** Try last segment after slash */
  const tail = key.split('/').pop() ?? key;
  if (map[tail]) return map[tail];
  return '✨';
}

/** Emoji + lowercase label for home feed pills. */
export function feedCategoryChipParts(raw: string): { emoji: string; title: string } {
  const title = displayCategoryChip(raw).toLowerCase();
  return { emoji: categoryChipEmoji(raw), title };
}
