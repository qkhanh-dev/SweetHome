# SweetHome Frontend (SH-05)

Next.js App Router, TypeScript, Tailwind CSS 3 and shadcn/ui. Use Node 20.20.2 and npm 10.8.2 from the repository `.nvmrc`.

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

Set `NEXT_PUBLIC_USE_MOCK=false` to send requests to the Backend. `NEXT_PUBLIC_API_URL` is the API base URL. The client attaches `Authorization: Bearer <token>` after `login` or `register`; the token remains in memory and `setAccessToken(null)` clears it.

All mock requests wait 200 ms. Mock state is held in memory and resets when the process restarts. Login/register return sample scenarios and do not authenticate passwords. QR links and webhook handling are simulations; the PDF method returns a Backend URL and does not generate a PDF in the frontend.

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
```

The API fetch check uses a fake `fetch`; none of these scripts needs a live Backend.
