/** Mirrors `generate_sidekix_username()` in SQL for client-side profile bootstrap. */
const ADJ = [
  'swift',
  'bold',
  'neon',
  'soft',
  'wild',
  'tiny',
  'cool',
  'rapid',
  'lucky',
  'cosmic',
  'vivid',
  'quiet',
  'bright',
  'mellow',
  'sunny',
] as const;
const NOUN = [
  'mochi',
  'pixel',
  'echo',
  'nova',
  'fern',
  'comet',
  'orbit',
  'plaza',
  'vibe',
  'spark',
  'lumen',
  'ripple',
  'dusk',
  'ember',
  'fable',
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateSidekixUsername(): string {
  const n = Math.floor(Math.random() * 90) + 10;
  return `${pick(ADJ)}_${pick(NOUN)}${String(n).padStart(2, '0')}`;
}
