import { analyzePoses } from "./analyze";
import { classifyFilmingAngle } from "./filming";
import { LM, LANDMARK_COUNT } from "./landmarks";
import { SwingInputError, type Analysis, type Handedness, type ImagePoint, type PoseFrame, type Stroke } from "./types";
import type { Vec3 } from "./vec";

type MpPoint = { x: number; y: number; z: number; visibility?: number };

type RawFrame = {
  t: number;
  world: MpPoint[] | null;
  image: ImagePoint[] | null;
};

const MAX_SECONDS = 8;
const SAMPLE_FPS = 12;

let landmarkerPromise: Promise<PoseLandmarkerLike> | null = null;

type PoseLandmarkerLike = {
  detect: (image: HTMLCanvasElement) => {
    landmarks?: MpPoint[][];
    worldLandmarks?: MpPoint[][];
  };
};

async function getLandmarker(): Promise<PoseLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

async function createLandmarker(): Promise<PoseLandmarkerLike> {
  const vision = await import("@mediapipe/tasks-vision");
  const files = await vision.FilesetResolver.forVisionTasks("/mediapipe");
  const options = {
    runningMode: "IMAGE" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.35,
    minPosePresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
  };
  try {
    return await vision.PoseLandmarker.createFromOptions(files, {
      ...options,
      baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "GPU" },
    });
  } catch {
    return vision.PoseLandmarker.createFromOptions(files, {
      ...options,
      baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "CPU" },
    });
  }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.min(Math.max(0, time), Math.max(0, (video.duration || time) - 0.04));
    if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) {
      resolve();
      return;
    }
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new SwingInputError("影片擷取失敗，試下轉成 mp4 再上傳。"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = target;
  });
}

function loadVideo(file: Blob): Promise<{ video: HTMLVideoElement; url: string }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new SwingInputError("讀唔到呢條片。試下手機相簿入面嘅 mp4。"));
    };
  });
}

/** MediaPipe world Y is sometimes up and sometimes image-down. Head-above-hips decides. */
export function worldYIsDown(samples: MpPoint[][]): boolean {
  let score = 0;
  let n = 0;
  for (const pose of samples) {
    if (!pose || pose.length < 33) continue;
    const hipY = (pose[LM.lHip].y + pose[LM.rHip].y) / 2;
    score += pose[LM.nose].y - hipY;
    n += 1;
  }
  if (n === 0) return false;
  return score / n < 0;
}

export function canonicalizeWorld(points: MpPoint[], yIsDown: boolean): Vec3[] {
  return points.slice(0, LANDMARK_COUNT).map((p) =>
    yIsDown ? { x: p.x, y: -p.y, z: -p.z } : { x: p.x, y: p.y, z: p.z },
  );
}

function interpolate(frames: RawFrame[], yIsDown: boolean): { poses: PoseFrame[]; image: Array<ImagePoint[] | null> } {
  const good = frames
    .map((frame, index) => ({ index, frame }))
    .filter((item) => item.frame.world && item.frame.world.length >= LANDMARK_COUNT);

  if (good.length < 8) {
    throw new SwingInputError("大部分畫面搵唔到成個身。退後少少，等個頭到對腳都入鏡。而家用背面影就得。");
  }

  const poses: PoseFrame[] = [];
  const image: Array<ImagePoint[] | null> = [];
  for (let i = 0; i < frames.length; i += 1) {
    const direct = frames[i].world;
    let world: MpPoint[];
    if (direct && direct.length >= LANDMARK_COUNT) {
      world = direct;
    } else {
      const prev = [...good].reverse().find((item) => item.index < i);
      const next = good.find((item) => item.index > i);
      if (prev && next && prev.frame.world && next.frame.world) {
        const span = next.index - prev.index;
        const t = (i - prev.index) / span;
        world = prev.frame.world.map((p, joint) => {
          const q = next.frame.world![joint];
          return {
            x: p.x + (q.x - p.x) * t,
            y: p.y + (q.y - p.y) * t,
            z: p.z + (q.z - p.z) * t,
          };
        });
      } else if (prev?.frame.world) {
        world = prev.frame.world;
      } else if (next?.frame.world) {
        world = next.frame.world;
      } else {
        throw new SwingInputError("搵唔到穩定嘅身體骨架。");
      }
    }
    poses.push({ t: frames[i].t, landmarks: canonicalizeWorld(world, yIsDown) });
    image.push(frames[i].image);
  }
  return { poses, image };
}

export async function analyzeVideoFile(
  file: Blob,
  options: {
    stroke: Stroke;
    handedness: Handedness;
    signal?: AbortSignal;
    onProgress?: (progress: number, label: string) => void;
  },
): Promise<Analysis> {
  const { signal, onProgress } = options;
  onProgress?.(0.02, "載入姿態模型…");
  let landmarker: PoseLandmarkerLike;
  try {
    landmarker = await getLandmarker();
  } catch {
    throw new SwingInputError("姿態模型載入失敗。檢查網絡之後再試，或者先睇示範。");
  }
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  onProgress?.(0.08, "讀緊影片…");
  const { video, url } = await loadVideo(file);
  try {
    const full = video.duration;
    if (!Number.isFinite(full) || full < 0.45) {
      throw new SwingInputError("影片太短。至少揮完一次，前後留少少時間。");
    }
    const duration = Math.min(full, MAX_SECONDS);
    const warnings: string[] = [];
    if (full > MAX_SECONDS + 0.25) {
      warnings.push("片長超過 8 秒，今次只分析開頭 8 秒。建議剪到只留一次揮拍。");
    }

    const times: number[] = [];
    for (let t = 0; t < duration - 0.03; t += 1 / SAMPLE_FPS) times.push(t);
    if (times.length < 8) {
      throw new SwingInputError("影片太短，捕捉唔到成個揮拍。");
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 720 / Math.max(1, video.videoWidth || 720));
    canvas.width = Math.max(2, Math.round((video.videoWidth || 640) * scale));
    canvas.height = Math.max(2, Math.round((video.videoHeight || 480) * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new SwingInputError("瀏覽器畫布啟動失敗。");

    const raw: RawFrame[] = [];
    for (let i = 0; i < times.length; i += 1) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      await seek(video, times[i]);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const result = landmarker.detect(canvas);
      const imageLm = result.landmarks?.[0];
      const worldLm = result.worldLandmarks?.[0];
      raw.push({
        t: times[i],
        world: worldLm && worldLm.length >= LANDMARK_COUNT ? worldLm.map(copyPoint) : null,
        image:
          imageLm && imageLm.length >= LANDMARK_COUNT
            ? imageLm.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility }))
            : null,
      });
      const progress = 0.1 + (0.86 * (i + 1)) / times.length;
      onProgress?.(progress, `逐幀搵關節 ${i + 1} / ${times.length}`);
    }

    const worlds = raw.map((frame) => frame.world).filter((pose): pose is MpPoint[] => Boolean(pose));
    const yIsDown = worldYIsDown(worlds);
    const { poses, image } = interpolate(raw, yIsDown);
    const filming = classifyFilmingAngle(image);
    onProgress?.(0.98, "計緊角度同建議…");
    return analyzePoses(poses, {
      stroke: options.stroke,
      handedness: options.handedness,
      source: "video",
      warnings,
      image,
      filming,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function copyPoint(p: MpPoint): MpPoint {
  return { x: p.x, y: p.y, z: p.z, visibility: p.visibility };
}
