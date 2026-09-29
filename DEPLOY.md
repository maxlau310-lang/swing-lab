# Deploy 揮拍鏡 to Cloudflare Pages

Origin stays the source of truth for development: [cursor.com/codebase/max-lau/swing-lab](https://cursor.com/codebase/max-lau/swing-lab). GitHub is a **deploy mirror only**. Cloudflare Pages (free) builds that mirror and serves the site. This path does not use Vercel and does not need Vercel Pro.

## Why a static export

The app is one Next.js page. Recording, upload, MediaPipe pose, the skeleton viewer, metrics, and tips all run in the browser. There is no API route, database, or server render that the product depends on. `output: "export"` writes a static site to `out/`. Pages hosts that folder. The phone camera works because the Pages URL is HTTPS.

OpenNext / a Cloudflare Worker is not required. Do not pick a Vercel or “Next.js (server)” preset.

## What Cloudflare should run

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` (repository root) |
| Framework preset | **Next.js (Static HTML Export)** if that preset is listed. Otherwise **None**. |
| Build command | `npm run pages:build` |
| Build output directory | `out` |
| Node.js | `22` (also in `.node-version`). Set the environment variable `NODE_VERSION` to `22`. |
| Environment variables | Only `NODE_VERSION=22`. No API keys. |

`npm install` runs `postinstall`, which copies MediaPipe’s WASM files into `public/mediapipe` before the build. Those files are not committed. The pose model in `public/models/` is committed.

Local check, from WSL or any terminal where this repo is checked out:

```bash
npm install
npm run pages:build
```

`out/index.html` should exist. `npm run preview` serves that folder on port 38471 with Wrangler.

## 1. Create the empty GitHub repo

PowerShell cannot run the Origin CLI, and this environment is not logged into GitHub, so the mirror is not pushed yet. Use the GitHub website. Do this once.

1. Open [github.com/new](https://github.com/new) and sign in.
2. Repository name: `swing-lab`.
3. Private is fine. Cloudflare can build a private repo after you authorize it.
4. Leave **Add a README**, **.gitignore**, and **license** unchecked. The repo must be empty.
5. Click **Create repository**. Leave the page open so you can copy the URL (`https://github.com/<your-user>/swing-lab`).

## 2. Push `main` from WSL

Clone the Origin repo first if it is not already on the machine ([Origin CLI](https://cursor.com/docs/origin/cli)):

```bash
curl -fsSL https://downloads.cursor.com/origin/install.sh | sh
origin auth login
origin repo clone max-lau/swing-lab
cd swing-lab
```

If `origin` is not found:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Install and sign in to the GitHub CLI in that same WSL terminal (not PowerShell), then point this clone at the empty repo and push. Replace `<your-user>` with the GitHub username that owns the new repo.

```bash
sudo apt update && sudo apt install -y gh
gh auth login
git remote add github https://github.com/<your-user>/swing-lab.git
git push -u github main
```

If `github` already exists, use `git remote set-url github https://github.com/<your-user>/swing-lab.git` instead of `git remote add`.

Develop in Origin. When the site should update, push `main` to the `github` remote again. Do not treat the GitHub repo as the place to edit. A later Cursor session can run that push once GitHub is signed in (`gh auth login` in WSL) or once you paste the empty repo URL into the agent.

## 3. Connect Cloudflare Pages

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) and create a free account if you need one.
2. **Workers & Pages** → **Create**.
3. Choose **Pages** → **Connect to Git**.
4. Authorize GitHub and select the `swing-lab` repository. Production branch: `main`.
5. Set the build fields from the table above. Add environment variable `NODE_VERSION` = `22`.
6. Click **Save and Deploy**.

The first build installs dependencies, copies the MediaPipe WASM runtime, and writes `out/`. When it finishes, Pages shows an `https://….pages.dev` URL.

## 4. Use it on a phone

Open that `https://….pages.dev` URL in the phone browser. HTTPS is what the camera needs. Same-LAN `http://192.168…` is only a local-dev fallback and usually blocks the lens; upload from the camera roll in that case.

Recording, file upload, the canned demo, and pose analysis stay in the browser. Nothing is sent to a swing-analysis server.
