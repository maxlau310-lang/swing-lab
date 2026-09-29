"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function RecordScreen({
  onDone,
  onCancel,
}: {
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    aliveRef.current = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("呢個瀏覽器開唔到鏡頭。改用上傳影片，或者用電腦 Chrome / 手機 Safari 開。");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        if (videoRef.current) {
          videoRef.current.srcObject = next;
          void videoRef.current.play();
        }
      })
      .catch(() => {
        setError("用唔到鏡頭。檢查權限，或者改為上傳影片。");
      });
    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  function start() {
    const stream = videoRef.current?.srcObject;
    if (!(stream instanceof MediaStream) || recording) return;
    const mime = pickMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (!aliveRef.current) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || "video/webm" });
      onDone(blob);
    };
    recorderRef.current = recorder;
    recorder.start(120);
    setRecording(true);
    const started = performance.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      setSeconds(elapsed);
      if (elapsed >= 8) stop();
    }, 100);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          取消
        </Button>
        <p className="text-sm tabular-nums text-[#d5deea]">{recording ? `${seconds.toFixed(1)} / 8.0 秒` : "準備影"}</p>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} muted playsInline autoPlay className="h-full min-h-[50vh] w-full object-cover" />
        <p className="pointer-events-none absolute inset-x-4 bottom-4 text-center text-sm text-white/90">
          成個身入鏡，手機放喺你背後。一次只揮一拍。
        </p>
      </div>
      {error && <p className="mt-3 text-sm text-[#ffb3c0]">{error}</p>}
      <div className="mt-4 flex justify-center pb-2">
        {recording ? (
          <Button variant="danger" size="lg" onClick={stop}>
            停
          </Button>
        ) : (
          <Button size="lg" onClick={start} disabled={Boolean(error)}>
            開始影（最多 8 秒）
          </Button>
        )}
      </div>
    </div>
  );
}

export function ClipPreview({
  url,
  onAnalyze,
  onRetake,
  retakeLabel,
}: {
  url: string;
  onAnalyze: () => void;
  onRetake: () => void;
  retakeLabel: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-4">
      <h1 className="text-lg font-medium">睇下條片</h1>
      <p className="mt-1 text-sm text-[#93a4b8]">成個揮拍要喺開頭 8 秒入面。滿意就開始逐幀分析。</p>
      <video src={url} controls playsInline className="mt-4 max-h-[60vh] w-full rounded-2xl bg-black" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onRetake}>
          {retakeLabel}
        </Button>
        <Button onClick={onAnalyze}>開始分析</Button>
      </div>
    </div>
  );
}

export function AnalyzingScreen({
  progress,
  label,
  onCancel,
}: {
  progress: number;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6">
      <p className="text-sm text-[#93a4b8]">揮拍鏡</p>
      <h1 className="mt-2 text-2xl font-medium">分析緊</h1>
      <p className="mt-2 text-sm text-[#d5deea]">{label}</p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#ff7a18]" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs tabular-nums text-[#93a4b8]">{Math.round(progress * 100)}%</p>
      <Button variant="ghost" className="mt-6 self-start" onClick={onCancel}>
        取消
      </Button>
    </div>
  );
}
