# Medico Dental Care

The repository uses npm and Node.js 20.19 or newer. `frontend/` is a Next.js 16 application; `backend/` is a standalone Node.js MongoDB API. MongoDB Atlas hosts the database. The frontend keeps the HTTP-only session cookie and calls the backend from server actions/server components through one server-only API client. The MongoDB URI is only configured on the backend.

## Deploy Backend to Render

Create a **Web Service** from this repository with:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

Set these Render environment variables:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string; allow Render's outbound IPs or use Atlas network access appropriate to your plan |
| `MONGODB_DB` | `medico_dental_care` (or your chosen database name) |
| `BACKEND_API_KEY` | Random secret of at least 32 characters; use the same value in Vercel |
| `FRONTEND_ORIGINS` | Comma-separated exact browser origins, with no trailing slash, e.g. `https://your-app.vercel.app,https://your-domain.example` |

Render supplies `PORT`; the service listens on `0.0.0.0`. `/health` returns success only when MongoDB responds to a ping. Add each Vercel production/preview origin that must call the API to `FRONTEND_ORIGINS`; this allowlist is exact-match. The API key remains required for API requests even when CORS is configured.

## Deploy Frontend to Vercel

Import the same repository into Vercel and set:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `frontend` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Leave the Next.js default |

Set these Vercel environment variables for the required environments:

| Variable | Value |
| --- | --- |
| `BACKEND_API_URL` | Render service origin, e.g. `https://your-api.onrender.com` (no path suffix) |
| `BACKEND_API_KEY` | The same secret configured on Render |
| `SESSION_SECRET` | Independent random secret of at least 32 characters |

Do not prefix these values with `NEXT_PUBLIC_`. Production session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`; the browser never receives the backend API key. Vercel preview domains must also be listed exactly in Render's `FRONTEND_ORIGINS` if browser-origin requests are added in the future.

## Local Development

Copy `backend/.env.example` to `backend/.env` and set real backend-only credentials. Copy `frontend/.env.example` to `frontend/.env.local`, set `BACKEND_API_URL=http://localhost:10000`, and use the same `BACKEND_API_KEY` as the backend. Run each process in a separate terminal:

```powershell
Push-Location backend
npm ci
npm run dev
Pop-Location
```

```powershell
Push-Location frontend
npm ci
npm run dev
Pop-Location
```

For local browser-origin API calls, include the local frontend origin in `backend/.env` as `FRONTEND_ORIGINS=http://localhost:3000`.

## Admin Bootstrap and Checks

On an empty database, run the one-time bootstrap from `backend/` with `MONGODB_URI`, `MONGODB_DB`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and `BOOTSTRAP_ADMIN_PASSWORD` set in the process environment. The password must be at least 12 characters. The script refuses to run if any profile exists. Regular registrations create patient accounts.

```powershell
Push-Location backend
npm run create-admin
Pop-Location
```

Run checks independently from each project directory:

```powershell
npm ci
npm run build
```

The frontend also has `npm run lint` and `npm run typecheck`. There is no automated test suite configured yet. Keep `.env`, `.env.local`, and all real credentials out of version control; `.env.example` files contain placeholders only. A MongoDB credential was present in the previous backend template: rotate that database user's password before deployment, even though the checked-in template has been sanitized.
