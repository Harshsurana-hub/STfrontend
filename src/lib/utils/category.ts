/**
 * Maps a course category string to its fallback emoji.
 * Used when no thumbnail is available.
 */
export function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    'Tailoring': '🧵',
    'Baking': '🍰',
    'Photography': '📷',
    'Makeup Artistry': '💄',
    'Hairstyling': '💇',
    'Nail Technology': '💅',
  };
  return map[category] ?? '🎓';
}
