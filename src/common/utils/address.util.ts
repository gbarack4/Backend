export function stripStreetNumber(
  address: string | null | undefined,
): string | null {
  if (!address) return null;

  return address.replace(/^(\d+[a-zA-Z]?\s*[-/]?\s*)+\s*/, '').trim();
}
