"use client";

import { useEffect, useRef, useState } from "react";
import { BONES, JOINTS } from "@/lib/pose/landmarks";
import type { ImagePoint } from "@/lib/pose/types";

export function VideoInset({
  url,
  time,
  image,
}: {
  url: string;
  time: number;
  image: ImagePoint[] | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(0.75);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - time) > 0.07) video.currentTime = time;
  }, [time]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width < 2 || height < 2) return;
      if (canvas.width !== Math.round(width) || canvas.height !== Math.round(height)) {
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx || !image) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#ff7a18";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (const [a, b] of BONES) {
        const pa = image[a];
        const pb = image[b];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
        ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffb06a";
      for (const index of JOINTS) {
        const point = image[index];
        if (!point) continue;
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    video.addEventListener("seeked", draw);
    draw();
    return () => video.removeEventListener("seeked", draw);
  }, [image, time, ratio]);

  return (
    <div
      className="relative w-[32%] min-w-[96px] max-w-[180px] overflow-hidden rounded-lg border border-white/15 bg-black shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
      style={{ aspectRatio: ratio }}
    >
      <video
        ref={videoRef}
        src={url}
        muted
        playsInline
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setRatio(video.videoWidth / video.videoHeight);
          }
        }}
        className="h-full w-full object-contain"
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
