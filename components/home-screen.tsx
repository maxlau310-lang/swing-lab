"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { analyzeDemoSwing } from "@/lib/pose/demo";
import { SAMPLE_VIDEO_URL } from "@/lib/pose/sample";
import type { Handedness, Stroke } from "@/lib/pose/types";

const SwingViewport = dynamic(
  () => import("@/components/swing-viewport").then((mod) => mod.SwingViewport),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-white/5" /> },
);

export function HomeScreen({
  stroke,
  handedness,
  onStroke,
  onHand,
  onDemo,
  onUpload,
  onRecord,
}: {
  stroke: Stroke;
  handedness: Handedness;
  onStroke: (stroke: Stroke) => void;
  onHand: (hand: Handedness) => void;
  onDemo: () => void;
  onUpload: () => void;
  onRecord: () => void;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const preview = useMemo(() => analyzeDemoSwing(stroke, handedness), [stroke, handedness]);
  const frame = preview.frames[preview.impactFrame];
  const corrected = preview.corrected[preview.impactFrame];

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6 sm:py-10">
      <p className="text-xs tracking-[0.18em] text-[#ffb27a]">揮拍鏡</p>
      <h1 className="mt-2 text-[1.7rem] font-medium leading-snug">影一次揮拍，睇自己同矯正骨架差喺邊。</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#b7c5d6]">
        正手同反手。橙色係你，青色係對齊時間嘅標準動作。擊球會自動定格，再用廣東話講邊度要改。
      </p>

      <div className="relative mt-5 h-56 overflow-hidden rounded-2xl border border-white/10">
        {frame && corrected && (
          <SwingViewport
            user={frame.landmarks}
            corrected={corrected.landmarks}
            viewMode="split"
            preset="threeq"
            showAngles
            handedness={handedness}
            highlightImpact
            autoRotate={!reduceMotion}
          />
        )}
        <p className="pointer-events-none absolute bottom-10 left-[18%] text-xs font-medium text-[#ff7a18]">你</p>
        <p className="pointer-events-none absolute bottom-10 right-[18%] text-xs font-medium text-[#3ee0ff]">矯正</p>
        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-[#93a4b8]">拖曳可以轉角度 · 示範正喺擊球定格</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Choice label="正手" selected={stroke === "forehand"} onClick={() => onStroke("forehand")} />
        <Choice label="反手" selected={stroke === "backhand"} onClick={() => onStroke("backhand")} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Choice label="右手持拍" selected={handedness === "right"} onClick={() => onHand("right")} compact />
        <Choice label="左手持拍" selected={handedness === "left"} onClick={() => onHand("left")} compact />
      </div>

      <div className="mt-5 grid gap-2">
        <Button size="lg" onClick={onRecord}>
          用鏡頭影
        </Button>
        <Button size="lg" variant="secondary" onClick={onUpload}>
          上傳影片
        </Button>
        <Button size="lg" variant="outline" onClick={onDemo}>
          睇示範{stroke === "forehand" ? "正手" : "反手"}
        </Button>
      </div>

      <details className="mt-6 rounded-2xl border border-white/10 bg-[#101820] px-4 py-3 text-sm text-[#c5d2e0]">
        <summary className="cursor-pointer text-[#e8eef6]">點樣影先分析得準</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed">
          <li>而家用背面就得：手機放喺你背後，離人 3–5 米，由頭頂到對腳入鏡。</li>
          <li>手肘、膝蓋、前傾、轉腰喺背面都計到。「身前」係深度估計，側拍或正拍會準啲，唔使等齊先用。</li>
          <li>一次只揮一拍，前後留大約一秒。片長超過 8 秒會只分析開頭。</li>
          <li>
            本機 mp4 用「上傳影片」。參考片段{" "}
            <a className="underline" href={SAMPLE_VIDEO_URL} target="_blank" rel="noreferrer">
              youtu.be/z3tyemb2tRw
            </a>
            ，請自行儲存再上傳。
          </li>
          <li>反手按業餘雙手反手嚟比。發球呢版未做。矯正骨架係標準模板。</li>
        </ul>
      </details>
    </div>
  );
}

function Choice({
  label,
  selected,
  onClick,
  compact,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border text-sm ${compact ? "h-10" : "h-12"} ${selected ? "border-[#ff7a18] bg-[#ff7a18]/15 text-white" : "border-white/10 bg-white/[0.03] text-[#c5d2e0]"}`}
    >
      {label}
    </button>
  );
}
