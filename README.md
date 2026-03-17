# StackLens

**See the developer behind the repositories.**

StackLens analyzes a GitHub profile from a link or username and generates a concise developer evaluation report. It helps recruiters and hiring managers understand a developer’s activity, stack, and project highlights at a glance.

---

## Features

- **Profile analysis** — Paste a GitHub profile URL or username to get an instant report.
- **Developer overview** — Avatar, bio, followers, repos, account age, and last activity.
- **Stack analysis** — Primary and secondary languages with a visual distribution chart.
- **Repository highlights** — Top repositories by stars with descriptions and metadata.
- **Developer score** — Activity, stack diversity, and project quality scores (0–10) plus an overall score.
- **Rule-based insights** — Short, actionable suggestions (e.g. more projects, recent activity, documentation).
- **Dark & light mode** — Theme toggle with preference saved in `localStorage`.
- **Responsive layout** — Optimized for mobile, tablet, laptop, and large screens.

---

## Tech stack

| Layer    | Stack |
| -------- | ----- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend  | Node.js, Express |
| Data     | GitHub REST API (public data, no token required) |

---

## Project structure

```
stacklens/
├── server.js              # Express API: /api/analyze, GitHub fetch, report computation
├── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # Main UI: landing, dashboard, theme, responsive layout
│   │   ├── main.tsx
│   │   └── index.css      # Tailwind + global styles
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
└── README.md
```

---

## Run locally

### 1. Backend

From the project root:

```bash
npm install
npm run dev
```

API runs at **http://localhost:4000**.  
Endpoint: `GET /api/analyze?q=<github-url-or-username>`.

### 2. Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown (e.g. **http://localhost:5173**).

### 3. Use the app

1. Enter a GitHub profile URL (e.g. `https://github.com/octocat`) or username.
2. Click **Analyze Profile**.
3. View the developer report: overview, stats, stack, repo highlights, scores, and insights.

---

## Environment

- **Backend:**
  - `ALLOWED_ORIGINS`: comma-separated origins allowed by CORS (example in `.env.example`)
  - `GITHUB_TOKEN` (optional): increases GitHub API rate limits (keep secret server-side)
  - `PORT` (optional): default `4000` (Render sets `PORT` automatically)
- **Frontend:**
  - The frontend calls **`/api/analyze`** (same-origin).
  - Dev: Vite proxies `/api/*` → `http://localhost:4000` (see `frontend/vite.config.ts`)
  - Prod: Vercel rewrites `/api/*` → your Render backend (see `frontend/vercel.json`)

---

## Deploy

### Deploy backend to Render (Web Service)

- **Root directory**: `stacklens`
- **Build command**: `npm install`
- **Start command**: `node server.js`
- **Environment variables** (Render → Environment):
  - `ALLOWED_ORIGINS`: `https://<your-vercel-domain>` (and optionally `http://localhost:5173` for dev)
  - `GITHUB_TOKEN`: *(optional, recommended)* a GitHub token to avoid rate limits

Your backend will be reachable at something like:
`https://<your-service>.onrender.com`

### Deploy frontend to Vercel

- **Root directory**: `stacklens/frontend`
- Framework: Vite (auto-detected)
- Build command: `npm run build`
- Output directory: `dist`

#### Important: API rewrite (CORS-safe)

The frontend never calls Render deploy hooks or any secret URL from the browser.

Instead it calls **`/api/analyze`**, and Vercel forwards it to Render using `frontend/vercel.json`.
Update this file if your Render domain changes:

- `frontend/vercel.json` rewrites `/api/*` → `https://<your-service>.onrender.com/api/*`

---

## License

ISC.
