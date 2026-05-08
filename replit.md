# Workspace

## Overview

pnpm workspace monorepo using TypeScript. WebSnap — a desktop-only web app that takes a URL, discovers all same-domain linked pages (one hop), takes full-page screenshots, and delivers them as a ZIP file.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (not used by WebSnap, available if needed)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Screenshots**: playwright-extra + puppeteer-extra-plugin-stealth + system Chromium
- **ZIP generation**: archiver

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (screenshot engine + job management)
│   └── websnap/            # React + Vite frontend (at /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## WebSnap App

### How it works
1. User submits a URL
2. Backend discovers all same-domain `<a href>` links (one hop only, max 50)
3. Takes full-page screenshots sequentially at 1440px width using Playwright + stealth plugin
4. Bundles screenshots + index.txt into a ZIP file for download

### Backend (artifacts/api-server)
- `src/lib/screenshotter.ts` — Playwright-based screenshot engine with stealth, link discovery, bot-wall detection
- `src/routes/jobs.ts` — Job management endpoints (POST /jobs, GET /jobs/:id, POST /jobs/:id/cancel, GET /jobs/:id/download)
- In-memory job queue, one job at a time, max 50 URLs, 10s timeout per page
- Uses system Chromium at `/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium`
  - Override with `CHROMIUM_EXECUTABLE_PATH` env var if needed

### Frontend (artifacts/websnap)
- Single-page React app at `/`
- URL input with validation, Start/Cancel button
- Live terminal-style progress log (polls every 1.5s)
- Download button appears when job completes

### API Routes
- `POST /api/jobs` — start a screenshot job
- `GET /api/jobs/:id` — poll status and log
- `POST /api/jobs/:id/cancel` — abort running job
- `GET /api/jobs/:id/download` — stream ZIP file

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`. Screenshot engine in `src/lib/screenshotter.ts`.

- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle

### `artifacts/websnap` (`@workspace/websnap`)

React + Vite frontend at `/`. 

- `pnpm --filter @workspace/websnap run dev` — run the dev server

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec + Orval codegen. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/db` (`@workspace/db`)

Database layer (not used by WebSnap currently). Available for future features.
