# SH-23 live integration smoke test

This runner checks the real Next.js authentication proxy against the real NestJS API and PostgreSQL database. It covers JWT/session restoration, 401/403 role behavior, CORS, PH1 room/account APIs, PH3 check-in/service/cleaning flows, PH5 reviews/replies, and PH6 reports.

## Safety boundary — read before running

- The runner **mutates test records** while exercising the live APIs. It also creates one temporary completed booking directly through Prisma so a successful review can be tested.
- Use a new, disposable PostgreSQL database named exactly `sweethome_sh23_e2e_test`.
- Do **not** point it at `sweethome_db`, a shared development database, or production.
- The repository's `backend/prisma/seed.ts` is destructive: it deletes existing rows from the main business tables before recreating sample data. Run it only against the new disposable E2E database.
- The runner requires `SH23_E2E_ALLOW_MUTATIONS=1` and independently checks that the database name in `SH23_E2E_DATABASE_URL` is exactly `sweethome_sh23_e2e_test`.
- The script removes its temporary account, room/type/amenity and review fixture; restores the check-in booking, room status and seeded host reply; and deletes the temporary stay-service usage it created.

## 1. Create a separate database

Create `sweethome_sh23_e2e_test` using pgAdmin or your PostgreSQL CLI. Do not reuse `sweethome_sh15_test`, because the seed script clears its tables.

In Git Bash, set the connection string using your own PostgreSQL credentials (do not paste it into chat):

```bash
export SH23_E2E_DATABASE_URL='postgresql://<db-user>:<db-password>@localhost:5432/sweethome_sh23_e2e_test?schema=public'

node -e 'const u=new URL(process.env.SH23_E2E_DATABASE_URL); const db=decodeURIComponent(u.pathname.slice(1)); console.log({host:u.hostname,port:u.port,database:db,usernameConfigured:!!u.username,passwordConfigured:!!u.password}); if(db!=="sweethome_sh23_e2e_test") process.exit(1)'
```

Replace the placeholders locally. Percent-encode special characters in the username/password when required by URL syntax.

## 2. Apply migrations and load SH-03 fixtures

From the repository root:

```bash
cd backend
DATABASE_URL="$SH23_E2E_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$SH23_E2E_DATABASE_URL" npm run seed
cd ..
```

The sample accounts created by the seed are:

| Role | Username | Seed password |
|---|---|---|
| ADMIN | `admin` | `123456` |
| STAFF | `staff_dalat` | `123456` |
| CUSTOMER | `khanh_customer` | `123456` |
| LOCKED CUSTOMER | `locked_user` | `123456` |

The runner defaults to those usernames/password. Override with `SH23_ADMIN_USERNAME`, `SH23_STAFF_USERNAME`, `SH23_CUSTOMER_USERNAME`, `SH23_LOCKED_USERNAME`, or `SH23_SEED_PASSWORD` if the fixture credentials change.

## 3. Start the real Backend

In Terminal 1 (keep it running):

```bash
export SH23_E2E_DATABASE_URL='postgresql://<db-user>:<db-password>@localhost:5432/sweethome_sh23_e2e_test?schema=public'
export DATABASE_URL="$SH23_E2E_DATABASE_URL"
export CORS_ORIGIN='http://localhost:3000'
npm run start:backend:dev
```

The backend must also have a valid local `JWT_SECRET` of at least 32 characters in its ignored local environment file. Default API URL is `http://localhost:3001/api`.

## 4. Start the real Next.js Frontend

In Terminal 2:

```bash
export NEXT_PUBLIC_API_URL='http://localhost:3001/api'
export NEXT_PUBLIC_USE_MOCK='false'
export NEXT_PUBLIC_ENABLE_PAYMENT_SIMULATOR='false'
npm run dev --workspace=frontend -- --hostname localhost --port 3000
```

Open `http://localhost:3000` and confirm the login page loads. Keep the backend's CORS origin aligned with `http://localhost:3000` (the backend default).

## 5. Run the live integration runner

In Terminal 3, from the repository root:

```bash
export SH23_E2E_DATABASE_URL='postgresql://<db-user>:<db-password>@localhost:5432/sweethome_sh23_e2e_test?schema=public'
export SH23_E2E_ALLOW_MUTATIONS=1
node backend/scripts/sh23-live-integration.mjs
```

Optional base URL overrides:

```bash
export SH23_FRONTEND_URL='http://localhost:3000'
export SH23_BACKEND_URL='http://localhost:3001/api'
```

The runner exits with code `0` only if all checks pass. Any unexpected 5xx, JSON-envelope mismatch, or incorrect expected 401/403/2xx status fails the run. It prints one `PASS` line per test group.

## What this runner does not replace

It is an HTTP integration smoke test through the Next.js auth proxy and NestJS API, not an automated visual browser test. After it passes, manually open the real pages for `/admin`, `/staff/check-in`, `/staff/services`, `/admin/reviews`, `/rooms/<room-id>`, and `/admin/dashboard` using the matching seeded roles to verify rendered UI state and charts.
