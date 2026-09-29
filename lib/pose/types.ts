import type { Vec3 } from "./vec";

export type Stroke = "forehand" | "backhand";
export type Handedness = "left" | "right";
export type PhaseName = "backswing" | "impact" | "follow";
export type ViewMode = "overlay" | "split" | "user" | "corrected";
export type Severity = "high" | "mid" | "good";
/** How the phone was placed. v1 is tuned for a camera behind the player. */
export type FilmingAngle = "back" | "side" | "front" | "unknown";

export type PoseFrame = {
  t: number;
  landmarks: Vec3[];
};

export type ImagePoint = { x: number; y: number; visibility?: number };

export type PhaseSpan = {
  name: PhaseName;
  /** Inclusive frame index. */
  start: number;
  /** Exclusive frame index. */
  end: number;
};

export type FrameMetrics = {
  torsoLeanDeg: number;
  kneeDeg: number;
  elbowDeg: number;
  handHeightCm: number;
  contactFrontCm: number;
  contactLateralCm: number;
};

export type ImpactReport = FrameMetrics & {
  hipTravelDeg: number;
  shoulderTravelDeg: number;
  separationDeg: number;
  /** Forehand: cm toward the non-dominant side. Backhand: cm toward the dominant shoulder. */
  followCrossCm: number;
  followRiseCm: number;
};

export type Tip = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  cue?: string;
};

export type Analysis = {
  stroke: Stroke;
  handedness: Handedness;
  source: "demo" | "video";
  frames: PoseFrame[];
  corrected: PoseFrame[];
  image: Array<ImagePoint[] | null> | null;
  phases: PhaseSpan[];
  impactFrame: number;
  backFrame: number;
  followFrame: number;
  metrics: FrameMetrics[];
  report: ImpactReport;
  tips: Tip[];
  warnings: string[];
  /** Estimated phone placement. Demo sequences stay `unknown`. */
  filming: FilmingAngle;
};

export class SwingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwingInputError";
  }
}
