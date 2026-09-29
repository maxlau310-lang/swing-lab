# 揮拍鏡

Local web tool for amateur tennis players. Film or upload one forehand or backhand, compare your skeleton with a corrected skeleton, and read coaching notes in Cantonese / Traditional Chinese.

Orange is you. Cyan is a time-aligned ideal template. The clip freezes on the estimated impact frame, with joint angles, a three-phase timeline (引拍 / 擊球 / 隨揮), numeric metrics, and 4–6 tips.

Serve is out of scope. There is no account, feed, or native app.

Development stays in this Origin repo. The public site is a static export on Cloudflare Pages (free). GitHub is only the deploy mirror. See [DEPLOY.md](DEPLOY.md). Do not use Vercel.

## Run locally

npm is the lockfile this repo ships. pnpm runs the same scripts.

```bash
npm install
npm run dev
```

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:38471](http://127.0.0.1:38471).

`npm install` / `pnpm install` copies MediaPipe’s WASM runtime into `public/mediapipe`. The pose model is already in `public/models/pose_landmarker_lite.task` (Apache-2.0, Google MediaPipe).

### Phone

The hosted site is HTTPS (`https://….pages.dev`), so the phone camera works there. Open that URL; you do not need the computer and the phone on the same Wi-Fi.

`npm run dev` is still `http://127.0.0.1:38471` on the computer. A raw `http://192.168…` address usually blocks the camera. Use the Pages URL for the phone, or upload a video from the camera roll while developing.

## Sample clip

Reference footage: [youtu.be/z3tyemb2tRw](https://youtu.be/z3tyemb2tRw?si=dD_46s-OgfhBLwmg)

YouTube download is blocked here (the site asks to sign in / confirm you are not a bot), so the clip is not bundled. Two ways to see the product without that file:

1. **睇示範** — a canned flawed forehand and a flawed two-handed backhand. No camera, no upload.
2. **上傳影片** — save that YouTube video, or any phone mp4, and pick the file. The app reads the first 8 seconds. Trim to one swing when you can (`ffmpeg -ss START -t 8 -i clip.mp4 -c copy swing.mp4`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `pnpm dev` | Next.js dev server on port 38471 |
| `npm test` / `pnpm test` | Vitest for phase detection, metrics, tips, and the demo swings |
| `npm run lint` / `pnpm lint` | ESLint |
| `npm run build` / `npm run pages:build` | Static export into `out/` (what Cloudflare Pages builds) |
| `npm run preview` | Serve `out/` the way Pages does. Run `pages:build` first. |

## How a session works

1. Choose 正手 or 反手, and which hand holds the racket.
2. Record (up to 8 seconds), upload a local video, or open the built-in flawed demo.
3. Video is sampled at about 12 fps (first 8 seconds, max ~96 frames). Each frame runs MediaPipe Pose (33 landmarks) in the browser.
4. The clip frame uses the hip line as anatomical right, so a camera **behind** the player does not mirror follow-through. Impact is the end of the fast burst of the dominant wrist. Phases are takeback, contact, and follow-through.
5. From the 2D pose the app guesses back, side, or front. Back view downgrades a mild “too close / too far in front” tip. A hand that is actually behind the body stays a high-severity miss.
6. The corrected skeleton is a standard forehand or two-handed backhand, time-warped to your phases, scaled to your torso, and placed on your hip center and facing direction. It is a template morph, not a learned coaching model.
7. Tips are threshold rules. Numbers in the copy come from your clip.

The 3D viewer opens on **背面**, matching the footage available now. 斜面 / 側面 / 正面 are camera presets for looking at the skeleton, not a claim about how the phone was placed. The racket drawn in 3D is the forearm extended. It is not a tracked racket.

## What phone video works

Back view is the supported setup for this version. Side and front footage, when you have it, improves the “in front of the body” number. Do not wait for that to use the app.

- Phone behind the player, about 3–5 m away, roughly hip to chest height.
- Full body in frame, head to feet, one person.
- Enough light that the limbs are not a blur. Avoid a cluttered background and baggy dark clothes if you can.
- One swing only, with about a second of ready position before it and the follow-through after it.
- Clips longer than 8 seconds are cut to the first 8 seconds.
- Usable from behind: elbow, knee, torso lean, hip rotation, hand height, follow-through across the body.
- Noisier from behind: how far in front of the body the hand meets the ball. That distance is a depth estimate. The app says so, and it softens a small miss.
- A later side or front clip will tighten that depth number. Elbow, knee, and lean stay useful either way.
- Backhand thresholds assume a two-handed backhand, the usual amateur pattern.

## Stack

Next.js (App Router, static export), React, TypeScript, Tailwind, MediaPipe Tasks Vision (Pose Landmarker lite), Three.js via React Three Fiber. Session state stays in the browser. Stroke and hand preference are stored in `localStorage`. No backend. Production is Cloudflare Pages serving the `out/` folder over HTTPS.

## Limits

- One player, forehand and backhand only.
- Advice is rule-based against a single ideal template per stroke.
- Pose estimation fails when the body is cut off, the court is very dark, or motion blur hides the limbs.
- Left-handed clips are mirrored into a right-handed analysis space, then mirrored back for display. Set the hand toggle correctly.
- The canned demo is a synthetic pose sequence, not the YouTube reference clip.
