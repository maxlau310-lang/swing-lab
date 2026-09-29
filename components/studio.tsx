"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisView } from "@/components/analysis-view";
import { AnalyzingScreen, ClipPreview, RecordScreen } from "@/components/capture";
import { HomeScreen } from "@/components/home-screen";
import { Button } from "@/components/ui/button";
import { analyzeDemoSwing } from "@/lib/pose/demo";
import { SwingInputError, type Analysis, type Handedness, type Stroke } from "@/lib/pose/types";

type Stage =
  | { name: "home" }
  | { name: "record" }
  | { name: "preview"; blob: Blob; url: string; from: "record" | "upload" }
  | { name: "analyzing"; blob: Blob; url: string; progress: number; label: string }
  | { name: "result"; analysis: Analysis; url: string | null }
  | { name: "error"; message: string };

const PREF_KEY = "swing-mirror-prefs";

export function Studio() {
  const [stroke, setStroke] = useState<Stroke>("forehand");
  const [handedness, setHandedness] = useState<Handedness>("right");
  const [stage, setStage] = useState<Stage>({ name: "home" });
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "");
      if (saved.stroke === "forehand" || saved.stroke === "backhand") setStroke(saved.stroke);
      if (saved.handedness === "left" || saved.handedness === "right") setHandedness(saved.handedness);
    } catch {
      /* first visit */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify({ stroke, handedness }));
  }, [stroke, handedness]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function rememberUrl(url: string | null) {
    if (urlRef.current && urlRef.current !== url) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
  }

  function goHome() {
    abortRef.current?.abort();
    rememberUrl(null);
    setStage({ name: "home" });
  }

  function openBlob(blob: Blob, from: "record" | "upload") {
    const url = URL.createObjectURL(blob);
    rememberUrl(url);
    setStage({ name: "preview", blob, url, from });
  }

  async function analyzeBlob(blob: Blob, url: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStage({ name: "analyzing", blob, url, progress: 0.02, label: "載入姿態模型…" });
    try {
      const { analyzeVideoFile } = await import("@/lib/pose/video");
      const analysis = await analyzeVideoFile(blob, {
        stroke,
        handedness,
        signal: controller.signal,
        onProgress: (progress, label) => {
          setStage((current) => (current.name === "analyzing" ? { ...current, progress, label } : current));
        },
      });
      if (controller.signal.aborted) return;
      setStage({ name: "result", analysis, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error(error);
      const message = error instanceof SwingInputError ? error.message : "分析失敗。試下另一段片，或者先睇示範。";
      setStage({ name: "error", message });
    }
  }

  return (
    <main className="min-h-dvh">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) openBlob(file, "upload");
        }}
      />

      {stage.name === "home" && (
        <HomeScreen
          stroke={stroke}
          handedness={handedness}
          onStroke={setStroke}
          onHand={setHandedness}
          onDemo={() => setStage({ name: "result", analysis: analyzeDemoSwing(stroke, handedness), url: null })}
          onUpload={() => fileRef.current?.click()}
          onRecord={() => setStage({ name: "record" })}
        />
      )}

      {stage.name === "record" && <RecordScreen onCancel={goHome} onDone={(blob) => openBlob(blob, "record")} />}

      {stage.name === "preview" && (
        <ClipPreview
          url={stage.url}
          retakeLabel={stage.from === "record" ? "重新影" : "再選一條"}
          onRetake={() => (stage.from === "record" ? setStage({ name: "record" }) : fileRef.current?.click())}
          onAnalyze={() => void analyzeBlob(stage.blob, stage.url)}
        />
      )}

      {stage.name === "analyzing" && (
        <AnalyzingScreen
          progress={stage.progress}
          label={stage.label}
          onCancel={goHome}
        />
      )}

      {stage.name === "result" && (
        <AnalysisView analysis={stage.analysis} videoUrl={stage.url} onBack={goHome} />
      )}

      {stage.name === "error" && (
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6">
          <p className="text-sm text-[#ffb3c0]">分析唔到</p>
          <h1 className="mt-2 text-2xl font-medium">再試一次</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#d5deea]">{stage.message}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => setStage({ name: "result", analysis: analyzeDemoSwing(stroke, handedness), url: null })}>
              改睇示範
            </Button>
            <Button variant="outline" onClick={goHome}>
              返回
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
