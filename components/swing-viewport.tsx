"use client";

import { Line, OrbitControls, Grid } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { BONES, dominantSide } from "@/lib/pose/landmarks";
import type { Handedness, ViewMode } from "@/lib/pose/types";
import { add, cross, length, mid, norm, scale, sub, type Vec3 } from "@/lib/pose/vec";

export type CameraPreset = "back" | "threeq" | "side" | "front";

const PRESETS: Record<CameraPreset, [number, number, number]> = {
  back: [0.2, 1.5, -3.6],
  threeq: [1.25, 1.55, 3.55],
  side: [4.15, 1.35, 0.35],
  front: [0.15, 1.42, 4.05],
};

const USER = "#ff7a18";
const CORRECTED = "#3ee0ff";

type OrbitLike = {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
};

function frameLayout(split: boolean, aspect: number) {
  const safeAspect = Math.max(0.4, aspect);
  const gap = split ? Math.min(1.15, Math.max(0.62, safeAspect * 0.72)) : 0;
  const span = gap * 2 + (split ? 1.55 : 1.8);
  const vFov = (38 * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);
  const dist = span / 2 / Math.tan(hFov / 2);
  return { gap, dist: Math.max(2.6, dist) };
}

function Rig({ preset, split }: { preset: CameraPreset; split: boolean }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;

  useEffect(() => {
    let frame = 0;
    let raf = 0;
    const apply = () => {
      const [x, , z] = PRESETS[preset];
      const len = Math.hypot(x, z) || 1;
      const { dist } = frameLayout(split, size.width / Math.max(1, size.height));
      camera.position.set((x / len) * dist, 0.9 + dist * 0.22, (z / len) * dist);
      camera.lookAt(0, 0.9, 0);
      if (controls) {
        controls.target.set(0, 0.9, 0);
        controls.update();
        return;
      }
      if (frame < 12) {
        frame += 1;
        raf = requestAnimationFrame(apply);
      }
    };
    apply();
    return () => cancelAnimationFrame(raf);
  }, [preset, split, size.width, size.height, camera, controls]);

  return null;
}

function headOf(pose: Vec3[]): Vec3 {
  const neck = mid(pose[11], pose[12]);
  const dir = sub(pose[0], neck);
  if (length(dir) < 1e-4) return add(neck, { x: 0, y: 0.18, z: 0 });
  return add(neck, scale(norm(dir), Math.min(length(dir) * 0.62, 0.2)));
}

function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const ua = norm(a);
  const ub = norm(b);
  const d = Math.min(1, Math.max(-1, ua.x * ub.x + ua.y * ub.y + ua.z * ub.z));
  const omega = Math.acos(d);
  if (omega < 1e-3) return ua;
  const s = Math.sin(omega);
  return add(
    scale(ua, Math.sin((1 - t) * omega) / s),
    scale(ub, Math.sin(t * omega) / s),
  );
}

function AngleArc({ joint, a, c, color }: { joint: Vec3; a: Vec3; c: Vec3; color: string }) {
  const points: [number, number, number][] = [];
  const va = sub(a, joint);
  const vc = sub(c, joint);
  if (length(va) < 1e-4 || length(vc) < 1e-4) return null;
  for (let i = 0; i <= 14; i += 1) {
    const p = add(joint, scale(slerp(va, vc, i / 14), 0.1));
    points.push([p.x, p.y, p.z]);
  }
  return <Line points={points} color={color} lineWidth={1.4} />;
}

function Racket({ elbow, wrist, color, opacity }: { elbow: Vec3; wrist: Vec3; color: string; opacity: number }) {
  const dir = norm(sub(wrist, elbow));
  if (length(dir) < 1e-4) return null;
  const grip = add(wrist, scale(dir, 0.04));
  const tip = add(wrist, scale(dir, 0.64));
  const head = add(wrist, scale(dir, 0.48));
  let side = cross(dir, { x: 0, y: 1, z: 0 });
  if (length(side) < 1e-4) side = { x: 1, y: 0, z: 0 };
  side = norm(side);
  const hoopUp = norm(cross(side, dir));
  const hoop: [number, number, number][] = [];
  for (let i = 0; i <= 22; i += 1) {
    const a = (i / 22) * Math.PI * 2;
    const p = add(head, add(scale(side, Math.cos(a) * 0.085), scale(hoopUp, Math.sin(a) * 0.12)));
    hoop.push([p.x, p.y, p.z]);
  }
  return (
    <group>
      <Line points={[[grip.x, grip.y, grip.z], [tip.x, tip.y, tip.z]]} color={color} lineWidth={1.5} transparent opacity={opacity} />
      <Line points={hoop} color={color} lineWidth={1.3} transparent opacity={opacity} />
    </group>
  );
}

function Skeleton({
  pose,
  color,
  opacity = 1,
  showAngles,
  handedness,
}: {
  pose: Vec3[];
  color: string;
  opacity?: number;
  showAngles?: boolean;
  handedness: Handedness;
}) {
  const dom = dominantSide(handedness);
  const head = headOf(pose);
  const neck = mid(pose[11], pose[12]);

  return (
    <group>
      {BONES.map(([a, b]) => {
        const pa = pose[a];
        const pb = pose[b];
        if (length(sub(pa, pb)) < 1e-4) return null;
        const points: [number, number, number][] = [
          [pa.x, pa.y, pa.z],
          [pb.x, pb.y, pb.z],
        ];
        return (
          <group key={`${a}-${b}`}>
            <Line points={points} color={color} lineWidth={6} transparent opacity={0.16 * opacity} />
            <Line points={points} color={color} lineWidth={2.3} transparent opacity={opacity} />
          </group>
        );
      })}
      <Line
        points={[
          [neck.x, neck.y, neck.z],
          [head.x, head.y, head.z],
        ]}
        color={color}
        lineWidth={2.3}
        transparent
        opacity={opacity}
      />
      <mesh position={[head.x, head.y, head.z]}>
        <sphereGeometry args={[0.07, 18, 14]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {[11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].map((index) => (
        <mesh key={index} position={[pose[index].x, pose[index].y, pose[index].z]}>
          <sphereGeometry args={[index === dom.wrist ? 0.034 : 0.026, 14, 12]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      ))}
      <Racket elbow={pose[dom.elbow]} wrist={pose[dom.wrist]} color={color} opacity={opacity} />
      {showAngles && (
        <group>
          <AngleArc joint={pose[dom.elbow]} a={pose[dom.shoulder]} c={pose[dom.wrist]} color={color} />
          <AngleArc joint={pose[dom.knee]} a={pose[dom.hip]} c={pose[dom.ankle]} color={color} />
        </group>
      )}
    </group>
  );
}

function Scene({
  user,
  corrected,
  viewMode,
  preset,
  showAngles,
  handedness,
  highlightImpact,
  autoRotate,
}: {
  user: Vec3[];
  corrected: Vec3[];
  viewMode: ViewMode;
  preset: CameraPreset;
  showAngles: boolean;
  handedness: Handedness;
  highlightImpact: boolean;
  autoRotate?: boolean;
}) {
  const split = viewMode === "split";
  const showUser = viewMode !== "corrected";
  const showCorrected = viewMode !== "user";
  const size = useThree((state) => state.size);
  const gap = frameLayout(split, size.width / Math.max(1, size.height)).gap;
  const hip = mid(user[23], user[24]);

  return (
    <>
      <color attach="background" args={["#070b12"]} />
      <ambientLight intensity={0.8} />
      <Grid
        position={[0, 0, 0]}
        args={[12, 12]}
        cellSize={0.25}
        cellThickness={0.6}
        cellColor="#163044"
        sectionSize={1}
        sectionThickness={1.1}
        sectionColor="#1e4a66"
        fadeDistance={8}
        fadeStrength={1.6}
        infiniteGrid
      />
      <Rig preset={preset} split={split} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.8}
        maxDistance={8}
        maxPolarAngle={Math.PI / 2 - 0.04}
        target={[0, 0.9, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={0.55}
      />
      {showUser && (
        <group position={[-gap, 0, 0]}>
          <Skeleton pose={user} color={USER} handedness={handedness} showAngles={showAngles} />
        </group>
      )}
      {showCorrected && (
        <group position={[gap, 0, 0]}>
          <Skeleton
            pose={corrected}
            color={CORRECTED}
            opacity={viewMode === "overlay" ? 0.95 : 1}
            handedness={handedness}
            showAngles={showAngles && viewMode === "corrected"}
          />
        </group>
      )}
      {highlightImpact && showUser && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[hip.x - gap, 0.012, hip.z]}>
          <ringGeometry args={[0.18, 0.23, 40]} />
          <meshBasicMaterial color="#ff4d6a" />
        </mesh>
      )}
    </>
  );
}

export function SwingViewport({
  user,
  corrected,
  viewMode,
  preset,
  showAngles,
  handedness,
  highlightImpact,
  autoRotate,
}: {
  user: Vec3[];
  corrected: Vec3[];
  viewMode: ViewMode;
  preset: CameraPreset;
  showAngles: boolean;
  handedness: Handedness;
  highlightImpact: boolean;
  autoRotate?: boolean;
}) {
  return (
    <Canvas
      camera={{ position: PRESETS.threeq, fov: 38, near: 0.1, far: 40 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false }}
      className="touch-none"
    >
      <Scene
        user={user}
        corrected={corrected}
        viewMode={viewMode}
        preset={preset}
        showAngles={showAngles}
        handedness={handedness}
        highlightImpact={highlightImpact}
        autoRotate={autoRotate}
      />
    </Canvas>
  );
}
