export const W = { walkable: true };
export const X = { walkable: false };

export function wallRow(): (typeof W)[] {
  return Array(20).fill(X);
}

export function corridorRow(): (typeof W)[] {
  return Array(20).fill(W);
}
