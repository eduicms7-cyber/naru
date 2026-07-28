export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (!tag || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}
