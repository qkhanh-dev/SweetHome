# SweetHome SH-07 – Automated API Regression

This helper runs the SH-07 API checks against a **running local SweetHome backend**. It covers:

- Health and PostgreSQL connectivity.
- Auth registration/login, direct `/auth/me` response shape, password change, invalid credentials, bcrypt hashes, locked-account behavior, and revocation of an already-issued JWT.
- RBAC for ADMIN, STAFF, and CUSTOMER, including ADMIN inheritance of STAFF room-status permission.
- Homestay read/update (the update resubmits the exact values already in the database).
- RoomType CRUD and DTO validation.
- Amenity CRUD, detail lookup, and filter.
- Room CRUD, amenity assignment, duplicate/missing amenity validation, duplicate room number, protected RoomType deletion, and manual room-status transitions.
- Swagger route inventory for the SH-07 controller routes.
- Success/error response envelope checks and prevention of `passwordHash` in responses.

## Safety characteristics

- Requires explicit `SH07_ALLOW_MUTATING_TESTS=1` before it runs.
- Does **not** run `seed`, `migrate`, `migrate reset`, or any schema-changing command.
- Does not modify existing Homestay values; its PUT test sends back the same values it first reads.
- Creates only temporary records with a unique `SH07QA_...` prefix.
- In `finally`, uses Prisma to remove only those run-specific temporary Rooms, Amenities, RoomTypes, Customer profiles, and Accounts.
- It does not delete or modify pre-existing seeded/test users or business data.
- Use against a development/test database, not production. A failed cleanup is printed as a failed check; inspect the run-specific prefix before manually cleaning anything.

## Prerequisites

1. Run from `SweetHome/backend`.
2. Dependencies installed and `npx prisma generate` completed.
3. `.env` contains the working `DATABASE_URL` used by the backend.
4. The backend is running at `http://localhost:3001` (or override `SH07_BASE_URL`). The script defaults to `localhost` for Windows compatibility.
5. SH-03 seed fixtures must already exist: at least one Homestay, RoomType, Amenity, and Room.
6. The default seeded admin is `admin` with sample password `123456` as documented in `prisma/seed.ts`. If your local admin credentials differ, set `SH07_ADMIN_USERNAME` and `SH07_ADMIN_PASSWORD` in the environment for this process. Do not commit credentials to the repository.

## Run (Git Bash)

```bash
SH07_ALLOW_MUTATING_TESTS=1 node scripts/sh07-api-smoke.mjs
```

Optional overrides, without editing the script. `SH07_REQUEST_TIMEOUT_MS` defaults to 15000; increase it if your development server is unusually slow:

```bash
SH07_ALLOW_MUTATING_TESTS=1 SH07_BASE_URL=http://localhost:3001/api SH07_REQUEST_TIMEOUT_MS=30000 SH07_ADMIN_USERNAME=admin SH07_ADMIN_PASSWORD='your-local-admin-password' node scripts/sh07-api-smoke.mjs
```

The script prints one PASS/FAIL line per check and exits with code `0` only when all executed checks pass. Exit code `1` indicates a failed test/cleanup; exit code `2` means the explicit mutation safety flag was not enabled.

## Boundaries / known contract limitation

The supplied backend ZIP did not contain the root `docs/API_CONTRACT.md` or `docs/BUSINESS_RULES.md`. Therefore this suite verifies the source/QA-report-supported response envelope and the known `/auth/me` direct-object contract, plus route inventory from generated Swagger; it cannot certify every JSON field against the missing full API Contract document. The business pricing helper is covered by the existing Jest `price.spec.ts`; there is no pricing HTTP route in the supplied controller source.

The supplied `UsersController` exposes `GET /users`, `POST /users`, `PATCH /users/:id/status`, and `PATCH /users/:id/role`; it does not expose `GET /users/:id`, `PUT /users/:id`, or `DELETE /users/:id`. The suite verifies the routes actually implemented and flags no unimplemented route as passing CRUD.
