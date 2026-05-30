# Apartment renos

Next.js 16 (App Router, TypeScript) with **Firestore** via the Firebase JS SDK. **Local development uses the same cloud Firestore project** as production (no emulator, no local database). Env vars for the client are validated with **Zod** (`src/env.ts`).

**Repository:** [https://github.com/hslabs99/apartmentrenos](https://github.com/hslabs99/apartmentrenos)

**Production:** This repo is connected to **Firebase App Hosting** (deploy from GitHub in the Firebase console). Firestore remains in your chosen region (e.g. Sydney); App Hosting runs the Next.js app in the region you configured (e.g. Singapore).

## Prerequisites

- Node.js 20+
- npm
- `firebase-tools` is a dev dependency (for `firebase deploy`, etc.)

## Setup

1. Clone and install:

   ```bash
   git clone https://github.com/hslabs99/apartmentrenos.git
   cd apartmentrenos
   npm install
   ```

2. Environment variables:

   ```bash
   cp .env.example .env.local
   ```

   On Windows (cmd): `copy .env.example .env.local`

   `.env.example` includes your Firebase **web app** public config. Add **`FIREBASE_SERVICE_ACCOUNT_PATH`** or **`FIREBASE_SERVICE_ACCOUNT_JSON`** for API routes. **Do not commit** `.env.local`.

   | Variable | Notes |
   |----------|--------|
   | `NEXT_PUBLIC_FIREBASE_*` | Web app config (safe to expose in the client bundle). |
   | `FIREBASE_SERVICE_ACCOUNT_PATH` | **Server only.** Path to the downloaded **service account JSON file** (recommended). File should be listed in `.gitignore` (e.g. `*-firebase-adminsdk-*.json`). |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | **Server only.** Alternative: full JSON inline (one line). **Never commit** or paste keys in chat — rotate if exposed. |

   Do **not** set `FIRESTORE_EMULATOR_HOST` — the app refuses to start with it (cloud only).

## Users (admin CRUD)

- UI: **Users** in the app nav (`/users`). Tablet-first layout (large tap targets, sheet-style form on small screens).
- On first open, **`POST /api/users/init`** creates the **`users`** collection in Firestore (via a hidden `__collection_meta__` document). Collections only appear after the first write; this bootstrap is idempotent.
- Data: Firestore collection **`users`** with fields: `username`, `email`, `phone`, `type` (`user` \| `admin`), `passwordHash` (bcrypt), `createdAt`, `updatedAt`.
- Passwords are **never** stored in plain text; only a **bcrypt hash** is saved. **Login is not implemented** yet.
- Client apps cannot read/write `users` directly — rules deny it; only **Firebase Admin** (API routes) can.

## Local dev

```bash
npm run dev
```

Or on Windows, double‑click **`dev-web.bat`**.

Open [http://localhost:3000](http://localhost:3000) — the app redirects to **Projects**; use **Users** for staff CRUD.

**Important:** Leave that terminal window open while developing. If you press Ctrl+C or close the window, the dev server stops.

## Firebase project

- Default project alias: `apartmentrenos-1575e` (see `.firebaserc`). Change or add aliases with `firebase use --add`.

- `firestore.rules`: **`users`** documents are **denied** to clients (API-only). Other paths are still open for development — **tighten before production** (auth-scoped rules).

- `firestore.indexes.json` is empty; add composite indexes when you add queries that need them.

## npm scripts

| Script | Description |
|--------|-------------|
| `dev` | Next.js dev server (**Webpack**; better on Windows than Turbopack for many setups). |
| `dev:turbo` | Dev with **Turbopack** (opt-in). |
| `dev:fresh` | Deletes `.next`, then `dev` — use after manifest/chunk ENOENT errors. |
| `dev:clean` | Deletes `.next` only. |
| `build` | Production build (`next build --webpack`). |
| `start` | Run production server (after `build`). |
| `lint` | ESLint. |
| `typecheck` | `tsc --noEmit`. |

## Troubleshooting

| Symptom | What to do |
|--------|------------|
| **localhost refused to connect** / **can’t reach localhost:3000** | Run `npm run dev` from the project folder and leave the terminal running. |
| **Users** page shows a server error | Add **`FIREBASE_SERVICE_ACCOUNT_JSON`** or **`FIREBASE_SERVICE_ACCOUNT_PATH`** to `.env.local`. Restart `npm run dev`. |
| Error: **FIRESTORE_EMULATOR_HOST is set** | Remove `FIRESTORE_EMULATOR_HOST` from `.env.local` and your environment; this app uses cloud Firestore only. |
| **`PERMISSION_DENIED` / Firestore API / wrong project** | The **service account JSON** must be from the **same** Firebase project as **`NEXT_PUBLIC_FIREBASE_PROJECT_ID`**. In Firebase Console → **Project settings** → **Service accounts** → **Generate new private key** for the correct project. |
| **ENOENT** on `.next\...\app-build-manifest.json` or `_buildManifest.js.tmp.*` | Stop dev (Ctrl+C). Run **`npm run dev:fresh`** or **`dev-web-fresh.bat`**. Exclude the project folder (or `.next`) from Defender / cloud sync if it keeps happening. |

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, and `build` on pushes and PRs. Build-time `NEXT_PUBLIC_*` values are set in the workflow (placeholders — not secrets).

## Deploy

**App Hosting** is wired to this GitHub repo in the Firebase console; pushes to the connected branch trigger builds/deploys per your App Hosting settings.

For rules/indexes only: `firebase deploy --only firestore` (use `FIREBASE_TOKEN` or workload identity in CI — store in GitHub secrets, never in the repo).

## Tech stack

- Next.js 15, React 19, TypeScript (strict)
- Firebase JS SDK (client) where needed; **Firebase Admin** for `/api/*`
- Cloud Firestore only (no local emulator in this repo)
