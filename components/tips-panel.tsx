"use client";

import type { Tip } from "@/lib/pose/types";

const STYLE = {
  high: {
    label: "要改",
    card: "border-[#ff4d6a]/50 bg-[#2a1218]",
    badge: "bg-[#ff4d6a] text-white",
  },
  mid: {
    label: "留意",
    card: "border-[#ffb020]/40 bg-[#2a2112]",
    badge: "bg-[#ffb020] text-[#2a1a04]",
  },
  good: {
    label: "做得好",
    card: "border-[#3ddc97]/35 bg-[#10241c]",
    badge: "bg-[#3ddc97] text-[#062116]",
  },
} as const;

export function TipsPanel({ tips }: { tips: Tip[] }) {
  const problems = tips.filter((tip) => tip.severity !== "good").length;
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{problems > 0 ? "教練建議" : "呢下揮得幾穩"}</h2>
        <p className="text-[11px] text-[#93a4b8]">
          {problems > 0 ? `${problems} 項要睇` : "維持住"}
        </p>
      </div>
      <ol className="space-y-2">
        {tips.map((tip, index) => {
          const style = STYLE[tip.severity];
          return (
            <li key={tip.id} className={`rounded-xl border px-3 py-3 ${style.card}`}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 w-4 text-xs tabular-nums text-white/50">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{tip.title}</p>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>{style.label}</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#d5deea]">{tip.detail}</p>
                  {tip.cue && (
                    <p className="mt-2 text-[13px] leading-relaxed text-white">
                      <span className="text-[#93a4b8]">可以咁改：</span>
                      {tip.cue}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
