export const W = { walkable: true };
export const X = { walkable: false };

export function wallRow(): (typeof W)[] {
  return Array(20).fill(X);
}

export function corridorRow(): (typeof W)[] {
  return Array(20).fill(W);
}

/** Maps a compact "#"/"." row string (wall/walkable) to a tile row — far easier to
 * author and review for a large branching layout than dozens of index calls. */
export function rowFromPattern(pattern: string): (typeof W)[] {
  return pattern.split("").map((ch) => (ch === "#" ? X : W));
}
