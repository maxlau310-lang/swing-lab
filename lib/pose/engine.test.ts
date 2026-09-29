import { describe, expect, it } from "vitest";
import { analyzePoses } from "./analyze";
import { buildBody, dominantElbowAngle } from "./body";
import { analyzeDemoSwing, DEMO_IMPACT, syntheticFrames } from "./demo";
import { classifyFilmingAngle } from "./filming";
import { mirrorPose, torsoLength } from "./landmarks";
import { estimateClipFrame } from "./metrics";
import { angleABC } from "./vec";
import { LM } from "./landmarks";
import { detectPhases, phasesCover } from "./phases";
import { applyFilmingCaveat, buildTips } from "./tips";
import type { ImagePoint, ImpactReport } from "./types";

function baseParams(over: Partial<Parameters<typeof buildBody>[0]> = {}) {
  return {
    lean: 0,
    hipYaw: 0,
    shoYaw: 0,
    knee: 0,
    domElbowDeg: 160,
    domAim: { x: 0.3, y: -0.1, z: 1 },
    offElbowDeg: 150,
    offAim: { x: -0.2, y: -0.2, z: 0.6 },
    ...over,
  };
}

describe("body metrics", () => {
  it("measures an upright torso as about 0° of lean", () => {
    const pose = buildBody(baseParams({ lean: 0 }));
    const analysis = analyzePoses([{ t: 0, landmarks: pose }, ...pad(pose)], {
      stroke: "forehand",
      handedness: "right",
    });
    expect(Math.abs(analysis.metrics[0].torsoLeanDeg)).toBeLessThan(1.5);
  });

  it("recovers a 20° forward lean", () => {
    const lean = (20 * Math.PI) / 180;
    const pose = buildBody(baseParams({ lean }));
    const analysis = analyzePoses(hold(pose, 12), { stroke: "forehand", handedness: "right" });
    expect(analysis.metrics[0].torsoLeanDeg).toBeGreaterThan(17);
    expect(analysis.metrics[0].torsoLeanDeg).toBeLessThan(23);
  });

  it("recovers the requested elbow angle", () => {
    const pose = buildBody(baseParams({ domElbowDeg: 110 }));
    expect(dominantElbowAngle(pose)).toBeGreaterThan(100);
    expect(dominantElbowAngle(pose)).toBeLessThan(120);
  });

  it("keeps a straight knee near 180° and a bent knee clearly smaller", () => {
    const straight = buildBody(baseParams({ knee: 0 }));
    const bent = buildBody(baseParams({ knee: (32 * Math.PI) / 180 }));
    const straightKnee = angleABC(straight[LM.rHip], straight[LM.rKnee], straight[LM.rAnkle]);
    const bentKnee = angleABC(bent[LM.rHip], bent[LM.rKnee], bent[LM.rAnkle]);
    expect(straightKnee).toBeGreaterThan(170);
    expect(bentKnee).toBeLessThan(straightKnee - 20);
  });
});

describe("phases", () => {
  it("places impact on the wrist speed peak and tiles the clip", () => {
    const pose = buildBody(baseParams());
    const frames = Array.from({ length: 36 }, (_, i) => {
      const landmarks = pose.map((p) => ({ ...p }));
      // Slow takeback, a single fast step into frame 22, then a quiet follow-through.
      let z = 0.4 - i * 0.015;
      if (i > 14 && i < 22) z = 0.19 + (i - 14) * 0.02;
      if (i >= 22) z = 0.85 + (i - 22) * 0.008;
      landmarks[LM.rWrist] = { x: 0.32, y: 0.35, z };
      return { t: i / 15, landmarks };
    });
    const detected = detectPhases(frames);
    expect(detected.impactFrame).toBeGreaterThanOrEqual(20);
    expect(detected.impactFrame).toBeLessThanOrEqual(24);
    expect(detected.backFrame).toBeLessThan(detected.impactFrame);
    expect(detected.followFrame).toBeGreaterThan(detected.impactFrame);
    expect(phasesCover(detected.phases, frames.length)).toBe(true);
    expect(detected.impactFrame).toBeGreaterThanOrEqual(detected.phases[1].start);
    expect(detected.impactFrame).toBeLessThan(detected.phases[1].end);
  });
});

describe("demo swings", () => {
  it("finds contact near the designed impact and coaches the flawed forehand", () => {
    const forehand = analyzeDemoSwing("forehand", "right");
    expect(Math.abs(forehand.impactFrame - DEMO_IMPACT)).toBeLessThanOrEqual(4);
    expect(phasesCover(forehand.phases, forehand.frames.length)).toBe(true);
    expect(forehand.tips.length).toBeGreaterThanOrEqual(4);
    expect(forehand.tips.length).toBeLessThanOrEqual(6);
    expect(forehand.tips.some((tip) => tip.severity === "high")).toBe(true);
    expect(forehand.tips.some((tip) => /[\u4e00-\u9fff]/.test(tip.detail))).toBe(true);
    expect(forehand.tips.map((tip) => tip.id)).toEqual([
      "torso-upright",
      "contact-close",
      "hip-quiet",
      "elbow-bent",
      "knee-straight",
      "follow-short",
    ]);
    expect(forehand.report.contactFrontCm).toBeLessThan(24);
    expect(forehand.report.torsoLeanDeg).toBeLessThan(8);
    const userElbow = forehand.metrics[forehand.impactFrame].elbowDeg;
    const corrected = forehand.corrected[forehand.impactFrame].landmarks;
    const correctedElbow = angleABC(corrected[LM.rShoulder], corrected[LM.rElbow], corrected[LM.rWrist]);
    expect(correctedElbow).toBeGreaterThan(userElbow + 15);
    const userHip = center(forehand.frames[forehand.impactFrame].landmarks);
    const corrHip = center(corrected);
    expect(Math.hypot(userHip.x - corrHip.x, userHip.z - corrHip.z)).toBeLessThan(0.08);
  });

  it("gives the flawed backhand a different set of problems", () => {
    const backhand = analyzeDemoSwing("backhand", "right");
    expect(backhand.tips.length).toBeGreaterThanOrEqual(4);
    expect(backhand.tips.map((tip) => tip.id)).toEqual([
      "contact-close",
      "hip-quiet",
      "hand-low",
      "separation-low",
      "torso-upright",
    ]);
    const ids = new Set(backhand.tips.map((tip) => tip.id));
    const forehandIds = new Set(analyzeDemoSwing("forehand", "right").tips.map((tip) => tip.id));
    let overlap = 0;
    for (const id of ids) if (forehandIds.has(id)) overlap += 1;
    expect(overlap).toBeLessThan(ids.size);
  });

  it("does not scold an ideal forehand", () => {
    const ideal = analyzePoses(syntheticFrames("forehand", "ideal"), {
      stroke: "forehand",
      handedness: "right",
      source: "demo",
    });
    const highs = ideal.tips.filter((tip) => tip.severity === "high");
    expect(highs).toEqual([]);
    expect(ideal.report.contactFrontCm).toBeGreaterThan(ideal.report.handHeightCm > -100 ? 20 : 20);
    expect(torsoLength(ideal.frames[ideal.impactFrame].landmarks)).toBeGreaterThan(0.35);
  });

  it("keeps left-handed analysis metrics in the same ballpark", () => {
    const right = analyzeDemoSwing("forehand", "right");
    const left = analyzeDemoSwing("forehand", "left");
    expect(Math.abs(left.report.elbowDeg - right.report.elbowDeg)).toBeLessThan(8);
    expect(Math.abs(left.report.torsoLeanDeg - right.report.torsoLeanDeg)).toBeLessThan(4);
    expect(left.tips.map((tip) => tip.id)).toEqual(right.tips.map((tip) => tip.id));
  });
});

describe("back view", () => {
  it("keeps a +Z-facing pose right-handed", () => {
    const clip = estimateClipFrame(syntheticFrames("forehand", "ideal"));
    expect(clip.right.x).toBeGreaterThan(0.9);
    expect(clip.forward.z).toBeGreaterThan(0.9);
  });

  it("keeps contact-in-front and follow-through when the camera flips X", () => {
    const frames = syntheticFrames("forehand", "ideal");
    const behind = frames.map((frame) => ({
      t: frame.t,
      landmarks: frame.landmarks.map((point) => ({ x: -point.x, y: point.y, z: point.z })),
    }));
    const ahead = analyzePoses(frames, { stroke: "forehand", handedness: "right" });
    const back = analyzePoses(behind, { stroke: "forehand", handedness: "right" });
    expect(ahead.report.contactFrontCm).toBeGreaterThan(20);
    expect(back.report.contactFrontCm).toBeGreaterThan(20);
    expect(Math.abs(back.report.contactFrontCm - ahead.report.contactFrontCm)).toBeLessThan(5);
    expect(back.report.followCrossCm).toBeGreaterThan(15);
    expect(Math.sign(back.report.followCrossCm)).toBe(Math.sign(ahead.report.followCrossCm));
  });

  it("classifies wide hidden-face shots as back, narrow as side, visible face as front", () => {
    expect(classifyFilmingAngle(imageClip(0.32, 0.12))).toBe("back");
    expect(classifyFilmingAngle(imageClip(0.06, 0.85))).toBe("side");
    expect(classifyFilmingAngle(imageClip(0.32, 0.9))).toBe("front");
    expect(classifyFilmingAngle(null)).toBe("unknown");
  });

  it("softens a mild back-view contact call and keeps a behind-the-body miss high", () => {
    const flawed = analyzePoses(syntheticFrames("forehand", "flawed"), {
      stroke: "forehand",
      handedness: "right",
      filming: "back",
    });
    expect(flawed.filming).toBe("back");
    expect(flawed.warnings.some((warning) => warning.includes("背面"))).toBe(true);
    const mild = flawed.tips.find((tip) => tip.id === "contact-close");
    expect(mild?.severity).toBe("mid");
    expect(mild?.detail).toContain("背面");
    expect(flawed.report.contactFrontCm).toBeGreaterThan(0);

    const behind = applyFilmingCaveat(
      [{ id: "contact-close", severity: "high", title: "擊球點喺身後", detail: "手仲喺身後 8cm" }],
      { ...badReport(), contactFrontCm: -8 },
      "back",
    );
    expect(behind[0].severity).toBe("high");
  });
});

describe("tips", () => {
  it("returns 4 to 6 traditional-Chinese items with the worst problems first", () => {
    const tips = buildTips(badReport(), "forehand");
    expect(tips.length).toBeGreaterThanOrEqual(4);
    expect(tips.length).toBeLessThanOrEqual(6);
    expect(tips[0].severity).toBe("high");
    expect(tips.some((tip) => tip.detail.includes("°"))).toBe(true);
    expect(tips.every((tip) => tip.cue === undefined || tip.severity !== "good")).toBe(true);
    expect(JSON.stringify(tips)).not.toMatch(/[击后弯体发这]/);
  });
});

describe("mirror", () => {
  it("round-trips a pose", () => {
    const pose = buildBody(baseParams({ hipYaw: 0.4, shoYaw: 0.8 }));
    const twice = mirrorPose(mirrorPose(pose));
    for (let i = 0; i < pose.length; i += 1) {
      expect(twice[i].x).toBeCloseTo(pose[i].x, 5);
      expect(twice[i].y).toBeCloseTo(pose[i].y, 5);
      expect(twice[i].z).toBeCloseTo(pose[i].z, 5);
    }
  });
});

function hold(pose: ReturnType<typeof buildBody>, count: number) {
  return Array.from({ length: count }, (_, i) => ({ t: i / 15, landmarks: pose.map((p) => ({ ...p })) }));
}

function pad(pose: ReturnType<typeof buildBody>) {
  return hold(pose, 11).slice(1);
}

function center(pose: ReturnType<typeof buildBody>) {
  return {
    x: (pose[LM.lHip].x + pose[LM.rHip].x) / 2,
    z: (pose[LM.lHip].z + pose[LM.rHip].z) / 2,
  };
}

function imageClip(shoulderWidth: number, faceVisibility: number): ImagePoint[][] {
  return Array.from({ length: 8 }, () => {
    const points: ImagePoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
    points[LM.lShoulder] = { x: 0.5 - shoulderWidth / 2, y: 0.34, visibility: 0.9 };
    points[LM.rShoulder] = { x: 0.5 + shoulderWidth / 2, y: 0.34, visibility: 0.9 };
    points[LM.lHip] = { x: 0.48, y: 0.62, visibility: 0.9 };
    points[LM.rHip] = { x: 0.52, y: 0.62, visibility: 0.9 };
    for (const index of [LM.nose, LM.lEye, LM.rEye, LM.lMouth, LM.rMouth]) {
      points[index] = { x: 0.5, y: 0.22, visibility: faceVisibility };
    }
    return points;
  });
}

function badReport(): ImpactReport {
  return {
    torsoLeanDeg: 3,
    kneeDeg: 176,
    elbowDeg: 104,
    handHeightCm: 8,
    contactFrontCm: 4,
    contactLateralCm: 6,
    hipTravelDeg: 5,
    shoulderTravelDeg: 8,
    separationDeg: 4,
    followCrossCm: 3,
    followRiseCm: 1,
  };
}
