import { REF_TORSO } from "./body";
import { clonePose, hipCenter, mirrorPose, plantPose, torsoLength } from "./landmarks";
import { buildReport, estimateClipFrame, frameMetrics } from "./metrics";
import { detectPhases } from "./phases";
import { alignPhase, bodyAt } from "./template";
import { applyFilmingCaveat, buildTips } from "./tips";
import {
  SwingInputError,
  type Analysis,
  type FilmingAngle,
  type Handedness,
  type PoseFrame,
  type Stroke,
} from "./types";
import { add, scale, type Vec3 } from "./vec";

export type AnalyzeOptions = {
  stroke: Stroke;
  handedness: Handedness;
  source?: Analysis["source"];
  warnings?: string[];
  image?: Analysis["image"];
  filming?: FilmingAngle;
};

function placeTemplate(ideal: Vec3[], user: Vec3[], clip: ReturnType<typeof estimateClipFrame>, fit: number): Vec3[] {
  const hip = hipCenter(user);
  return ideal.map((p) => {
    const s = scale(p, fit);
    return add(
      hip,
      add(add(scale(clip.right, s.x), scale(clip.up, s.y)), scale(clip.forward, s.z)),
    );
  });
}

export function analyzePoses(input: PoseFrame[], options: AnalyzeOptions): Analysis {
  if (input.length < 8) {
    throw new SwingInputError("幀數太少，捕捉唔到成個揮拍。影長少少，由預備揮到隨揮。");
  }

  const canonical: PoseFrame[] = input.map((frame) => ({
    t: frame.t,
    landmarks:
      options.handedness === "left" ? mirrorPose(frame.landmarks) : clonePose(frame.landmarks),
  }));

  const phase = detectPhases(canonical);
  const clip = estimateClipFrame(canonical);
  const metrics = canonical.map((frame) => frameMetrics(frame.landmarks, clip));
  const report = buildReport(canonical, metrics, phase, clip, options.stroke);
  const filming = options.filming ?? "unknown";
  const tips = applyFilmingCaveat(buildTips(report, options.stroke), report, filming);

  const meanTorso =
    canonical.reduce((sum, frame) => sum + torsoLength(frame.landmarks), 0) / canonical.length;
  const fit = Math.min(1.8, Math.max(0.55, meanTorso / REF_TORSO || 1));

  const corrected: PoseFrame[] = canonical.map((frame, index) => {
    const p = alignPhase(index, phase.backFrame, phase.impactFrame, canonical.length);
    const ideal = bodyAt(options.stroke, "ideal", p);
    return { t: frame.t, landmarks: placeTemplate(ideal, frame.landmarks, clip, fit) };
  });

  let userDisplay = canonical.map((frame) => ({
    t: frame.t,
    landmarks: plantPose(frame.landmarks),
  }));
  let correctedDisplay = corrected.map((frame) => ({
    t: frame.t,
    landmarks: plantPose(frame.landmarks),
  }));

  if (options.handedness === "left") {
    userDisplay = userDisplay.map((frame) => ({ t: frame.t, landmarks: mirrorPose(frame.landmarks) }));
    correctedDisplay = correctedDisplay.map((frame) => ({
      t: frame.t,
      landmarks: mirrorPose(frame.landmarks),
    }));
  }

  const warnings = [...(options.warnings ?? [])];
  if (phase.peakSpeed < 0.4) {
    warnings.push("手腕郁動好少，擊球點可能估得唔準。試下影成個揮拍，由預備到隨揮。");
  }
  if (fit < 0.7 || fit > 1.45) {
    warnings.push("身體比例同鏡頭距離有啲怪，角度只供參考。盡量影到由頭到腳。");
  }
  if (filming === "back") {
    warnings.push(
      "背面鏡頭用得：手肘、膝蓋、前傾、轉腰都計。「身前」係深度，輕微偏差會降做中等；手喺身後先算高。側拍或正拍之後會準啲，而家唔使等。",
    );
  }

  return {
    stroke: options.stroke,
    handedness: options.handedness,
    source: options.source ?? "demo",
    frames: userDisplay,
    corrected: correctedDisplay,
    image: options.image ?? null,
    phases: phase.phases,
    impactFrame: phase.impactFrame,
    backFrame: phase.backFrame,
    followFrame: phase.followFrame,
    metrics,
    report,
    tips,
    warnings,
    filming,
  };
}
