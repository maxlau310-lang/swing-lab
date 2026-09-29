import { LM, emptyPose } from "./landmarks";
import {
  UP,
  add,
  angleABC,
  cross,
  length,
  norm,
  rotY,
  scale,
  sub,
  type Vec3,
} from "./vec";

/** Reference stick-figure proportions, meters, hip center at the origin, facing +Z. */
export const BODY = {
  hipW: 0.26,
  shoW: 0.38,
  torso: 0.5,
  neck: 0.12,
  upper: 0.3,
  fore: 0.26,
  thigh: 0.44,
  shin: 0.42,
  foot: 0.16,
} as const;

export const REF_TORSO = BODY.torso;

export type BodyParams = {
  /** Radians, shoulders move toward +Z (the net). */
  lean: number;
  /** Radians. Positive: right side swings back (forehand takeback). */
  hipYaw: number;
  shoYaw: number;
  /** Radians of knee flexion from straight. 0 = locked. */
  knee: number;
  domElbowDeg: number;
  /** Direction from the right shoulder toward the right wrist, in net space. */
  domAim: Vec3;
  offElbowDeg: number;
  offAim: Vec3;
};

const NET: Vec3 = { x: 0, y: 0, z: 1 };
const DOM_POLE: Vec3 = { x: 0.55, y: -0.35, z: -0.15 };
const OFF_POLE: Vec3 = { x: -0.55, y: -0.35, z: -0.15 };

export function boneReach(elbowDeg: number, l1 = BODY.upper, l2 = BODY.fore): number {
  const theta = (Math.min(175, Math.max(8, elbowDeg)) * Math.PI) / 180;
  const d2 = l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(theta);
  return Math.sqrt(Math.max(0.01, d2));
}

function solveElbow(shoulder: Vec3, wrist: Vec3, l1: number, l2: number, pole: Vec3): Vec3 {
  const sw = sub(wrist, shoulder);
  const raw = length(sw);
  if (raw < 1e-5) return add(shoulder, { x: 0, y: -l1 * 0.6, z: 0 });
  const maxD = l1 + l2 - 1e-4;
  const dist = Math.min(raw, maxD);
  const dir = norm(sw);
  const alongDist = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const height = Math.sqrt(Math.max(0, l1 * l1 - alongDist * alongDist));
  const along = add(shoulder, scale(dir, alongDist));
  let perp = sub(pole, scale(dir, dotSafe(pole, dir)));
  if (length(perp) < 1e-5) {
    const helper = Math.abs(dir.y) < 0.85 ? UP : { x: 1, y: 0, z: 0 };
    perp = cross(dir, helper);
  }
  return add(along, scale(norm(perp), height));
}

function dotSafe(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function putFingers(pose: Vec3[], wrist: number, elbow: number, side: number, pinky: number, index: number, thumb: number) {
  const dir = norm(sub(pose[wrist], pose[elbow]));
  let lat = cross(dir, UP);
  if (length(lat) < 1e-5) lat = { x: side, y: 0, z: 0 };
  lat = norm(lat);
  pose[pinky] = add(pose[wrist], add(scale(dir, 0.08), scale(lat, 0.03 * side)));
  pose[index] = add(pose[wrist], add(scale(dir, 0.1), scale(lat, -0.01 * side)));
  pose[thumb] = add(pose[wrist], add(scale(dir, 0.05), scale(lat, -0.04 * side)));
}

/** Build a 33-point pose. Hip center is the origin, +Z faces the net, +X is the person's right. */
export function buildBody(params: BodyParams): Vec3[] {
  const pose = emptyPose();
  const hipForward = rotY(NET, params.hipYaw);
  const lHip = rotY({ x: -BODY.hipW / 2, y: 0, z: 0 }, params.hipYaw);
  const rHip = rotY({ x: BODY.hipW / 2, y: 0, z: 0 }, params.hipYaw);
  pose[LM.lHip] = lHip;
  pose[LM.rHip] = rHip;

  const lean = params.lean;
  const spineDir = norm(add(scale(UP, Math.cos(lean)), scale(NET, Math.sin(lean))));
  const shoMid = scale(spineDir, BODY.torso);
  const shoRight = rotY({ x: 1, y: 0, z: 0 }, params.shoYaw);
  const lSho = add(shoMid, scale(shoRight, -BODY.shoW / 2));
  const rSho = add(shoMid, scale(shoRight, BODY.shoW / 2));
  pose[LM.lShoulder] = lSho;
  pose[LM.rShoulder] = rSho;

  const placeLeg = (hip: Vec3, kneeI: number, ankleI: number, heelI: number, footI: number) => {
    const k = params.knee;
    const knee = add(
      hip,
      add(scale(UP, -Math.cos(k) * BODY.thigh), scale(hipForward, Math.sin(k) * BODY.thigh)),
    );
    const ankle = add(
      knee,
      add(
        scale(UP, -Math.cos(k * 0.2) * BODY.shin),
        scale(hipForward, Math.sin(k * 0.15) * BODY.shin),
      ),
    );
    pose[kneeI] = knee;
    pose[ankleI] = ankle;
    pose[heelI] = add(ankle, add(scale(hipForward, -0.05), scale(UP, -0.04)));
    pose[footI] = add(ankle, add(scale(hipForward, BODY.foot), scale(UP, -0.045)));
  };
  placeLeg(lHip, LM.lKnee, LM.lAnkle, LM.lHeel, LM.lFoot);
  placeLeg(rHip, LM.rKnee, LM.rAnkle, LM.rHeel, LM.rFoot);

  const rAim = norm(params.domAim);
  const lAim = norm(params.offAim);
  const safeR = length(rAim) < 1e-6 ? NET : rAim;
  const safeL = length(lAim) < 1e-6 ? NET : lAim;
  pose[LM.rWrist] = add(rSho, scale(safeR, boneReach(params.domElbowDeg)));
  pose[LM.lWrist] = add(lSho, scale(safeL, boneReach(params.offElbowDeg)));
  pose[LM.rElbow] = solveElbow(rSho, pose[LM.rWrist], BODY.upper, BODY.fore, DOM_POLE);
  pose[LM.lElbow] = solveElbow(lSho, pose[LM.lWrist], BODY.upper, BODY.fore, OFF_POLE);

  putFingers(pose, LM.rWrist, LM.rElbow, 1, LM.rPinky, LM.rIndex, LM.rThumb);
  putFingers(pose, LM.lWrist, LM.lElbow, -1, LM.lPinky, LM.lIndex, LM.lThumb);

  const nose = add(shoMid, add(scale(spineDir, BODY.neck + 0.04), scale(NET, 0.08)));
  pose[LM.nose] = nose;
  pose[LM.lEyeIn] = add(nose, { x: -0.02, y: 0.03, z: 0.01 });
  pose[LM.lEye] = add(nose, { x: -0.035, y: 0.03, z: 0 });
  pose[LM.lEyeOut] = add(nose, { x: -0.05, y: 0.03, z: -0.01 });
  pose[LM.rEyeIn] = add(nose, { x: 0.02, y: 0.03, z: 0.01 });
  pose[LM.rEye] = add(nose, { x: 0.035, y: 0.03, z: 0 });
  pose[LM.rEyeOut] = add(nose, { x: 0.05, y: 0.03, z: -0.01 });
  pose[LM.lEar] = add(nose, { x: -0.08, y: 0.0, z: -0.04 });
  pose[LM.rEar] = add(nose, { x: 0.08, y: 0.0, z: -0.04 });
  pose[LM.lMouth] = add(nose, { x: -0.02, y: -0.03, z: 0 });
  pose[LM.rMouth] = add(nose, { x: 0.02, y: -0.03, z: 0 });
  return pose;
}

/** Recovered elbow angle, used by tests to confirm the IK matches the requested angle. */
export function dominantElbowAngle(pose: Vec3[]): number {
  return angleABC(pose[LM.rShoulder], pose[LM.rElbow], pose[LM.rWrist]);
}
