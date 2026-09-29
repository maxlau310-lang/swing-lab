import { buildBody, type BodyParams } from "./body";
import type { Stroke } from "./types";
import { lerp, lerpVec, norm, type Vec3 } from "./vec";

export type Keyframe = { at: number; params: BodyParams };

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function k(
  at: number,
  lean: number,
  hip: number,
  sho: number,
  knee: number,
  domElbow: number,
  dx: number,
  dy: number,
  dz: number,
  offElbow: number,
  ox: number,
  oy: number,
  oz: number,
): Keyframe {
  return {
    at,
    params: {
      lean: rad(lean),
      hipYaw: rad(hip),
      shoYaw: rad(sho),
      knee: rad(knee),
      domElbowDeg: domElbow,
      domAim: { x: dx, y: dy, z: dz },
      offElbowDeg: offElbow,
      offAim: { x: ox, y: oy, z: oz },
    },
  };
}

/**
 * Phase coordinate p: 0 ready, 0.62 takeback, 1 impact, 2 follow-through end.
 * Aims are in net space (+Z toward the net, +X the person's right, +Y up).
 */
const FOREHAND_IDEAL: Keyframe[] = [
  k(0, 8, 6, 14, 22, 150, 0.2, -0.45, 0.35, 145, 0.35, -0.15, 0.7),
  k(0.62, 10, 34, 62, 26, 92, 0.05, 0.25, -1, 140, 0.15, 0.35, 0.85),
  k(0.78, 16, -4, 10, 24, 150, 0.32, -0.02, 0.72, 148, 0.05, 0.1, 0.4),
  k(0.86, 18, -18, -2, 24, 162, 0.3, -0.05, 1, 150, -0.15, -0.05, 0.35),
  k(1, 18, -18, -2, 24, 162, 0.3, -0.05, 1, 150, -0.15, -0.05, 0.35),
  k(1.35, 12, -30, -28, 18, 154, -0.25, 0.55, 0.45, 145, -0.35, 0.05, 0.05),
  k(2, 8, -36, -42, 14, 148, -0.9, 0.75, -0.05, 140, -0.2, -0.1, -0.15),
];

const FOREHAND_FLAWED: Keyframe[] = [
  k(0, 3, 2, 5, 6, 148, 0.15, -0.55, 0.2, 150, 0.1, -0.25, 0.25),
  k(0.62, 4, 8, 16, 6, 100, 0.2, 0.35, -0.4, 150, 0.05, 0.1, 0.2),
  k(0.78, 4, 4, 9, 5, 108, 0.16, -0.35, 0.05, 150, 0.02, -0.1, 0.1),
  k(0.86, 4, 3, 8, 5, 112, 0.16, -0.55, 0.08, 150, 0.02, -0.12, 0.1),
  k(1, 4, 3, 8, 5, 112, 0.16, -0.55, 0.08, 150, 0.02, -0.12, 0.1),
  k(2, 3, 1, 5, 5, 126, 0.1, -0.05, 0.16, 148, 0, -0.12, 0.06),
];

const BACKHAND_IDEAL: Keyframe[] = [
  k(0, 8, 0, 4, 22, 140, 0.08, -0.25, 0.4, 138, 0.2, -0.15, 0.45),
  k(0.62, 10, -30, -52, 26, 104, -0.65, 0.1, -0.75, 110, -0.25, 0.15, -0.45),
  k(0.78, 14, 2, 0, 24, 122, -0.05, 0.02, 0.7, 126, 0.08, 0.08, 0.65),
  k(0.86, 15, 10, 6, 24, 128, 0.02, -0.02, 1, 132, 0.18, 0.05, 0.95),
  k(1, 15, 10, 6, 24, 128, 0.02, -0.02, 1, 132, 0.18, 0.05, 0.95),
  k(1.4, 12, 22, 24, 18, 120, 0.4, 0.7, 0.25, 124, 0.22, 0.6, 0.15),
  k(2, 8, 28, 34, 16, 116, 0.55, 0.95, 0.05, 118, 0.3, 0.8, 0.02),
];

const BACKHAND_FLAWED: Keyframe[] = [
  k(0, 3, 0, 2, 22, 130, 0.05, -0.3, 0.2, 130, 0.1, -0.2, 0.25),
  k(0.62, 3, -6, -10, 22, 118, -0.15, -0.1, -0.2, 120, -0.05, -0.05, -0.08),
  k(0.78, 3, -3, -5, 22, 116, 0.02, -0.25, 0.02, 120, 0.04, -0.12, 0.04),
  k(0.86, 3, -2, -4, 22, 116, 0.02, -0.22, 0.08, 120, 0.05, -0.1, 0.06),
  k(1, 3, -2, -4, 22, 116, 0.02, -0.22, 0.08, 120, 0.05, -0.1, 0.06),
  k(2, 2, 0, -1, 18, 120, 0.06, -0.05, 0.1, 122, 0.04, -0.02, 0.06),
];

const LIBRARY: Record<Stroke, Record<"ideal" | "flawed", Keyframe[]>> = {
  forehand: { ideal: FOREHAND_IDEAL, flawed: FOREHAND_FLAWED },
  backhand: { ideal: BACKHAND_IDEAL, flawed: BACKHAND_FLAWED },
};

export function lerpParams(a: BodyParams, b: BodyParams, t: number): BodyParams {
  return {
    lean: lerp(a.lean, b.lean, t),
    hipYaw: lerp(a.hipYaw, b.hipYaw, t),
    shoYaw: lerp(a.shoYaw, b.shoYaw, t),
    knee: lerp(a.knee, b.knee, t),
    domElbowDeg: lerp(a.domElbowDeg, b.domElbowDeg, t),
    domAim: norm(lerpVec(a.domAim, b.domAim, t)),
    offElbowDeg: lerp(a.offElbowDeg, b.offElbowDeg, t),
    offAim: norm(lerpVec(a.offAim, b.offAim, t)),
  };
}

export function sampleParams(keys: Keyframe[], p: number): BodyParams {
  if (p <= keys[0].at) return keys[0].params;
  const last = keys[keys.length - 1];
  if (p >= last.at) return last.params;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].at < p) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.at - a.at || 1;
  const t = (p - a.at) / span;
  return lerpParams(a.params, b.params, t);
}

export function bodyAt(stroke: Stroke, kind: "ideal" | "flawed", p: number): Vec3[] {
  return buildBody(sampleParams(LIBRARY[stroke][kind], p));
}

/** Map a user frame onto the template coordinate used by the keyframes above. */
export function alignPhase(index: number, backFrame: number, impactFrame: number, frameCount: number): number {
  const last = Math.max(1, frameCount - 1);
  if (index <= backFrame) {
    if (backFrame <= 0) return 0;
    return (index / backFrame) * 0.62;
  }
  if (index <= impactFrame) {
    const span = Math.max(1, impactFrame - backFrame);
    return 0.62 + ((index - backFrame) / span) * 0.38;
  }
  const span = Math.max(1, last - impactFrame);
  return 1 + ((index - impactFrame) / span) * 1;
}
