import { randomUUID } from 'node:crypto';

export const SH22_E2E_TARGET = {
  hostname: '127.0.0.1',
  port: '5543',
  database: 'sweethome_sh22_e2e',
  schema: 'public',
  username: 'sh22_e2e',
} as const;

export type Sh22FixtureIds = {
  homestayId: string;
  roomTypeId: string;
  roomIds: { sd01: string; sd02: string; sd05: string };
  serviceId: string;
  accountIds: { staff: string; admin: string; customer: string };
  customerId: string;
  bookingIds: { sd02: string; sd05: string };
  paymentIds: { sd02: string; sd05: string };
};

export type Sh22FixtureManifest = {
  version: 2;
  runId: string;
  createdAt: string;
  updatedAt: string;
  state: FixtureManifestState;
  guestBookingMarker: string;
  ids: Sh22FixtureIds;
};

export type FixtureManifestState = 'PREPARED' | 'READY' | 'CLEANED';

export type CleanupBooking = {
  maDatPhong: string;
  maKH: string;
  maPhong: string;
  ghiChu: string | null;
};

export type CleanupCustomer = { maKH: string; maTaiKhoan: string | null };

export type Sh22DatabaseIdentity = {
  database: string;
  schema: string;
  user: string;
  readOnly: string;
};

function decoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error('DATABASE_URL contains an invalid encoded component');
  }
}

/** Parse and allow-list the only database that this harness may mutate. */
export function parseApprovedDatabaseUrl(raw: string | undefined): URL {
  if (!raw) throw new Error('DATABASE_URL is required for the SH-22 E2E fixture harness');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL URL');
  }

  const database = decoded(url.pathname).replace(/^\//u, '');
  const schema = url.searchParams.get('schema') ?? 'public';
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== SH22_E2E_TARGET.hostname ||
    url.port !== SH22_E2E_TARGET.port ||
    database !== SH22_E2E_TARGET.database ||
    schema !== SH22_E2E_TARGET.schema ||
    decoded(url.username) !== SH22_E2E_TARGET.username
  ) {
    throw new Error('DATABASE_URL does not target the approved SH-22 E2E PostgreSQL database');
  }
  return url;
}

export function createRunId(): string {
  return `sh22-e2e-${randomUUID()}`;
}

export function assertRunId(runId: string): void {
  if (!/^sh22-e2e-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(runId)) {
    throw new Error('runId must be a sh22-e2e UUID namespace');
  }
}

export function createManifest(runId: string): Sh22FixtureManifest {
  assertRunId(runId);
  const timestamp = new Date().toISOString();
  return {
    version: 2,
    runId,
    createdAt: timestamp,
    updatedAt: timestamp,
    state: 'PREPARED',
    guestBookingMarker: `${runId}-sd01-guest`,
    ids: {
      homestayId: `${runId}-homestay`,
      roomTypeId: `${runId}-room-type`,
      roomIds: {
        sd01: `${runId}-room-sd01`,
        sd02: `${runId}-room-sd02`,
        sd05: `${runId}-room-sd05`,
      },
      serviceId: `${runId}-service`,
      accountIds: {
        staff: `${runId}-staff`,
        admin: `${runId}-admin`,
        customer: `${runId}-customer-account`,
      },
      customerId: `${runId}-customer`,
      bookingIds: { sd02: `${runId}-booking-sd02`, sd05: `${runId}-booking-sd05` },
      paymentIds: { sd02: `${runId}-payment-sd02`, sd05: `${runId}-payment-sd05` },
    },
  };
}

export function withManifestState(
  manifest: Sh22FixtureManifest,
  state: FixtureManifestState,
): Sh22FixtureManifest {
  return { ...manifest, state, updatedAt: new Date().toISOString() };
}

export async function executeSetupLifecycle(
  manifest: Sh22FixtureManifest,
  actions: {
    writePrepared: (value: Sh22FixtureManifest) => Promise<void>;
    onPrepared?: (value: Sh22FixtureManifest) => void;
    setup: () => Promise<void>;
    writeReady: (value: Sh22FixtureManifest) => Promise<void>;
  },
): Promise<Sh22FixtureManifest> {
  await actions.writePrepared(manifest);
  actions.onPrepared?.(manifest);
  await actions.setup();
  const ready = withManifestState(manifest, 'READY');
  await actions.writeReady(ready);
  return ready;
}

export async function executeCleanupLifecycle(
  manifest: Sh22FixtureManifest,
  actions: {
    cleanup: () => Promise<void>;
    writeCleaned: (value: Sh22FixtureManifest) => Promise<void>;
  },
): Promise<Sh22FixtureManifest> {
  await actions.cleanup();
  const cleaned = withManifestState(manifest, 'CLEANED');
  await actions.writeCleaned(cleaned);
  return cleaned;
}

/** The optional mutation hook exists solely to make the no-mutation contract testable. */
export async function executeDryRun(actions: {
  assertIdentity: () => Promise<void>;
  readOnlyPreflight: () => Promise<void>;
  mutation?: () => Promise<void>;
}): Promise<void> {
  await actions.assertIdentity();
  await actions.readOnlyPreflight();
}

export function assertApprovedDatabaseIdentity(identity: Sh22DatabaseIdentity | undefined): void {
  if (
    !identity ||
    identity.database !== SH22_E2E_TARGET.database ||
    identity.schema !== SH22_E2E_TARGET.schema ||
    identity.user !== SH22_E2E_TARGET.username ||
    identity.readOnly !== 'off'
  ) {
    throw new Error('Actual PostgreSQL identity does not match the approved SH-22 E2E target');
  }
}

export function assertEmptyCounts(counts: readonly number[]): void {
  if (counts.some((count) => count !== 0)) {
    throw new Error(
      'SH-22 E2E database contains application data of unclear ownership; refusing fixture setup',
    );
  }
}

export function assertNoExistingFixtureItems(counts: readonly number[]): void {
  if (counts.some((count) => count > 0)) {
    throw new Error('Fixture IDs already exist; refusing to overwrite');
  }
}

/** Empty scoped data is a valid second cleanup, making cleanup naturally idempotent. */
export function assertCleanupCounts(total: readonly number[], owned: readonly number[]): void {
  if (total.every((count) => count === 0)) return;
  if (total.length !== owned.length || total.some((count, index) => count !== owned[index])) {
    throw new Error('Found data outside the fixture ownership graph; cleanup refused');
  }
}

/**
 * Derives only the graph that can be proven to belong to this run. A public
 * SD01 guest must use the manifest marker in ghiChu and must not own any
 * booking outside fixture rooms; otherwise cleanup fails closed.
 */
export function deriveOwnedCleanupGraph(
  manifest: Sh22FixtureManifest,
  candidateBookings: readonly CleanupBooking[],
  customerBookings: readonly CleanupBooking[],
  customers: readonly CleanupCustomer[],
): { bookingIds: string[]; customerIds: string[]; guestCustomerIds: string[] } {
  const roomIds = new Set(Object.values(manifest.ids.roomIds));
  const candidateById = new Map(candidateBookings.map((booking) => [booking.maDatPhong, booking]));
  const customerIds = [...new Set(candidateBookings.map((booking) => booking.maKH))];
  if (candidateBookings.length === 0 && customerBookings.length === 0 && customers.length === 0) {
    return { bookingIds: [], customerIds: [], guestCustomerIds: [] };
  }
  if (candidateBookings.some((booking) => !roomIds.has(booking.maPhong))) {
    throw new Error('Found booking outside fixture rooms; cleanup refused');
  }
  if (
    customers.length !== customerIds.length ||
    customers.some((customer) => !customerIds.includes(customer.maKH))
  ) {
    throw new Error('Could not prove ownership of every booking customer; cleanup refused');
  }
  if (
    customerBookings.some(
      (booking) => !roomIds.has(booking.maPhong) || !candidateById.has(booking.maDatPhong),
    )
  ) {
    throw new Error('Found customer booking outside the fixture graph; cleanup refused');
  }

  const guestCustomerIds = customerIds.filter((id) => id !== manifest.ids.customerId);
  for (const guestCustomerId of guestCustomerIds) {
    const customer = customers.find((item) => item.maKH === guestCustomerId);
    const bookings = candidateBookings.filter((booking) => booking.maKH === guestCustomerId);
    if (
      customer?.maTaiKhoan !== null ||
      !bookings.some((booking) => booking.ghiChu === manifest.guestBookingMarker)
    ) {
      throw new Error('Guest customer is not proven to belong to this E2E run; cleanup refused');
    }
  }
  if (!customerIds.includes(manifest.ids.customerId)) {
    throw new Error('Fixture customer is missing from the cleanup graph; cleanup refused');
  }
  return { bookingIds: [...candidateById.keys()], customerIds, guestCustomerIds };
}

function allManifestStrings(manifest: Sh22FixtureManifest): string[] {
  const { ids } = manifest;
  return [
    ids.homestayId,
    ids.roomTypeId,
    ids.roomIds.sd01,
    ids.roomIds.sd02,
    ids.roomIds.sd05,
    ids.serviceId,
    ids.accountIds.staff,
    ids.accountIds.admin,
    ids.accountIds.customer,
    ids.customerId,
    ids.bookingIds.sd02,
    ids.bookingIds.sd05,
    ids.paymentIds.sd02,
    ids.paymentIds.sd05,
  ];
}

/** Reject malformed or cross-run manifests before any cleanup query is allowed. */
export function assertOwnedManifest(value: unknown): asserts value is Sh22FixtureManifest {
  if (!value || typeof value !== 'object') throw new Error('Fixture manifest is not an object');
  const manifest = value as Partial<Sh22FixtureManifest>;
  if (
    manifest.version !== 2 ||
    typeof manifest.runId !== 'string' ||
    !manifest.ids ||
    !['PREPARED', 'READY', 'CLEANED'].includes(manifest.state as string) ||
    manifest.guestBookingMarker !== `${manifest.runId}-sd01-guest`
  ) {
    throw new Error('Fixture manifest has an unsupported shape');
  }
  assertRunId(manifest.runId);
  try {
    const entries = allManifestStrings(manifest as Sh22FixtureManifest);
    if (
      entries.some((entry) => typeof entry !== 'string' || !entry.startsWith(`${manifest.runId}-`))
    ) {
      throw new Error('Fixture manifest contains IDs outside its run namespace');
    }
    if (new Set(entries).size !== entries.length)
      throw new Error('Fixture manifest has duplicate IDs');
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Fixture manifest contains invalid IDs');
  }
}

/** Deliberately excludes DATABASE_URL, passwords, JWTs, and payment secrets. */
export function publicFixtureSummary(manifest: Sh22FixtureManifest, manifestPath: string) {
  return {
    runId: manifest.runId,
    manifestPath,
    ids: manifest.ids,
  };
}
