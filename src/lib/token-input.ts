/** Pull a QR token out of whatever was scanned or pasted (a full link or the bare code). */
export function extractToken(input: string): string | null {
  const s = input.trim();
  const m = /(?:^|\/verify\/)([A-Za-z0-9_-]{43})(?:[/?#].*)?$/.exec(s);
  return m ? m[1] : null;
}
