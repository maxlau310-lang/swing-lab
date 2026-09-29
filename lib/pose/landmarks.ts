import { add, cloneVec, mid, scale, sub, type Vec3 } from "./vec";

/** MediaPipe Pose landmark indices (33 points). */
export const LM = {
  nose: 0,
  lEyeIn: 1,
  lEye: 2,
  lEyeOut: 3,
  rEyeIn: 4,
  rEye: 5,
  rEyeOut: 6,
  lEar: 7,
  rEar: 8,
  lMouth: 9,
  rMouth: 10,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lPinky: 17,
  rPinky: 18,
  lIndex: 19,
  rIndex: 20,
  lThumb: 21,
  rThumb: 22,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
  lHeel: 29,
  rHeel: 30,
  lFoot: 31,
  rFoot: 32,
} as const;

export const LANDMARK_COUNT = 33;

/** Left/right pairs. Index 0 (nose) is not swapped. */
export const LR_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 4],
  [2, 5],
  [3, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 26],
  [27, 28],
  [29, 30],
  [31, 32],
];

export const BONES: ReadonlyArray<readonly [number, number]> = [
  [LM.lShoulder, LM.rShoulder],
  [LM.lShoulder, LM.lElbow],
  [LM.lElbow, LM.lWrist],
  [LM.rShoulder, LM.rElbow],
  [LM.rElbow, LM.rWrist],
  [LM.lShoulder, LM.lHip],
  [LM.rShoulder, LM.rHip],
  [LM.lHip, LM.rHip],
  [LM.lHip, LM.lKnee],
  [LM.lKnee, LM.lAnkle],
  [LM.rHip, LM.rKnee],
  [LM.rKnee, LM.rAnkle],
  [LM.lAnkle, LM.lFoot],
  [LM.rAnkle, LM.rFoot],
];

export const JOINTS = [
  LM.lShoulder,
  LM.rShoulder,
  LM.lElbow,
  LM.rElbow,
  LM.lWrist,
  LM.rWrist,
  LM.lHip,
  LM.rHip,
  LM.lKnee,
  LM.rKnee,
  LM.lAnkle,
  LM.rAnkle,
] as const;

export type Dominant = {
  shoulder: number;
  elbow: number;
  wrist: number;
  hip: number;
  knee: number;
  ankle: number;
};

/** Pipeline always runs in right-handed space. Display uses the player's real hand. */
export function dominantSide(hand: "left" | "right"): Dominant {
  if (hand === "left") {
    return {
      shoulder: LM.lShoulder,
      elbow: LM.lElbow,
      wrist: LM.lWrist,
      hip: LM.lHip,
      knee: LM.lKnee,
      ankle: LM.lAnkle,
    };
  }
  return {
    shoulder: LM.rShoulder,
    elbow: LM.rElbow,
    wrist: LM.rWrist,
    hip: LM.rHip,
    knee: LM.rKnee,
    ankle: LM.rAnkle,
  };
}

export function emptyPose(): Vec3[] {
  return Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0 }));
}

export function clonePose(pose: Vec3[]): Vec3[] {
  return pose.map(cloneVec);
}

/**
 * Turn a left-handed capture into right-handed analysis space, and back.
 * Negate X and swap left/right landmarks so the dominant hand lands on the right indices.
 */
export function mirrorPose(pose: Vec3[]): Vec3[] {
  const out = pose.map((p) => ({ x: -p.x, y: p.y, z: p.z }));
  for (const [a, b] of LR_PAIRS) {
    const tmp = out[a];
    out[a] = out[b];
    out[b] = tmp;
  }
  return out;
}

export function hipCenter(pose: Vec3[]): Vec3 {
  return mid(pose[LM.lHip], pose[LM.rHip]);
}

export function shoulderCenter(pose: Vec3[]): Vec3 {
  return mid(pose[LM.lShoulder], pose[LM.rShoulder]);
}

export function plantPose(pose: Vec3[]): Vec3[] {
  let ground = Infinity;
  for (const i of [LM.lAnkle, LM.rAnkle, LM.lFoot, LM.rFoot]) {
    ground = Math.min(ground, pose[i].y);
  }
  if (!Number.isFinite(ground)) return pose;
  return pose.map((p) => ({ x: p.x, y: p.y - ground, z: p.z }));
}

export function torsoLength(pose: Vec3[]): number {
  return Math.hypot(
    shoulderCenter(pose).x - hipCenter(pose).x,
    shoulderCenter(pose).y - hipCenter(pose).y,
    shoulderCenter(pose).z - hipCenter(pose).z,
  );
}

export function addScaled(origin: Vec3, dir: Vec3, amount: number): Vec3 {
  return add(origin, scale(dir, amount));
}

export function posePoint(pose: Vec3[], index: number): Vec3 {
  return pose[index] ?? { x: 0, y: 0, z: 0 };
}

export function translatePose(pose: Vec3[], delta: Vec3): Vec3[] {
  return pose.map((p) => add(p, delta));
}

export function scalePose(pose: Vec3[], s: number): Vec3[] {
  return pose.map((p) => scale(p, s));
}

export function delta(a: Vec3, b: Vec3): Vec3 {
  return sub(a, b);
}
