import { LM } from "./landmarks";
import type { FilmingAngle, ImagePoint } from "./types";

const FACE = [LM.nose, LM.lEye, LM.rEye, LM.lMouth, LM.rMouth];

/**
 * Guess the phone placement from the 2D pose.
 * Wide shoulders and a hidden face → camera behind the player (v1 default).
 * Narrow shoulders → side. Wide shoulders and a visible face → front.
 * Side and front are accepted when they show up; they are not required.
 */
export function classifyFilmingAngle(frames: Array<ImagePoint[] | null> | null | undefined): FilmingAngle {
  if (!frames) return "unknown";
  let ratioSum = 0;
  let faceSum = 0;
  let faceCount = 0;
  let n = 0;
  let sawVisibility = false;

  for (const frame of frames) {
    if (!frame || frame.length <= LM.rHip) continue;
    const lSho = frame[LM.lShoulder];
    const rSho = frame[LM.rShoulder];
    const lHip = frame[LM.lHip];
    const rHip = frame[LM.rHip];
    if (!lSho || !rSho || !lHip || !rHip) continue;
    const shoulderW = Math.abs(rSho.x - lSho.x);
    const torsoH = Math.abs((lHip.y + rHip.y) / 2 - (lSho.y + rSho.y) / 2);
    if (torsoH < 0.02) continue;
    ratioSum += shoulderW / torsoH;
    let face = 0;
    let faceN = 0;
    for (const index of FACE) {
      const point = frame[index];
      if (!point || point.visibility === undefined) continue;
      sawVisibility = true;
      face += point.visibility;
      faceN += 1;
    }
    if (faceN > 0) {
      faceSum += face / faceN;
      faceCount += 1;
    }
    n += 1;
  }

  if (n < 4) return "unknown";
  const ratio = ratioSum / n;
  if (ratio < 0.45) return "side";
  if (!sawVisibility || faceCount < 4) return "unknown";
  const face = faceSum / faceCount;
  if (face < 0.45) return "back";
  if (face >= 0.6) return "front";
  return "unknown";
}
