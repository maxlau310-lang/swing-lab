"use client";

import dynamic from "next/dynamic";
import { ChevronLeft, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MetricsPanel } from "@/components/metrics-panel";
import { PhaseTimeline, phaseLabel } from "@/components/phase-timeline";
import { TipsPanel } from "@/components/tips-panel";
import { Button } from "@/components/ui/button";
import { VideoInset } from "@/components/video-inset";
import type { CameraPreset } from "@/components/swing-viewport";
import { phaseAt } from "@/lib/pose/phases";
import type { Analysis, ViewMode } from "@/lib/pose/types";
import { formatClock } from "@/lib/utils";

const SwingViewport = dynamic(
  () => import("@/components/swing-viewport").then((mod) => mod.SwingViewport),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-white/5" />,
  },
);

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "overlay", label: "疊加" },
  { id: "split", label: "並排" },
  { id: "user", label: "只看自己" },
  { id: "corrected", label: "只看矯正" },
];

const CAMERAS: { id: CameraPreset; label: string }[] = [
  { id: "back", label: "背面" },
  { id: "threeq", label: "斜面" },
  { id: "side", label: "側面" },
  { id: "front", label: "正面" },
];

const SPEEDS = [0.25, 0.5, 1] as const;

export function AnalysisView({
  analysis,
  videoUrl,
  onBack,
}: {
  analysis: Analysis;
  videoUrl: string | null;
  onBack: () => void;
}) {
  const [frame, setFrame] = useState(analysis.impactFrame);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(0.5);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [preset, setPreset] = useState<CameraPreset>("back");
  const [showAngles, setShowAngles] = useState(true);
  const frameRef = useRef(analysis.impactFrame);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    if (!playing) return;
    const origin = performance.now();
    const originT = analysis.frames[frameRef.current]?.t ?? 0;
    let raf = 0;
    const loop = (now: number) => {
      const target = originT + ((now - origin) / 1000) * speed;
      const frames = analysis.frames;
      let next = 0;
      while (next < frames.length - 1 && frames[next + 1].t <= target) next += 1;
      if (next !== frameRef.current) {
        frameRef.current = next;
        setFrame(next);
      }
      if (next >= frames.length - 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, analysis]);

  useEffect(() => {
    const jump = (index: number) => {
      const next = Math.min(analysis.frames.length - 1, Math.max(0, index));
      frameRef.current = next;
      setFrame(next);
      setPlaying(false);
    };
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === "ArrowRight") {
        jump(frameRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        jump(frameRef.current - 1);
      } else if (event.key === "i" || event.key === "I") {
        jump(analysis.impactFrame);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [analysis]);

  function seek(index: number) {
    const next = Math.min(analysis.frames.length - 1, Math.max(0, index));
    frameRef.current = next;
    setFrame(next);
    setPlaying(false);
  }

  const pose = analysis.frames[frame];
  const corrected = analysis.corrected[frame];
  const metrics = analysis.metrics[frame];
  const atImpact = frame === analysis.impactFrame;
  const phase = phaseAt(analysis.phases, frame);
  const image = analysis.image?.[frame] ?? null;
  const strokeLabel = analysis.stroke === "forehand" ? "正手" : "反手";
  const handLabel = analysis.handedness === "right" ? "右手持拍" : "左手持拍";
  const duration = analysis.frames[analysis.frames.length - 1]?.t ?? 0;

  const liveReadout = useMemo(
    () => [
      { label: "手肘", value: `${Math.round(metrics.elbowDeg)}°` },
      { label: "膝蓋", value: `${Math.round(metrics.kneeDeg)}°` },
      { label: "前傾", value: `${Math.round(metrics.torsoLeanDeg)}°` },
      { label: "身前", value: `${Math.round(metrics.contactFrontCm)}cm` },
    ],
    [metrics],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-3 sm:px-5 sm:py-5">
      <header className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ChevronLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-medium">
            {strokeLabel} · {handLabel}
          </p>
          <p className="text-[11px] text-[#93a4b8]">
            {analysis.frames.length} 幀 · 33 關節
            {analysis.source === "demo" ? " · 示範" : ""}
            {analysis.filming === "back" ? " · 背面鏡頭" : ""}
            {analysis.filming === "side" ? " · 側面鏡頭" : ""}
            {analysis.filming === "front" ? " · 正面鏡頭" : ""}
          </p>
        </div>
      </header>

      {analysis.warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-[#ffb020]/30 bg-[#2a2112] px-3 py-2 text-[13px] text-[#ffe1ad]">
          {analysis.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
        <div className="space-y-3">
          <div className="relative h-[46vh] min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#070b12] lg:h-[min(68vh,720px)]">
            {pose && corrected && (
              <SwingViewport
                user={pose.landmarks}
                corrected={corrected.landmarks}
                viewMode={viewMode}
                preset={preset}
                showAngles={showAngles}
                handedness={analysis.handedness}
                highlightImpact={atImpact}
              />
            )}
            <div className="pointer-events-none absolute left-3 top-3 space-y-1">
              {liveReadout.map((item) => (
                <p key={item.label} className="text-[11px] tabular-nums text-[#d5deea]">
                  <span className="text-[#93a4b8]">{item.label} </span>
                  {item.value}
                </p>
              ))}
            </div>
            {viewMode === "split" && (
              <>
                <p className="pointer-events-none absolute bottom-12 left-[12%] text-xs font-medium text-[#ff7a18]">你</p>
                <p className="pointer-events-none absolute bottom-12 right-[12%] text-xs font-medium text-[#3ee0ff]">矯正</p>
              </>
            )}
            <div className="pointer-events-none absolute bottom-3 left-3">
              <p className={`text-sm font-medium ${atImpact ? "text-[#ffb3c0]" : "text-white"}`}>
                {phaseLabel(phase, atImpact)}
              </p>
              <p className="mt-1 flex items-center gap-3 text-[11px] text-[#93a4b8]">
                <span className="inline-flex items-center gap-1">
                  <i className="inline-block h-2 w-2 rounded-full bg-[#ff7a18]" /> 你
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="inline-block h-2 w-2 rounded-full bg-[#3ee0ff]" /> 矯正
                </span>
              </p>
            </div>
            {atImpact && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-[#ff4d6a]/60 bg-[#2a1218]/90 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-[#ffb3c0]">
                IMPACT
              </div>
            )}
            <div className="absolute right-3 top-3">
              {videoUrl ? (
                <VideoInset url={videoUrl} time={pose?.t ?? 0} image={image} />
              ) : (
                <p className="rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[10px] text-[#93a4b8]">
                  示範骨架
                </p>
              )}
            </div>
            <div className="absolute bottom-3 right-3 flex max-w-[70%] flex-wrap justify-end gap-1">
              {CAMERAS.map((camera) => (
                <button
                  key={camera.id}
                  type="button"
                  onClick={() => setPreset(camera.id)}
                  className={`rounded-lg px-2 py-1 text-[11px] ${preset === camera.id ? "bg-white text-[#101820]" : "bg-black/50 text-[#d5deea]"}`}
                >
                  {camera.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setViewMode(view.id)}
                className={`rounded-full px-3 py-1.5 text-xs ${viewMode === view.id ? "bg-[#ff7a18] text-[#1a0d04]" : "bg-white/6 text-[#d5deea]"}`}
              >
                {view.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAngles((value) => !value)}
              className={`rounded-full px-3 py-1.5 text-xs ${showAngles ? "bg-white text-[#101820]" : "bg-white/6 text-[#d5deea]"}`}
            >
              角度
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#101820] px-3 py-3">
            <div className="mb-2 flex items-center gap-2">
              <Button size="icon" variant="secondary" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "暫停" : "播放"}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <button
                type="button"
                onClick={() => seek(analysis.impactFrame)}
                className={`rounded-lg px-2.5 py-2 text-xs ${atImpact ? "bg-[#ff4d6a] text-white" : "bg-white/8 text-[#d5deea]"}`}
              >
                擊球定格
              </button>
              <button
                type="button"
                onClick={() => setSpeed((current) => SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length])}
                className="rounded-lg bg-white/8 px-2.5 py-2 text-xs tabular-nums text-[#d5deea]"
              >
                {speed}x
              </button>
              <p className="ml-auto text-xs tabular-nums text-[#93a4b8]">
                {formatClock(pose?.t ?? 0)} / {formatClock(duration)}
              </p>
            </div>
            <PhaseTimeline
              phases={analysis.phases}
              frame={frame}
              frameCount={analysis.frames.length}
              impactFrame={analysis.impactFrame}
              onSeek={seek}
            />
            <p className="mt-1 text-[11px] text-[#7f91a6]">拖曳時間軸可以逐幀睇。空白鍵播放，左右鍵逐幀。</p>
          </div>
        </div>

        <div className="space-y-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto lg:pr-1">
          <MetricsPanel analysis={analysis} frame={frame} />
          <TipsPanel tips={analysis.tips} />
          <p className="text-[11px] leading-relaxed text-[#7f91a6]">
            青色骨架係標準{strokeLabel}模板，按你嘅擊球時間對齊，再放到你嘅髖同朝向。拍係前臂延長，方便睇方向，唔係真實球拍追蹤。
          </p>
        </div>
      </div>
    </div>
  );
}
