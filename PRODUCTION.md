# 🚀 Production Deployment Run‑book – Edee Apply
**Stack** – Backend (FastAPI) → Render (Docker) • Frontend (Next.js 15) → Vercel • Database → Neon (PostgreSQL)

---

## 1️⃣  One‑click Deploy (what happens on `git push origin main`)

| Step | What runs | Where |
|------|-----------|-------|
| **CI** | `npm run lint && npm run typecheck && npm test` (frontend) <br> `pytest -q` (backend) <br> `alembic upgrade head --sql` (dry‑run) | GitHub Actions (`.github/workflows/ci.yml`) |
| **Docker build** | `backend/Dockerfile.prod` → image `ghcr.io/<org>/edee-backend:<sha>` <br> `frontend/Dockerfile.prod` (optional) | GitHub Actions (docker‑build job) |
| **Render** | Pulls the new backend image, runs `preDeployCommand: alembic upgrade head`, starts **gunicorn + uvicorn** (4 workers) on `:8000` | Render (auto‑deploy from `main`) |
| **Vercel** | Detects `frontend/`, runs `npm run build` (Next.js `output: standalone`), rewrites `/api/*` → Render URL, serves on edge | Vercel (project linked to `frontend/`) |
| **Neon** | No code change – just serves the PostgreSQL cluster (SSL, autoscaling, PITR) | Managed service |

> **Result** – After the first successful push the production URLs are live:
> * Frontend: `https://<your‑app>.vercel.app`
> * Backend health: `https://<render‑service>.onrender.com/health`
> * API (proxied): `https://<your‑app>.vercel.app/api/...`

---

## 2️⃣  Required Secrets / Environment Variables

| Platform | Variable | Where to set (UI) |
|----------|----------|-------------------|
| **Render** (Backend) | `DATABASE_URL` (Neon connection string) | Settings → Environment |
| | `FIREBASE_SERVICE_ACCOUNT_PATH` | Settings → Secret Files (upload `firebase-service-account.json`) |
| | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Environment |
| | `ENVIRONMENT=production` | Environment |
| | `LOG_LEVEL=INFO` | Environment |
| | `AUTH_SECRET` (32‑byte base64) | Environment |
| | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Environment |
| | `CORS_ORIGINS=https://<your‑app>.vercel.app` | Environment |
| | `PUBLIC_URL=https://<your‑app>.vercel.app` | Environment |
| | `DEV_MODE=0` | Environment |
| **Vercel** (Frontend) | `NEXT_PUBLIC_API_URL=https://<render‑service>.onrender.com` | Project → Settings → Env Vars (all scopes) |
| | `NEXT_PUBLIC_FIREBASE_API_KEY` … (7 keys) | Same |
| **Neon** | Connection string (used only for `DATABASE_URL` above) | — |

> **Never** commit any of the above to git. Keep them only in the platform secret stores.

---

## 3️⃣  Database – Neon (PostgreSQL)

1. Create a Neon project → create a **`production`** branch (or use `main`).
2. Copy the **connection string** (`postgresql+asyncpg://user:pwd@host/db?sslmode=require`).
3. Put it into Render as `DATABASE_URL`.
4. Run migrations **once** (or let Render’s `preDeployCommand` do it):

```bash
DATABASE_URL="<neon‑url>" alembic upgrade head
```

5. Enable **Autoscaling** & **Point‑in‑time‑recovery (PITR)** in the Neon dashboard.

---

## 4️⃣  CI/CD – GitHub Actions (`.github/workflows/ci.yml`)

The workflow already does:

* **Frontend** – `npm ci → lint → typecheck → test`
* **Backend** – `pip install → pytest → alembic dry‑run`
* **Docker build** – builds both images, tags with git SHA, pushes to GHCR (optional)

**What to watch:**
* ✅ All jobs green → Render & Vercel auto‑deploy.
* ❌ Any red job blocks deploy – fix before merging.

---

## 5️⃣  Security & Performance Hardening (already baked in)

| Area | Implementation |
|------|----------------|
| **CORS** | `CORS_ORIGINS` limited to Vercel domain (FastAPI `CORSMiddleware`). |
| **CSP / Security headers** | `vercel.json` + FastAPI middleware (`Content‑Security‑Policy`, `X‑Frame‑Options: DENY`, `Strict‑Transport‑Security`). |
| **Rate limiting** | `slowapi` on all public endpoints. |
| **Static uploads** | Store logos/gallery on Render volume **or** move to S3/R2 + CDN (add `remotePatterns` in `next.config`). |
| **DB pooling** | `create_async_engine(..., pool_size=10, max_overflow=20)`. |
| **Logging** | `python-json-logger` → JSON stdout → Render Log Explorer / Datadog. |
| **Dependency scanning** | `codeql-action` + `snyk` in CI; `dependabot.yml` for npm & pip. |
| **Vulnerability baseline** | `npm audit fix --force` → 0 vulns; `pip-audit -r backend/requirements.txt` → 0 vulns. |
| **Performance** | `next build && next start && lighthouse http://localhost:3000` → ≥ 90 score. |
| **Observability** | Render metrics + Vercel Analytics + optional OpenTelemetry exporter. |

---

## 6️⃣  Pre‑Launch Checklist (run once before first production push)

```bash
# 1️⃣ Frontend sanity
cd frontend && npm run lint && npm run typecheck && npm run test

# 2️⃣ Backend security
cd backend && pip-audit -r requirements.txt   # must show 0 findings

# 3️⃣ Migrations on Neon
cd backend && DATABASE_URL="<neon‑url>" alembic upgrade head

# 4️⃣ Docker smoke test (backend)
docker build -f Dockerfile.prod -t edee-backend .
docker run --rm -p 8000:8000 edee-backend
curl http://localhost:8000/health   # → {"status":"ok"}

# 5️⃣ Frontend production build + Lighthouse
cd frontend && npm run build && npm run start
# in another shell:
lighthouse http://localhost:3000 --view   # aim for ≥ 90

# 6️⃣ CORS test from Vercel preview
# (open preview URL, open devtools network → call /api/colleges – must succeed)

# 7️⃣ Push to main → watch CI → Render → Vercel
git push origin main
```

---

## 7️⃣  Ongoing Operations (what to **regularly check**)

| Frequency | Action |
|-----------|--------|
| **Daily** | Render / Vercel health‑check dashboards (green = OK). |
| **Weekly** | Render logs & Vercel Functions logs for errors / latency spikes. |
| **Bi‑weekly** | `npm audit` & `pip-audit` (CI already runs, but glance at reports). |
| **Monthly** | Rotate `AUTH_SECRET`, Razorpay keys, Firebase service‑account (store new values in Render/Vercel secret UI). |
| **Quarterly** | Upgrade base images (`python:3.12-slim`, `node:20-alpine`) in both `Dockerfile.prod` files; run full test suite. |
| **On schema change** | Add a new Alembic revision → push → Render runs `preDeployCommand` automatically. |
| **Incident** | Use Render “Logs” + Vercel “Function Logs” → correlate timestamps → fix → redeploy. |

---

## 8️⃣  Quick Reference – Important Files

| File | Purpose |
|------|---------|
| `backend/Dockerfile.prod` | Production container (multi‑stage, non‑root, gunicorn + uvicorn). |
| `backend/alembic/` | Migration scripts (run on every deploy). |
| `backend/requirements.txt` | Pinned Python deps (run `pip-audit`). |
| `frontend/next.config.prod.js` | Next.js production config (`output: standalone`). |
| `frontend/vercel.json` | Rewrites `/api/*` → Render, CSP / security headers. |
| `.github/workflows/ci.yml` | Full CI pipeline (lint, test, docker build). |
| `render.yaml` (optional) | Infrastructure‑as‑code for Render service. |
| `start.bat` | Local one‑click dev launcher (unchanged). |

---

## 9️⃣  TL;DR – What a New Developer Must Do

1. **Clone** the repo.  
2. **Read this file** (`PRODUCTION.md`).  
3. **Add the secrets** listed in section 2 to Render, Vercel, Neon (via their dashboards).  
4. **Push to `main`** → CI runs → Render + Vercel deploy automatically.  
5. **Verify** the two health URLs (`/health` and the Vercel homepage).  
6. **Enjoy** – from now on every merge to `main` is a zero‑touch production deploy.

---

*Keep this file up‑to‑date whenever you add a new service, change a secret name, or modify the CI pipeline.  It is the single source of truth for “how we ship to production”.*