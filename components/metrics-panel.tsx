"use client";

import { meterSpecs, type MeterSpec } from "@/lib/pose/tips";
import type { Analysis, FrameMetrics } from "@/lib/pose/types";

function readValue(spec: MeterSpec, live: FrameMetrics, report: Analysis["report"]): number {
  if (spec.key === "hipTravelDeg") return report.hipTravelDeg;
  if (spec.key === "followCrossCm") return report.followCrossCm;
  return live[spec.key];
}

function Meter({ spec, value, impactValue }: { spec: MeterSpec; value: number; impactValue: number }) {
  const span = spec.max - spec.min || 1;
  const pct = (n: number) => Math.min(100, Math.max(0, ((n - spec.min) / span) * 100));
  const inRange = value >= spec.lo && value <= spec.hi;
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] text-[#93a4b8]">{spec.label}</p>
        <p className={`text-sm font-medium tabular-nums ${inRange ? "text-[#b8f3d8]" : "text-[#ffd0d8]"}`}>
          {Math.round(value)}
          {spec.unit}
        </p>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 rounded-full bg-[#3ddc97]/45"
          style={{ left: `${pct(spec.lo)}%`, width: `${Math.max(0, pct(spec.hi) - pct(spec.lo))}%` }}
        />
        <div className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-white" style={{ left: `${pct(value)}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] text-[#7f91a6]">
        {spec.live ? `擊球 ${Math.round(impactValue)}${spec.unit} · ` : "成個揮拍 · "}
        目標 {spec.lo}–{spec.hi}
        {spec.unit}
      </p>
    </div>
  );
}

export function MetricsPanel({ analysis, frame }: { analysis: Analysis; frame: number }) {
  const specs = meterSpecs(analysis.stroke);
  const live = analysis.metrics[frame] ?? analysis.metrics[analysis.impactFrame];
  const atImpact = analysis.metrics[analysis.impactFrame];
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">量化指標</h2>
        <p className="text-[11px] text-[#93a4b8]">綠區係目標範圍</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {specs.map((spec) => (
          <Meter
            key={spec.key}
            spec={spec}
            value={readValue(spec, live, analysis.report)}
            impactValue={readValue(spec, atImpact, analysis.report)}
          />
        ))}
      </div>
    </section>
  );
}
