# Medico Dental Care

The repository uses npm and Node.js 20.19 or newer. `frontend/` is a Next.js 16 application; `backend/` is a standalone Node.js MongoDB API. MongoDB Atlas and the JWT signing key are backend-only. The backend issues and validates JWT sessions; the frontend holds the token only in an HTTP-only cookie and forwards it from server-side requests.

## Deploy Backend to Render

Create a **Web Service** from this repository:

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
| `MONGODB_URI` | MongoDB Atlas connection string; configure Atlas network access for Render |
| `MONGODB_DB` | `medico_dental_care` or your chosen database name |
| `JWT_SECRET` | Random secret of at least 32 characters; keep it only in Render |
| `FRONTEND_ORIGINS` | Comma-separated exact Vercel origins, without trailing slashes |

Add your Vercel production domain and any preview domains that need access to `FRONTEND_ORIGINS`, for example `https://your-app.vercel.app,https://your-domain.example`. Render supplies `PORT`; the service listens on `0.0.0.0`. CORS allows credentials only from these exact origins. The `/health` endpoint checks MongoDB connectivity.

The backend sets an HTTP-only session cookie and requires a valid, unexpired backend-issued JWT for protected API requests. Logout revokes the token's server-side session. Session records expire automatically. The frontend server action transfers the cookie to the Vercel domain so the browser does not need to access Render's cross-site cookie directly.

## Deploy Frontend to Vercel

Import the same repository into Vercel and set:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `frontend` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Leave the Next.js default |

Set this Vercel environment variable:

| Variable | Value |
| --- | --- |
| `BACKEND_API_URL` | Render service origin, e.g. `https://your-api.onrender.com` (no path suffix) |

Do not add `JWT_SECRET`, MongoDB credentials, or an API key to Vercel. The Vercel session cookie is HTTP-only, secure in production, and SameSite=Lax. The backend JWT secret is never included in the frontend.

## Local Development

Copy `backend/.env.example` to `backend/.env` and set your local MongoDB connection, a local JWT secret, and `FRONTEND_ORIGINS=http://localhost:3000`. Copy `frontend/.env.example` to `frontend/.env.local` and set `BACKEND_API_URL=http://localhost:10000`. Run each process in a separate terminal:

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

Do not reuse a production JWT secret for local development.

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

The frontend also has `npm run lint` and `npm run typecheck`. There is no automated test suite configured yet. Keep `.env`, `.env.local`, and all real credentials out of version control; `.env.example` files contain placeholders only. Rotate any MongoDB credential that was previously committed.
