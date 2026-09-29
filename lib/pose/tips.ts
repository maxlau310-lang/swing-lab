import type { FilmingAngle, FrameMetrics, ImpactReport, Severity, Stroke, Tip } from "./types";

type Band = "high" | "mid" | "good";

function around(value: number, lo: number, hi: number, pad: number): Band {
  if (value >= lo && value <= hi) return "good";
  if (value < lo) return value < lo - pad ? "high" : "mid";
  return value > hi + pad ? "high" : "mid";
}

function atLeast(value: number, good: number, mid: number): Band {
  if (value >= good) return "good";
  if (value >= mid) return "mid";
  return "high";
}

function round(n: number): string {
  return String(Math.round(n));
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, mid: 1, good: 2 };

/**
 * Rule-based coaching. Every axis emits one tip; the list keeps the sharpest 4–6.
 * Thresholds are amateur-forehand / two-handed-backhand ranges, not lab norms.
 */
export function buildTips(report: ImpactReport, stroke: Stroke): Tip[] {
  const name = stroke === "forehand" ? "正手" : "反手";
  const rules: Tip[] = [];

  const lean = around(report.torsoLeanDeg, stroke === "forehand" ? 12 : 8, stroke === "forehand" ? 28 : 26, 6);
  if (lean === "good") {
    rules.push({
      id: "torso-good",
      severity: "good",
      title: "上身有去就個波",
      detail: `${name}擊球前傾 ${round(report.torsoLeanDeg)}°，喺合理範圍。呢下唔係企到直咁用手臂撈。`,
    });
  } else if (report.torsoLeanDeg < (stroke === "forehand" ? 12 : 8)) {
    rules.push({
      id: "torso-upright",
      severity: lean,
      title: "擊球時上身太直",
      detail: `${name}擊球前傾只得 ${round(report.torsoLeanDeg)}°，理想大約 ${stroke === "forehand" ? "12–28" : "8–26"}°。企到咁直，成下揮拍會變成用手臂撈，個波易飛高又冇穿透。`,
      cue: "擊球瞬間個心口追住個波，腰再彎落少少去就佢。",
    });
  } else {
    rules.push({
      id: "torso-excess",
      severity: lean,
      title: "上身傾得太多",
      detail: `前傾去到 ${round(report.torsoLeanDeg)}°，多過理想。傾到埋去容易打唔中球心，收拍都會慢。`,
      cue: "保持胸前有少少空間，唔好成個人扑埋去個波度。",
    });
  }

  const frontLo = stroke === "forehand" ? 30 : 26;
  const frontHi = stroke === "forehand" ? 72 : 70;
  const front = around(report.contactFrontCm, frontLo, frontHi, 14);
  const frontWhere =
    report.contactFrontCm >= 0
      ? `手在身前 ${round(report.contactFrontCm)}cm`
      : `手仲喺身後 ${round(Math.abs(report.contactFrontCm))}cm`;
  if (front === "good") {
    rules.push({
      id: "contact-good",
      severity: "good",
      title: "擊球點喺身前",
      detail: `${frontWhere} 先打中，距離啱，個波有空間出去。`,
    });
  } else if (report.contactFrontCm < frontLo) {
    rules.push({
      id: "contact-close",
      severity: front,
      title: report.contactFrontCm < 0 ? "擊球點喺身後" : "擊球點太貼身",
      detail: `${frontWhere}，${name}理想大約身前 ${frontLo}cm 或再前少少。個波貼住身甚至喺身後先打，手臂伸唔開，容易打薄。`,
      cue: "等個波再出前少少，感覺手伸到身前差唔多一臂先打。",
    });
  } else {
    rules.push({
      id: "contact-far",
      severity: front,
      title: "擊球點太前",
      detail: `手伸到身前 ${round(report.contactFrontCm)}cm，遠過理想 ${frontLo}–${frontHi}cm。拉到盡先打，拍面易不穩。`,
      cue: "早少少準備，喺身前舒服嘅距離打，唔好追到最盡。",
    });
  }

  const hip = atLeast(report.hipTravelDeg, stroke === "forehand" ? 26 : 20, stroke === "forehand" ? 14 : 10);
  if (hip === "good") {
    rules.push({
      id: "hip-good",
      severity: "good",
      title: "有用個腰帶動手",
      detail: `由引拍到擊球，髖轉咗 ${round(report.hipTravelDeg)}°。呢下唔係淨係用手揮。`,
    });
  } else {
    rules.push({
      id: "hip-quiet",
      severity: hip,
      title: "轉腰唔夠，淨係用手",
      detail: `由引拍到擊球，髖只轉咗 ${round(report.hipTravelDeg)}°，${name}理想大約 ${stroke === "forehand" ? "26" : "20"}° 或以上。腰唔轉，揮拍會好累，個波亦冇旋轉。`,
      cue: "引拍時髖先轉開，打出去嗰下腰帶住個拍轉返向前，手跟住去。",
    });
  }

  const elbowLo = stroke === "forehand" ? 148 : 100;
  const elbowHi = stroke === "forehand" ? 172 : 152;
  const elbow = around(report.elbowDeg, elbowLo, elbowHi, stroke === "forehand" ? 16 : 14);
  if (elbow === "good") {
    rules.push({
      id: "elbow-good",
      severity: "good",
      title: stroke === "forehand" ? "手肘伸得啱" : "反手手肘彎得啱",
      detail:
        stroke === "forehand"
          ? `擊球手肘 ${round(report.elbowDeg)}°，近乎打直但未鎖死，力量傳得到去拍面。`
          : `雙手反手擊球手肘 ${round(report.elbowDeg)}°，有彎但未貼死，拍面穩過完全伸直。`,
    });
  } else if (stroke === "forehand" && report.elbowDeg < elbowLo) {
    rules.push({
      id: "elbow-bent",
      severity: elbow,
      title: "手肘彎得太多",
      detail: `手肘 ${round(report.elbowDeg)}°，正手擊球理想大約 ${elbowLo}–${elbowHi}°。彎到咁犀利，拍面易翻，力出唔到。`,
      cue: "向前揮嗰陣想像前臂甩直，打中個波嗰下先差唔多伸直。",
    });
  } else if (stroke === "backhand" && report.elbowDeg > elbowHi) {
    rules.push({
      id: "elbow-locked",
      severity: elbow,
      title: "反手手肘太直",
      detail: `手肘 ${round(report.elbowDeg)}°，雙手反手理想大約 ${elbowLo}–${elbowHi}°。太直會變成單手硬掃，拍面容易翻。`,
      cue: "兩隻手保持一個舒服嘅彎，用轉身帶個拍，唔好靠鎖直隻手。",
    });
  } else if (report.elbowDeg < elbowLo) {
    rules.push({
      id: "elbow-bent",
      severity: elbow,
      title: "手肘太貼身",
      detail: `手肘 ${round(report.elbowDeg)}°，彎過${name}舒服嘅範圍（大約 ${elbowLo}–${elbowHi}°）。個拍會縮埋，擊球點自然變後。`,
      cue: "揮出去嗰下俾少少空間隻手，唔好夾住個肋骨。",
    });
  } else {
    rules.push({
      id: "elbow-locked",
      severity: elbow,
      title: "手肘鎖得太直",
      detail: `手肘 ${round(report.elbowDeg)}°，直過理想 ${elbowLo}–${elbowHi}°。鎖死少咗緩衝，拍面一震就離。`,
      cue: "打中之前留少少彎，打中先自然伸直。",
    });
  }

  const knee = around(report.kneeDeg, 140, 168, 6);
  if (knee === "good") {
    rules.push({
      id: "knee-good",
      severity: "good",
      title: "膝蓋有蹲，重心穩",
      detail: `擊球時膝蓋 ${round(report.kneeDeg)}°，有微蹲，重心唔會浮喺腳尖。`,
    });
  } else if (report.kneeDeg > 168) {
    rules.push({
      id: "knee-straight",
      severity: knee,
      title: "雙腳太直，重心太高",
      detail: `膝蓋 ${round(report.kneeDeg)}°，幾乎打直（理想大約 140–168°）。重心太高，起步同轉腰都會慢。`,
      cue: "預備嗰下膝頭微彎，好似坐低少少，打完先伸返直。",
    });
  } else {
    rules.push({
      id: "knee-deep",
      severity: knee,
      title: "蹲得太低",
      detail: `膝蓋去到 ${round(report.kneeDeg)}°，低過一般擊球需要。蹲太深會慢，下一拍難還原。`,
      cue: "保留彈性能起身嘅高度，唔好坐到落去。",
    });
  }

  const followGood = stroke === "forehand" ? 22 : 12;
  const followMid = stroke === "forehand" ? 10 : 6;
  const follow = atLeast(report.followCrossCm, followGood, followMid);
  const riseNote =
    stroke === "backhand" ? `，打完手高升咗 ${round(report.followRiseCm)}cm` : "";
  if (follow === "good") {
    rules.push({
      id: "follow-good",
      severity: "good",
      title: "隨揮有帶完",
      detail:
        stroke === "forehand"
          ? `打完手帶去對側 ${round(report.followCrossCm)}cm，揮拍冇中途收住。`
          : `反手隨揮帶去持拍肩方向 ${round(report.followCrossCm)}cm${riseNote}。收拍方向啱。`,
    });
  } else if (stroke === "forehand") {
    const moved =
      report.followCrossCm >= 0
        ? `打完手淨係再行咗 ${round(report.followCrossCm)}cm 去對側`
        : `打完手冇帶去對側，反而行返持拍嗰邊 ${round(Math.abs(report.followCrossCm))}cm`;
    rules.push({
      id: "follow-short",
      severity: follow,
      title: "隨揮停得太早",
      detail: `${moved}（理想 ${followGood}cm 以上）。揮拍好似打到一半就收。`,
      cue: "打完唔好停，手繼續帶到另一邊膊頭前面，拍面自然收。",
    });
  } else {
    const moved =
      report.followCrossCm >= 0
        ? `打完手向持拍肩只行咗 ${round(report.followCrossCm)}cm`
        : `打完手冇收到持拍肩，反而行返另一邊 ${round(Math.abs(report.followCrossCm))}cm`;
    rules.push({
      id: "follow-short",
      severity: follow,
      title: "反手隨揮未去到肩",
      detail: `${moved}${riseNote}。理想係揮到肩上面，而家收得太早。`,
      cue: "打中之後兩隻手繼續向上，收到持拍那邊嘅膊頭前面。",
    });
  }

  const hand = around(report.handHeightCm, stroke === "forehand" ? 28 : 24, stroke === "forehand" ? 55 : 52, 10);
  if (hand === "good") {
    rules.push({
      id: "hand-good",
      severity: "good",
      title: "擊球高度合理",
      detail: `手高於髖 ${round(report.handHeightCm)}cm，接近正常抽球高度，唔算太低或者抽到天上。`,
    });
  } else if (report.handHeightCm < (stroke === "forehand" ? 28 : 24)) {
    const height =
      report.handHeightCm >= 0
        ? `手只高於髖 ${round(report.handHeightCm)}cm`
        : `手低過髖 ${round(Math.abs(report.handHeightCm))}cm`;
    rules.push({
      id: "hand-low",
      severity: hand,
      title: "擊球點偏低",
      detail: `${height}。除非你刻意打低球，否則拍面易打到球底，個波會飛高。`,
      cue: "準備早少少，喺腰同胸之間打，唔好等個波跌到落髖先揮。",
    });
  } else {
    rules.push({
      id: "hand-high",
      severity: hand,
      title: "擊球點偏高",
      detail: `手高於髖 ${round(report.handHeightCm)}cm，高過一般平擊。拍面容易打高，個波會短或者出界。`,
      cue: "擊球點放返落胸前，拍面垂直多一點。",
    });
  }

  const lateralLo = stroke === "forehand" ? 18 : 4;
  const lateralHi = stroke === "forehand" ? 48 : 36;
  const lateral = around(report.contactLateralCm, lateralLo, lateralHi, 10);
  if (lateral === "good") {
    rules.push({
      id: "lateral-good",
      severity: "good",
      title: "手離身體啱",
      detail: `手離身體中線 ${round(report.contactLateralCm)}cm，有空間揮，又未伸到失控。`,
    });
  } else if (report.contactLateralCm < lateralLo) {
    rules.push({
      id: "lateral-close",
      severity: lateral,
      title: "手太貼住身",
      detail: `手離中線只得 ${round(report.contactLateralCm)}cm。${name}揮拍需要少少空間，貼住身個拍會打到自己。`,
      cue: "擊球嗰下隻手離開肋骨少少，俾個拍有路行。",
    });
  } else {
    rules.push({
      id: "lateral-wide",
      severity: lateral,
      title: "手伸得太開",
      detail: `手離中線 ${round(report.contactLateralCm)}cm，開過理想。伸到最盡先打，下一拍難還原。`,
      cue: "腳步再埋少少，唔好靠隻手去夠個波。",
    });
  }

  const sep = atLeast(report.separationDeg, stroke === "forehand" ? 16 : 12, 8);
  if (sep === "good") {
    rules.push({
      id: "separation-good",
      severity: "good",
      title: "引拍有拉開",
      detail: `引拍盡頭肩同髖差 ${round(report.separationDeg)}°，有拉弓，向前揮先有得彈。`,
    });
  } else {
    rules.push({
      id: "separation-low",
      severity: sep,
      title: "引拍未拉滿",
      detail: `引拍盡頭肩同髖只差 ${round(report.separationDeg)}°，理想大約 ${stroke === "forehand" ? "16" : "12"}° 或以上。未拉滿，向前揮會冇彈弓。`,
      cue: "轉肩再多一點。另一隻手可以指住嚟波，幫你轉到夠先揮。",
    });
  }

  return selectTips(rules);
}

const BACK_VIEW_CAVEAT = "背面鏡頭嘅「身前」係深度估計，側拍或正拍會準啲。";

/**
 * Back-view depth is the noisy axis. Mild "too close" / "too far" calls drop
 * from high to mid. A hand that is actually behind the body stays high.
 */
export function applyFilmingCaveat(tips: Tip[], report: ImpactReport, filming: FilmingAngle): Tip[] {
  if (filming !== "back") return tips;
  return tips.map((tip) => {
    if (tip.id !== "contact-close" && tip.id !== "contact-far" && tip.id !== "contact-good") return tip;
    const behindBody = report.contactFrontCm < 0;
    const soften =
      tip.severity === "high" && !behindBody && (tip.id === "contact-close" || tip.id === "contact-far");
    return {
      ...tip,
      severity: soften ? "mid" : tip.severity,
      detail: `${tip.detail} ${BACK_VIEW_CAVEAT}`,
    };
  });
}

export type MeterSpec = {
  key: keyof FrameMetrics | "hipTravelDeg" | "followCrossCm";
  label: string;
  unit: string;
  lo: number;
  hi: number;
  min: number;
  max: number;
  live: boolean;
};

export function meterSpecs(stroke: Stroke): MeterSpec[] {
  const forehand = stroke === "forehand";
  return [
    { key: "torsoLeanDeg", label: "上身前傾", unit: "°", lo: forehand ? 12 : 8, hi: forehand ? 28 : 26, min: -8, max: 40, live: true },
    { key: "hipTravelDeg", label: "轉腰幅度", unit: "°", lo: forehand ? 26 : 20, hi: 80, min: 0, max: 90, live: false },
    { key: "handHeightCm", label: "手高（離髖）", unit: "cm", lo: forehand ? 28 : 24, hi: forehand ? 55 : 52, min: -15, max: 80, live: true },
    { key: "elbowDeg", label: "手肘角度", unit: "°", lo: forehand ? 148 : 100, hi: forehand ? 172 : 152, min: 70, max: 185, live: true },
    { key: "contactFrontCm", label: "擊球點身前", unit: "cm", lo: forehand ? 30 : 26, hi: forehand ? 72 : 70, min: -30, max: 95, live: true },
    { key: "kneeDeg", label: "膝蓋角度", unit: "°", lo: 140, hi: 168, min: 100, max: 185, live: true },
    { key: "contactLateralCm", label: "手離中線", unit: "cm", lo: forehand ? 18 : 4, hi: forehand ? 48 : 36, min: 0, max: 70, live: true },
    {
      key: "followCrossCm",
      label: forehand ? "隨揮帶去對側" : "隨揮帶去持拍肩",
      unit: "cm",
      lo: forehand ? 22 : 12,
      hi: 90,
      min: -25,
      max: 100,
      live: false,
    },
  ];
}

function selectTips(rules: Tip[]): Tip[] {
  const problems = rules.filter((tip) => tip.severity !== "good");
  const goods = rules.filter((tip) => tip.severity === "good");
  problems.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  if (problems.length >= 4) return problems.slice(0, 6);
  const budget = problems.length === 0 ? 6 : Math.max(2, 4 - problems.length);
  return [...problems, ...goods.slice(0, budget)].slice(0, 6);
}
