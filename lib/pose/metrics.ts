import { LM, hipCenter, shoulderCenter } from "./landmarks";
import type { FrameMetrics, ImpactReport, PoseFrame } from "./types";
import type { PhaseDetection } from "./phases";
import {
  UP,
  angleABC,
  angleDiff,
  cross,
  dot,
  horizontal,
  length,
  norm,
  sub,
  type Vec3,
} from "./vec";

export type ClipFrame = {
  right: Vec3;
  forward: Vec3;
  up: Vec3;
};

function accumulateAxis(raw: Vec3, acc: Vec3): Vec3 {
  let v = horizontal(raw);
  if (length(v) < 1e-4) return acc;
  if (length(acc) > 1e-4 && dot(v, acc) < 0) v = { x: -v.x, y: 0, z: -v.z };
  return { x: acc.x + v.x, y: 0, z: acc.z + v.z };
}

/**
 * Person frame for the whole clip: +X anatomical right, +Z toward the net, +Y up.
 *
 * Right is the hip line (right hip minus left hip), not the nose. A phone behind
 * the player mirrors image-left and image-right; a nose-derived right axis then
 * flips follow-through. Forward is up × right, then reversed only when the nose
 * sits on the other side, so a pose that already faces +Z stays right-handed.
 * Side or front video later makes the depth axis ("身前") less noisy. Back view
 * is enough for v1.
 */
export function estimateClipFrame(frames: PoseFrame[]): ClipFrame {
  let hipRight = { x: 0, y: 0, z: 0 };
  let shoulderRight = { x: 0, y: 0, z: 0 };
  let nose = { x: 0, y: 0, z: 0 };
  for (const frame of frames) {
    const lm = frame.landmarks;
    hipRight = accumulateAxis(sub(lm[LM.rHip], lm[LM.lHip]), hipRight);
    shoulderRight = accumulateAxis(sub(lm[LM.rShoulder], lm[LM.lShoulder]), shoulderRight);
    nose = accumulateAxis(sub(lm[LM.nose], hipCenter(lm)), nose);
  }
  const lateral = length(hipRight) >= 1e-4 ? hipRight : shoulderRight;
  const right = length(lateral) >= 1e-4 ? norm(horizontal(lateral)) : { x: 1, y: 0, z: 0 };
  let forward = norm(horizontal(cross(UP, right)));
  if (length(forward) < 1e-4) forward = { x: 0, y: 0, z: 1 };
  if (length(nose) > 1e-4 && dot(horizontal(nose), forward) < 0) {
    forward = { x: -forward.x, y: 0, z: -forward.z };
  }
  return { right, forward, up: UP };
}

export function toLocal(point: Vec3, origin: Vec3, clip: ClipFrame): Vec3 {
  const d = sub(point, origin);
  return {
    x: dot(d, clip.right),
    y: dot(d, clip.up),
    z: dot(d, clip.forward),
  };
}

function lineYaw(from: Vec3, to: Vec3): number {
  const d = horizontal(sub(to, from));
  return Math.atan2(d.z, d.x);
}

export function frameMetrics(pose: Vec3[], clip: ClipFrame): FrameMetrics {
  const hip = hipCenter(pose);
  const shoulder = shoulderCenter(pose);
  const spine = sub(shoulder, hip);
  const lean = (Math.atan2(dot(spine, clip.forward), dot(spine, clip.up)) * 180) / Math.PI;
  const wrist = pose[LM.rWrist];
  const local = toLocal(wrist, hip, clip);
  return {
    torsoLeanDeg: lean,
    kneeDeg: angleABC(pose[LM.rHip], pose[LM.rKnee], pose[LM.rAnkle]),
    elbowDeg: angleABC(pose[LM.rShoulder], pose[LM.rElbow], pose[LM.rWrist]),
    handHeightCm: local.y * 100,
    contactFrontCm: local.z * 100,
    contactLateralCm: Math.abs(local.x) * 100,
  };
}

function travelDeg(frames: PoseFrame[], indexA: number, indexB: number, from: number, to: number): number {
  const a = lineYaw(frames[indexA].landmarks[from], frames[indexA].landmarks[to]);
  const b = lineYaw(frames[indexB].landmarks[from], frames[indexB].landmarks[to]);
  return (Math.abs(angleDiff(b, a)) * 180) / Math.PI;
}

export function buildReport(
  frames: PoseFrame[],
  metrics: FrameMetrics[],
  phase: PhaseDetection,
  clip: ClipFrame,
  stroke: "forehand" | "backhand",
): ImpactReport {
  const impact = phase.impactFrame;
  const back = phase.backFrame;
  const end = frames.length - 1;
  const hipTravelDeg = travelDeg(frames, back, impact, LM.lHip, LM.rHip);
  const shoulderTravelDeg = travelDeg(frames, back, impact, LM.lShoulder, LM.rShoulder);
  const hipYaw = lineYaw(frames[back].landmarks[LM.lHip], frames[back].landmarks[LM.rHip]);
  const shoYaw = lineYaw(frames[back].landmarks[LM.lShoulder], frames[back].landmarks[LM.rShoulder]);
  const separationDeg = (Math.abs(angleDiff(shoYaw, hipYaw)) * 180) / Math.PI;

  const impactHip = hipCenter(frames[impact].landmarks);
  const endHip = hipCenter(frames[end].landmarks);
  const impactLocal = toLocal(frames[impact].landmarks[LM.rWrist], impactHip, clip);
  const endLocal = toLocal(frames[end].landmarks[LM.rWrist], endHip, clip);
  const followCrossCm =
    stroke === "forehand"
      ? (impactLocal.x - endLocal.x) * 100
      : (endLocal.x - impactLocal.x) * 100;
  const followRiseCm = (endLocal.y - impactLocal.y) * 100;

  return {
    ...metrics[impact],
    hipTravelDeg,
    shoulderTravelDeg,
    separationDeg,
    followCrossCm,
    followRiseCm,
  };
}
