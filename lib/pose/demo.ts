import { mirrorPose } from "./landmarks";
import { analyzePoses } from "./analyze";
import { bodyAt } from "./template";
import type { Analysis, Handedness, PoseFrame, Stroke } from "./types";

export const DEMO_FRAMES = 80;
export const DEMO_FPS = 20;
export const DEMO_IMPACT = 44;

/** Ease into contact so wrist speed peaks on the impact pose, then slow down. */
export function demoPhase(index: number, impact = DEMO_IMPACT, count = DEMO_FRAMES): number {
  if (index <= impact) {
    const u = impact === 0 ? 1 : index / impact;
    return u ** 2.5;
  }
  const span = Math.max(1, count - 1 - impact);
  const u = (index - impact) / span;
  return 1 + 0.2 * u + 0.8 * u * u;
}

export function syntheticFrames(stroke: Stroke, kind: "ideal" | "flawed"): PoseFrame[] {
  return Array.from({ length: DEMO_FRAMES }, (_, index) => ({
    t: index / DEMO_FPS,
    landmarks: bodyAt(stroke, kind, demoPhase(index)),
  }));
}

export function analyzeDemoSwing(stroke: Stroke, handedness: Handedness): Analysis {
  const frames = syntheticFrames(stroke, "flawed");
  const posed =
    handedness === "left"
      ? frames.map((frame) => ({ t: frame.t, landmarks: mirrorPose(frame.landmarks) }))
      : frames;
  return analyzePoses(posed, { stroke, handedness, source: "demo" });
}
