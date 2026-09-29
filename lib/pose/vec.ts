export type Vec3 = { x: number; y: number; z: number };

export const UP: Vec3 = { x: 0, y: 1, z: 0 };

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function norm(a: Vec3): Vec3 {
  const len = length(a);
  if (len < 1e-8) return { x: 0, y: 0, z: 0 };
  return scale(a, 1 / len);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return add(a, scale(sub(b, a), t));
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function horizontal(a: Vec3): Vec3 {
  return { x: a.x, y: 0, z: a.z };
}

export function mid(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function dist(a: Vec3, b: Vec3): number {
  return length(sub(a, b));
}

/** Right-handed yaw around +Y. Positive yaw swings the person's right side backward. */
export function rotY(p: Vec3, yaw: number): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: c * p.x + s * p.z, y: p.y, z: -s * p.x + c * p.z };
}

export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Interior angle in degrees at point b, formed by points a-b-c. 180 = straight. */
export function angleABC(a: Vec3, b: Vec3, c: Vec3): number {
  const u = sub(a, b);
  const w = sub(c, b);
  const lu = length(u);
  const lw = length(w);
  if (lu < 1e-6 || lw < 1e-6) return 0;
  const d = clamp(dot(u, w) / (lu * lw), -1, 1);
  return (Math.acos(d) * 180) / Math.PI;
}

export function cloneVec(p: Vec3): Vec3 {
  return { x: p.x, y: p.y, z: p.z };
}
