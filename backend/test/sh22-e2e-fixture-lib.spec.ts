import { describe, expect, it } from '@jest/globals';
import {
  assertOwnedManifest,
  assertApprovedDatabaseIdentity,
  assertCleanupCounts,
  assertEmptyCounts,
  assertNoExistingFixtureItems,
  createManifest,
  deriveOwnedCleanupGraph,
  executeCleanupLifecycle,
  executeDryRun,
  executeSetupLifecycle,
  parseApprovedDatabaseUrl,
  publicFixtureSummary,
} from '../scripts/sh22-e2e-fixture-lib';

const APPROVED_URL = 'postgresql://sh22_e2e:secret@127.0.0.1:5543/sweethome_sh22_e2e?schema=public';
const RUN_ID = 'sh22-e2e-123e4567-e89b-12d3-a456-426614174000';

describe('SH-22 E2E fixture harness guards', () => {
  it('accepts only the approved dedicated PostgreSQL target', () => {
    expect(parseApprovedDatabaseUrl(APPROVED_URL).hostname).toBe('127.0.0.1');
    expect(() =>
      parseApprovedDatabaseUrl(
        'postgresql://sh22_e2e:secret@127.0.0.1:5543/sweethome_sh16_test?schema=public',
      ),
    ).toThrow(/approved SH-22/u);
    expect(() =>
      parseApprovedDatabaseUrl(
        'postgresql://sh22_e2e:secret@localhost:5543/sweethome_sh22_e2e?schema=public',
      ),
    ).toThrow(/approved SH-22/u);
    expect(() =>
      parseApprovedDatabaseUrl(
        'postgresql://sh16_test:secret@127.0.0.1:5543/sweethome_sh22_e2e?schema=public',
      ),
    ).toThrow(/approved SH-22/u);
  });

  it('rejects a manifest whose IDs cross a run namespace', () => {
    const manifest = createManifest(RUN_ID);
    manifest.ids.roomIds.sd05 = 'sh22-e2e-another-run-room-sd05';
    expect(() => assertOwnedManifest(manifest)).toThrow(/outside its run namespace/u);
  });

  it('rejects an actual database identity that differs from the allow-list', () => {
    expect(() =>
      assertApprovedDatabaseIdentity({
        database: 'sweethome_sh16_test',
        schema: 'public',
        user: 'sh22_e2e',
        readOnly: 'off',
      }),
    ).toThrow(/approved SH-22 E2E target/u);
  });

  it('rejects both application data outside setup ownership and fixture ID overwrite', () => {
    expect(() => assertEmptyCounts([0, 0, 1])).toThrow(/unclear ownership/u);
    expect(() => assertNoExistingFixtureItems([0, 1, 0])).toThrow(/refusing to overwrite/u);
  });

  it('accepts an empty second cleanup but rejects cross-run data', () => {
    expect(() => assertCleanupCounts([0, 0, 0], [1, 3, 2])).not.toThrow();
    expect(() => assertCleanupCounts([1, 0], [0, 0])).toThrow(
      /outside the fixture ownership graph/u,
    );
  });

  it('rejects duplicate fixture IDs instead of allowing cleanup ambiguity', () => {
    const manifest = createManifest(RUN_ID);
    manifest.ids.customerId = manifest.ids.accountIds.customer;
    expect(() => assertOwnedManifest(manifest)).toThrow(/duplicate IDs/u);
  });

  it('emits only non-sensitive fixture routing data', () => {
    const summary = JSON.stringify(
      publicFixtureSummary(createManifest(RUN_ID), 'C:\\temp\\fixture.json'),
    );
    expect(summary).toContain(RUN_ID);
    expect(summary).not.toContain('secret');
    expect(summary).not.toContain('DATABASE_URL');
    expect(summary).not.toContain('accessToken');
  });

  it('discovers a marked public SD01 guest and its generated customer safely', () => {
    const manifest = createManifest(RUN_ID);
    const booking = (maDatPhong: string, maKH: string, maPhong: string, ghiChu: string | null) => ({
      maDatPhong,
      maKH,
      maPhong,
      ghiChu,
    });
    const guestBooking = booking(
      'cuid-guest-booking',
      'cuid-guest-customer',
      manifest.ids.roomIds.sd01,
      manifest.guestBookingMarker,
    );
    const candidates = [
      booking(
        manifest.ids.bookingIds.sd02,
        manifest.ids.customerId,
        manifest.ids.roomIds.sd02,
        null,
      ),
      booking(
        manifest.ids.bookingIds.sd05,
        manifest.ids.customerId,
        manifest.ids.roomIds.sd05,
        null,
      ),
      guestBooking,
    ];
    expect(
      deriveOwnedCleanupGraph(manifest, candidates, candidates, [
        { maKH: manifest.ids.customerId, maTaiKhoan: manifest.ids.accountIds.customer },
        { maKH: 'cuid-guest-customer', maTaiKhoan: null },
      ]),
    ).toEqual({
      bookingIds: [
        manifest.ids.bookingIds.sd02,
        manifest.ids.bookingIds.sd05,
        'cuid-guest-booking',
      ],
      customerIds: [manifest.ids.customerId, 'cuid-guest-customer'],
      guestCustomerIds: ['cuid-guest-customer'],
    });
  });

  it('fails closed for a guest customer with any booking outside fixture rooms', () => {
    const manifest = createManifest(RUN_ID);
    const owned = {
      maDatPhong: 'cuid-guest-booking',
      maKH: 'cuid-guest-customer',
      maPhong: manifest.ids.roomIds.sd01,
      ghiChu: manifest.guestBookingMarker,
    };
    const outside = { ...owned, maDatPhong: 'cuid-outside', maPhong: 'other-run-room' };
    expect(() =>
      deriveOwnedCleanupGraph(
        manifest,
        [
          {
            maDatPhong: manifest.ids.bookingIds.sd02,
            maKH: manifest.ids.customerId,
            maPhong: manifest.ids.roomIds.sd02,
            ghiChu: null,
          },
          {
            maDatPhong: manifest.ids.bookingIds.sd05,
            maKH: manifest.ids.customerId,
            maPhong: manifest.ids.roomIds.sd05,
            ghiChu: null,
          },
          owned,
        ],
        [owned, outside],
        [
          { maKH: manifest.ids.customerId, maTaiKhoan: manifest.ids.accountIds.customer },
          { maKH: 'cuid-guest-customer', maTaiKhoan: null },
        ],
      ),
    ).toThrow(/outside the fixture graph/u);
  });

  it('fails closed for a cross-run booking/customer on a fixture room without this run marker', () => {
    const manifest = createManifest(RUN_ID);
    expect(() =>
      deriveOwnedCleanupGraph(
        manifest,
        [
          {
            maDatPhong: manifest.ids.bookingIds.sd02,
            maKH: manifest.ids.customerId,
            maPhong: manifest.ids.roomIds.sd02,
            ghiChu: null,
          },
          {
            maDatPhong: manifest.ids.bookingIds.sd05,
            maKH: manifest.ids.customerId,
            maPhong: manifest.ids.roomIds.sd05,
            ghiChu: null,
          },
          {
            maDatPhong: 'other-run-booking',
            maKH: 'other-run-customer',
            maPhong: manifest.ids.roomIds.sd01,
            ghiChu: 'other-run-marker',
          },
        ],
        [
          {
            maDatPhong: manifest.ids.bookingIds.sd02,
            maKH: manifest.ids.customerId,
            maPhong: manifest.ids.roomIds.sd02,
            ghiChu: null,
          },
          {
            maDatPhong: manifest.ids.bookingIds.sd05,
            maKH: manifest.ids.customerId,
            maPhong: manifest.ids.roomIds.sd05,
            ghiChu: null,
          },
          {
            maDatPhong: 'other-run-booking',
            maKH: 'other-run-customer',
            maPhong: manifest.ids.roomIds.sd01,
            ghiChu: 'other-run-marker',
          },
        ],
        [
          { maKH: manifest.ids.customerId, maTaiKhoan: manifest.ids.accountIds.customer },
          { maKH: 'other-run-customer', maTaiKhoan: null },
        ],
      ),
    ).toThrow(/not proven/u);
  });

  it('writes PREPARED before setup, and a READY write failure keeps recovery metadata', async () => {
    const manifest = createManifest(RUN_ID);
    let persisted = manifest;
    let setupCalled = false;
    let announced: string | undefined;
    await expect(
      executeSetupLifecycle(manifest, {
        writePrepared: async (value) => {
          persisted = value;
        },
        onPrepared: (value) => {
          announced = value.runId;
        },
        setup: async () => {
          setupCalled = true;
        },
        writeReady: async () => {
          throw new Error('disk full');
        },
      }),
    ).rejects.toThrow('disk full');
    expect(setupCalled).toBe(true);
    expect(persisted.state).toBe('PREPARED');
    expect(announced).toBe(RUN_ID);
  });

  it('does not invoke database setup if PREPARED cannot be written', async () => {
    const manifest = createManifest(RUN_ID);
    let setupCalled = false;
    await expect(
      executeSetupLifecycle(manifest, {
        writePrepared: async () => {
          throw new Error('manifest volume unavailable');
        },
        setup: async () => {
          setupCalled = true;
        },
        writeReady: async () => undefined,
      }),
    ).rejects.toThrow('manifest volume unavailable');
    expect(setupCalled).toBe(false);
  });

  it('does not invoke a supplied mutation hook in dry-run', async () => {
    let mutations = 0;
    await executeDryRun({
      assertIdentity: async () => undefined,
      readOnlyPreflight: async () => undefined,
      mutation: async () => {
        mutations++;
      },
    });
    expect(mutations).toBe(0);
  });

  it('accepts a partial browser-flow graph containing receipt, refund, service usage, and invoice', () => {
    // Totals mirror a run with SD01 webhook receipt, SD02 DANG_XU_LY refund,
    // and an SD05 draft invoice; all related rows belong to the three bookings.
    expect(() =>
      assertCleanupCounts(
        [1, 1, 3, 3, 2, 1, 3, 3, 1, 1, 1, 0],
        [1, 1, 3, 3, 2, 1, 3, 3, 1, 1, 1, 0],
      ),
    ).not.toThrow();
  });

  it('marks a successfully cleaned manifest CLEANED without changing cleanup ordering', async () => {
    const manifest = createManifest(RUN_ID);
    const calls: string[] = [];
    const cleaned = await executeCleanupLifecycle(manifest, {
      cleanup: async () => {
        calls.push('cleanup');
      },
      writeCleaned: async (value) => {
        calls.push(value.state);
      },
    });
    expect(calls).toEqual(['cleanup', 'CLEANED']);
    expect(cleaned.state).toBe('CLEANED');
  });
});
