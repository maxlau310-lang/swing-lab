"use client";

import { phaseAt } from "@/lib/pose/phases";
import type { PhaseName, PhaseSpan } from "@/lib/pose/types";

const META: Record<PhaseName, { label: string; bar: string; text: string }> = {
  backswing: { label: "引拍", bar: "bg-[#3c6fd8]", text: "text-[#9db7ff]" },
  impact: { label: "擊球", bar: "bg-[#e24b66]", text: "text-[#ffb3c0]" },
  follow: { label: "隨揮", bar: "bg-[#149cb8]", text: "text-[#8eebf8]" },
};

export function PhaseTimeline({
  phases,
  frame,
  frameCount,
  impactFrame,
  onSeek,
}: {
  phases: PhaseSpan[];
  frame: number;
  frameCount: number;
  impactFrame: number;
  onSeek: (frame: number) => void;
}) {
  const current = phaseAt(phases, frame);
  const playhead = frameCount <= 1 ? 0 : (frame / (frameCount - 1)) * 100;
  const impactPct = frameCount <= 1 ? 0 : (impactFrame / (frameCount - 1)) * 100;

  return (
    <div className="space-y-2">
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-3 flex h-2 overflow-hidden rounded-full bg-white/5">
          {phases.map((phase) => (
            <div
              key={phase.name}
              className={META[phase.name].bar}
              style={{ width: `${((phase.end - phase.start) / frameCount) * 100}%` }}
            />
          ))}
        </div>
        <div
          className="pointer-events-none absolute top-1 h-6 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_3px_rgba(7,11,18,0.8)]"
          style={{ left: `${playhead}%` }}
        />
        <div
          className="pointer-events-none absolute top-2 h-2 w-2 -translate-x-1/2 rotate-45 border border-[#ffd0d8] bg-[#ff4d6a]"
          style={{ left: `${impactPct}%` }}
          title="擊球"
        />
        <input
          aria-label="揮拍時間軸"
          type="range"
          min={0}
          max={Math.max(0, frameCount - 1)}
          value={frame}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="flex text-[11px]">
        {phases.map((phase) => (
          <button
            key={phase.name}
            type="button"
            onClick={() => onSeek(Math.min(frameCount - 1, phase.start + Math.floor((phase.end - phase.start) / 2)))}
            className={`truncate text-center ${current === phase.name ? "font-medium text-white" : META[phase.name].text}`}
            style={{ width: `${((phase.end - phase.start) / frameCount) * 100}%` }}
          >
            {META[phase.name].label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function phaseLabel(name: PhaseName, atImpact: boolean): string {
  if (atImpact) return "擊球瞬間";
  return META[name].label;
}
