# SweetHome Frontend (SH-05)

Next.js App Router, TypeScript, Tailwind CSS 3 and shadcn/ui. The repository requires Node 24 and npm 11 (`.nvmrc`, root `package.json`).

> Techstack v2 records React 18. This frontend currently uses the installed React 19.3.1 with Next.js 15.5.29; the project documentation has not been changed.

## Run locally

From `frontend/`:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The local environment starts in mock mode.

## Switch mock and Backend

Set these values in `.env.local`, then restart the dev server:

```dotenv
NEXT_PUBLIC_USE_MOCK=true
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Set `NEXT_PUBLIC_USE_MOCK=false` to send requests to the Backend. `NEXT_PUBLIC_API_URL` is the API base URL. Auth responses are verified through `GET /api/auth/me`; the server issues a signed, HttpOnly session cookie for middleware and restores the short-lived client token after reload. No password or role is stored in localStorage. Configure `SWEETHOME_SESSION_SECRET` as a private server-only value outside mock development.

Mock auth checks credentials and keeps its account/session registry in the Next.js server process. It resets when that process restarts; the next `getMe` rejects an old cookie and asks the user to sign in again. Mock bookings, customers and payment replay keys are stored in this browser's localStorage so created orders survive a page reload; they are local demo data and are not shared with another browser or Backend. Do not enter real customer or payment information in mock mode.

Mock sign-in accounts:

| Role | Username | Password |
| --- | --- | --- |
| Customer | `customer_demo` | `Customer@123` |
| Staff | `staff_demo` | `Staff@123` |
| Admin | `admin_sweethome` | `Admin@123` |
| Locked account | `locked_demo` | `Locked@123` |

Credentials are verified by the mock adapter; the role is never selected in registration. QR/webhook handling is clearly marked as a simulation and does not request real transfers. The PDF method returns a Backend URL and does not generate a PDF in the frontend.

## Contract and checks

See [API traceability](./API_TRACEABILITY.md) for the method/path/query/body/return/mock mapping.

```powershell
npm run typecheck
npm run lint
npm run build
npm run check:mock
npm run check:auth-users
npm run check:catalog
npm run check:api-mock
npm run check:api-fetch
npm run check:fixtures
npm run check:sh09
npm run check:sh10
```

The API fetch check uses a fake `fetch`; none of these scripts needs a live Backend.
