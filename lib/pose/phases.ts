import { LM } from "./landmarks";
import type { PhaseName, PhaseSpan, PoseFrame } from "./types";
import { add, dot, length, norm, scale, sub, type Vec3 } from "./vec";

export type PhaseDetection = {
  impactFrame: number;
  backFrame: number;
  followFrame: number;
  phases: PhaseSpan[];
  peakSpeed: number;
};

function smoothPoints(points: Vec3[], radius: number): Vec3[] {
  return points.map((_, i) => {
    let acc = { x: 0, y: 0, z: 0 };
    let n = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = Math.min(points.length - 1, Math.max(0, i + k));
      acc = add(acc, points[j]);
      n += 1;
    }
    return scale(acc, 1 / n);
  });
}

/**
 * Impact is the dominant wrist's speed peak.
 * Takeback is the point furthest against the swing direction before that peak.
 * Follow-through starts once the wrist has clearly slowed after contact.
 */
export function detectPhases(frames: PoseFrame[]): PhaseDetection {
  const n = frames.length;
  const raw = frames.map((f) => f.landmarks[LM.rWrist]);
  const pos = smoothPoints(raw, 2);
  const speed = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i += 1) {
    const dt = Math.max(1 / 120, frames[i].t - frames[i - 1].t);
    speed[i] = length(sub(pos[i], pos[i - 1])) / dt;
  }

  const lo = Math.max(1, Math.floor(n * 0.1));
  const hi = Math.min(n - 1, Math.ceil(n * 0.9));
  let peakIdx = lo;
  for (let i = lo; i <= hi; i += 1) {
    if (speed[i] > speed[peakIdx]) peakIdx = i;
  }
  // Contact is the end of the fast burst, not the first time speed spikes mid-swing.
  let impact = peakIdx;
  const peak = speed[peakIdx];
  for (let i = peakIdx + 1; i <= hi; i += 1) {
    if (speed[i] < peak * 0.5) break;
    if (speed[i] >= peak * 0.82) impact = i;
  }

  const velStart = Math.max(1, impact - 2);
  let vel = { x: 0, y: 0, z: 0 };
  for (let i = velStart; i <= impact; i += 1) vel = add(vel, sub(pos[i], pos[i - 1]));
  if (length(vel) < 1e-5) vel = sub(pos[impact], pos[0]);
  const dir = norm(vel);

  let back = 0;
  let best = Infinity;
  const backLimit = Math.max(0, impact - 1);
  for (let i = 0; i <= backLimit; i += 1) {
    const proj = length(dir) < 1e-6 ? pos[i].z : dot(pos[i], dir);
    if (proj < best) {
      best = proj;
      back = i;
    }
  }
  if (back >= impact) back = Math.max(0, impact - 1);

  let follow = Math.min(n - 1, impact + 1);
  let slowed = false;
  for (let i = impact + 1; i < n; i += 1) {
    if (speed[i] < peak * 0.45) {
      follow = i;
      slowed = true;
      break;
    }
    follow = i;
  }
  if (!slowed && n - impact > 4) {
    follow = impact + Math.max(1, Math.round((n - 1 - impact) * 0.28));
  }
  follow = Math.min(n - 1, Math.max(impact + 1, follow));

  const phases: PhaseSpan[] = [
    { name: "backswing", start: 0, end: back + 1 },
    { name: "impact", start: back + 1, end: follow },
    { name: "follow", start: follow, end: n },
  ];

  return {
    impactFrame: impact,
    backFrame: back,
    followFrame: follow,
    phases,
    peakSpeed: peak,
  };
}

export function phaseAt(phases: PhaseSpan[], index: number): PhaseName {
  for (const phase of phases) {
    if (index >= phase.start && index < phase.end) return phase.name;
  }
  return "follow";
}

export function phasesCover(phases: PhaseSpan[], frameCount: number): boolean {
  if (phases.length === 0 || phases[0].start !== 0) return false;
  if (phases[phases.length - 1].end !== frameCount) return false;
  for (let i = 0; i < phases.length; i += 1) {
    if (phases[i].end <= phases[i].start) return false;
    if (i > 0 && phases[i].start !== phases[i - 1].end) return false;
  }
  return true;
}
