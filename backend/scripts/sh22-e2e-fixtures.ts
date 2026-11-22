/*
 * Explicit, isolated fixtures for SH-22 browser E2E. This is not a Prisma seed:
 * it refuses every target except the dedicated SH-22 database and never truncates.
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  assertOwnedManifest,
  assertApprovedDatabaseIdentity,
  assertCleanupCounts,
  assertEmptyCounts,
  assertNoExistingFixtureItems,
  assertRunId,
  createManifest,
  createRunId,
  deriveOwnedCleanupGraph,
  executeCleanupLifecycle,
  executeDryRun,
  executeSetupLifecycle,
  parseApprovedDatabaseUrl,
  publicFixtureSummary,
  type Sh22FixtureManifest,
} from './sh22-e2e-fixture-lib';

type Command = 'setup' | 'cleanup';
type Arguments = { command: Command; dryRun: boolean; runId?: string; manifestPath?: string };
type DbIdentity = { database: string; schema: string; user: string; readOnly: string };

const MANIFEST_DIRECTORY = resolve(
  process.env.SH22_E2E_FIXTURE_MANIFEST_DIR ?? join(tmpdir(), 'sweethome-sh22-e2e'),
);

function parseArgs(argv: string[]): Arguments {
  const [command, ...options] = argv;
  if (command !== 'setup' && command !== 'cleanup') {
    throw new Error(
      'Usage: tsx scripts/sh22-e2e-fixtures.ts <setup|cleanup> [--dry-run] [--run-id <id>] [--manifest <path>]',
    );
  }
  const args: Arguments = { command, dryRun: false };
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (option === '--dry-run') args.dryRun = true;
    else if (option === '--run-id') args.runId = options[++index];
    else if (option === '--manifest') args.manifestPath = options[++index];
    else throw new Error(`Unknown or incomplete option: ${option}`);
  }
  if (args.runId) assertRunId(args.runId);
  if (command === 'cleanup' && !args.manifestPath)
    throw new Error('cleanup requires --manifest <path>');
  if (command === 'setup' && args.manifestPath) throw new Error('setup does not accept --manifest');
  return args;
}

function fixturePassword(): string {
  const password = process.env.SH22_E2E_FIXTURE_PASSWORD;
  if (!password || password.length < 16) {
    throw new Error('SH22_E2E_FIXTURE_PASSWORD is required and must be at least 16 characters');
  }
  return password;
}

function manifestPathFor(runId: string): string {
  return join(MANIFEST_DIRECTORY, `${runId}.json`);
}

function assertManifestPath(path: string, runId: string): string {
  const absolute = resolve(path);
  const directoryWithSeparator = `${MANIFEST_DIRECTORY}\\`;
  if (!absolute.startsWith(directoryWithSeparator) || basename(absolute) !== `${runId}.json`) {
    throw new Error('Manifest path must be inside the configured SH-22 E2E manifest directory');
  }
  return absolute;
}

function assertManifestDirectory(path: string): string {
  const absolute = resolve(path);
  if (!absolute.startsWith(`${MANIFEST_DIRECTORY}\\`)) {
    throw new Error('Manifest path must be inside the configured SH-22 E2E manifest directory');
  }
  return absolute;
}

async function readManifest(path: string): Promise<Sh22FixtureManifest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    throw new Error('Fixture manifest could not be read');
  }
  assertOwnedManifest(parsed);
  return parsed;
}

async function writeManifestTemporary(
  path: string,
  manifest: Sh22FixtureManifest,
): Promise<string> {
  await mkdir(MANIFEST_DIRECTORY, { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return temporary;
}

async function createManifestFile(path: string, manifest: Sh22FixtureManifest): Promise<void> {
  const temporary = await writeManifestTemporary(path, manifest);
  try {
    await link(temporary, path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      throw new Error('Fixture manifest already exists; refusing to overwrite');
    }
    throw error;
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

async function replaceManifestFile(path: string, manifest: Sh22FixtureManifest): Promise<void> {
  const temporary = await writeManifestTemporary(path, manifest);
  try {
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

function createDatabaseClient(databaseUrl: string): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString: databaseUrl });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

async function assertDatabaseIdentity(prisma: PrismaClient): Promise<void> {
  const [identity] = await prisma.$queryRaw<DbIdentity[]>`
    SELECT current_database() AS database,
           current_schema() AS schema,
           current_user AS user,
           current_setting('transaction_read_only') AS "readOnly"
  `;
  assertApprovedDatabaseIdentity(identity);
}

async function assertEmptyApplicationDatabase(prisma: PrismaClient): Promise<void> {
  const counts = await Promise.all([
    prisma.homestay.count(),
    prisma.loaiPhong.count(),
    prisma.phong.count(),
    prisma.taiKhoan.count(),
    prisma.khachHang.count(),
    prisma.datPhong.count(),
    prisma.thanhToanCoc.count(),
    prisma.hoanCoc.count(),
    prisma.dichVu.count(),
    prisma.suDungDichVu.count(),
    prisma.hoaDon.count(),
    prisma.danhGia.count(),
  ]);
  assertEmptyCounts(counts);
}

async function assertOnlyFixtureData(
  prisma: PrismaClient,
  manifest: Sh22FixtureManifest,
): Promise<{ bookingIds: string[]; customerIds: string[] }> {
  const { ids } = manifest;
  const roomIds = Object.values(ids.roomIds);
  const candidateBookings = await prisma.datPhong.findMany({
    where: { OR: [{ maKH: ids.customerId }, { maPhong: { in: roomIds } }] },
    select: { maDatPhong: true, maKH: true, maPhong: true, ghiChu: true },
  });
  const customerIds = [...new Set(candidateBookings.map((booking) => booking.maKH))];
  const [fixtureCustomers, allBookingsForCustomers] = await Promise.all([
    prisma.khachHang.findMany({
      where: { maKH: { in: customerIds } },
      select: { maKH: true, maTaiKhoan: true },
    }),
    prisma.datPhong.findMany({
      where: { maKH: { in: customerIds } },
      select: { maDatPhong: true, maKH: true, maPhong: true, ghiChu: true },
    }),
  ]);
  const ownership = deriveOwnedCleanupGraph(
    manifest,
    candidateBookings,
    allBookingsForCustomers,
    fixtureCustomers,
  );
  const { bookingIds } = ownership;
  const [
    homes,
    roomTypes,
    rooms,
    accounts,
    customers,
    services,
    allBookings,
    payments,
    refunds,
    usages,
    invoices,
    reviews,
  ] = await Promise.all([
    prisma.homestay.count(),
    prisma.loaiPhong.count(),
    prisma.phong.count(),
    prisma.taiKhoan.count(),
    prisma.khachHang.count(),
    prisma.dichVu.count(),
    prisma.datPhong.count(),
    prisma.thanhToanCoc.count(),
    prisma.hoanCoc.count(),
    prisma.suDungDichVu.count(),
    prisma.hoaDon.count(),
    prisma.danhGia.count(),
  ]);
  const relatedCounts = await Promise.all([
    prisma.thanhToanCoc.count({ where: { maDatPhong: { in: bookingIds } } }),
    prisma.hoanCoc.count({ where: { maDatPhong: { in: bookingIds } } }),
    prisma.suDungDichVu.count({ where: { maDatPhong: { in: bookingIds } } }),
    prisma.hoaDon.count({ where: { maDatPhong: { in: bookingIds } } }),
    prisma.danhGia.count({ where: { maDatPhong: { in: bookingIds } } }),
  ]);
  assertCleanupCounts(
    [
      homes,
      roomTypes,
      rooms,
      accounts,
      customers,
      services,
      allBookings,
      payments,
      refunds,
      usages,
      invoices,
      reviews,
    ],
    [1, 1, roomIds.length, 3, ownership.customerIds.length, 1, bookingIds.length, ...relatedCounts],
  );
  return ownership;
}

async function setup(
  prisma: PrismaClient,
  manifest: Sh22FixtureManifest,
  passwordHash: string,
): Promise<void> {
  const { ids, runId } = manifest;
  const roomIds = Object.values(ids.roomIds);
  // This explicit preflight prevents overwrite even if a caller forces a reused run ID.
  const existing = await Promise.all([
    prisma.taiKhoan.findMany({
      where: { maTaiKhoan: { in: Object.values(ids.accountIds) } },
      select: { maTaiKhoan: true },
    }),
    prisma.phong.findMany({ where: { maPhong: { in: roomIds } }, select: { maPhong: true } }),
    prisma.datPhong.findMany({
      where: { maDatPhong: { in: Object.values(ids.bookingIds) } },
      select: { maDatPhong: true },
    }),
  ]);
  assertNoExistingFixtureItems(existing.map((items) => items.length));

  const now = new Date();
  const day = (offset: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  await prisma.$transaction(async (tx) => {
    await tx.homestay.create({
      data: {
        maHomestay: ids.homestayId,
        tenHomestay: `${runId} Homestay`,
        diaChi: 'SH-22 E2E only',
        hotline: '0900000000',
        email: `${runId}@test.invalid`,
        quyDinhChung: 'SH-22 browser E2E fixture only',
      },
    });
    await tx.loaiPhong.create({
      data: {
        maLoaiPhong: ids.roomTypeId,
        tenLoaiPhong: `${runId} Room Type`,
        sucChuaToiDa: 2,
        giaNgayThuong: 800000,
        giaCuoiTuan: 800000,
        moTa: 'SH-22 E2E fixture only',
      },
    });
    await tx.phong.createMany({
      data: [
        {
          maPhong: ids.roomIds.sd01,
          soPhong: `${runId}-SD01`,
          tang: 1,
          trangThai: 'TRONG',
          maHomestay: ids.homestayId,
          maLoaiPhong: ids.roomTypeId,
        },
        {
          maPhong: ids.roomIds.sd02,
          soPhong: `${runId}-SD02`,
          tang: 1,
          trangThai: 'DA_DAT',
          maHomestay: ids.homestayId,
          maLoaiPhong: ids.roomTypeId,
        },
        {
          maPhong: ids.roomIds.sd05,
          soPhong: `${runId}-SD05`,
          tang: 1,
          trangThai: 'DANG_SU_DUNG',
          maHomestay: ids.homestayId,
          maLoaiPhong: ids.roomTypeId,
        },
      ],
    });
    await tx.dichVu.create({
      data: {
        maDichVu: ids.serviceId,
        tenDichVu: `${runId} Service`,
        donGia: 100000,
        donViTinh: 'lần',
      },
    });
    await tx.taiKhoan.createMany({
      data: [
        {
          maTaiKhoan: ids.accountIds.staff,
          username: ids.accountIds.staff,
          passwordHash,
          vaiTro: 'STAFF',
          trangThai: 'ACTIVE',
        },
        {
          maTaiKhoan: ids.accountIds.admin,
          username: ids.accountIds.admin,
          passwordHash,
          vaiTro: 'ADMIN',
          trangThai: 'ACTIVE',
        },
        {
          maTaiKhoan: ids.accountIds.customer,
          username: ids.accountIds.customer,
          passwordHash,
          vaiTro: 'CUSTOMER',
          trangThai: 'ACTIVE',
        },
      ],
    });
    await tx.khachHang.create({
      data: {
        maKH: ids.customerId,
        hoTen: `${runId} Customer`,
        soDienThoai: '0900000001',
        email: `${runId}-customer@test.invalid`,
        maTaiKhoan: ids.accountIds.customer,
      },
    });
    await tx.datPhong.createMany({
      data: [
        {
          maDatPhong: ids.bookingIds.sd02,
          maKH: ids.customerId,
          maPhong: ids.roomIds.sd02,
          ngayNhan: day(8),
          ngayTra: day(10),
          soKhach: 2,
          tienCoc: 480000,
          tongTienDuKien: 1600000,
          trangThai: 'DA_XAC_NHAN',
        },
        {
          maDatPhong: ids.bookingIds.sd05,
          maKH: ids.customerId,
          maPhong: ids.roomIds.sd05,
          ngayNhan: day(-1),
          ngayTra: day(1),
          soKhach: 2,
          tienCoc: 480000,
          tongTienDuKien: 1600000,
          trangThai: 'DANG_LUU_TRU',
        },
      ],
    });
    await tx.thanhToanCoc.createMany({
      data: [
        {
          maGiaoDich: ids.paymentIds.sd02,
          idempotencyKey: `${ids.paymentIds.sd02}-idem`,
          maDatPhong: ids.bookingIds.sd02,
          soTien: 480000,
        },
        {
          maGiaoDich: ids.paymentIds.sd05,
          idempotencyKey: `${ids.paymentIds.sd05}-idem`,
          maDatPhong: ids.bookingIds.sd05,
          soTien: 480000,
        },
      ],
    });
    await tx.suDungDichVu.create({
      data: {
        maDatPhong: ids.bookingIds.sd05,
        maDichVu: ids.serviceId,
        soLuong: 1,
        thanhTien: 100000,
      },
    });
  });
}

async function cleanup(prisma: PrismaClient, manifest: Sh22FixtureManifest): Promise<void> {
  const { bookingIds, customerIds } = await assertOnlyFixtureData(prisma, manifest);
  const { ids } = manifest;
  await prisma.$transaction(async (tx) => {
    await tx.danhGia.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
    await tx.hoaDon.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
    await tx.suDungDichVu.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
    await tx.hoanCoc.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
    await tx.thanhToanCoc.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
    await tx.datPhong.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
    await tx.dichVu.deleteMany({ where: { maDichVu: ids.serviceId } });
    await tx.khachHang.deleteMany({ where: { maKH: { in: customerIds } } });
    await tx.taiKhoan.deleteMany({ where: { maTaiKhoan: { in: Object.values(ids.accountIds) } } });
    await tx.phong.deleteMany({ where: { maPhong: { in: Object.values(ids.roomIds) } } });
    await tx.loaiPhong.deleteMany({ where: { maLoaiPhong: ids.roomTypeId } });
    await tx.homestay.deleteMany({ where: { maHomestay: ids.homestayId } });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  parseApprovedDatabaseUrl(databaseUrl);
  const runId = args.runId ?? (args.command === 'setup' ? createRunId() : undefined);
  const manifestPath =
    args.command === 'setup'
      ? manifestPathFor(runId as string)
      : assertManifestDirectory(args.manifestPath as string);
  const manifest =
    args.command === 'setup' ? createManifest(runId as string) : await readManifest(manifestPath);
  assertManifestPath(manifestPath, manifest.runId);

  const { prisma, pool } = createDatabaseClient(databaseUrl as string);
  try {
    await prisma.$connect();
    if (args.dryRun) {
      await executeDryRun({
        assertIdentity: () => assertDatabaseIdentity(prisma),
        readOnlyPreflight: () =>
          args.command === 'setup'
            ? assertEmptyApplicationDatabase(prisma)
            : assertOnlyFixtureData(prisma, manifest).then(() => undefined),
      });
      console.log(
        JSON.stringify({ dryRun: true, ...publicFixtureSummary(manifest, manifestPath) }),
      );
      return;
    }
    await assertDatabaseIdentity(prisma);
    let completedManifest = manifest;
    if (args.command === 'setup') {
      fixturePassword(); // Validate before any database read/write that could start a partial run.
      await assertEmptyApplicationDatabase(prisma);
      const passwordHash = await bcrypt.hash(fixturePassword(), 12);
      completedManifest = await executeSetupLifecycle(manifest, {
        writePrepared: (value) => createManifestFile(manifestPath, value),
        onPrepared: (value) =>
          console.log(JSON.stringify(publicFixtureSummary(value, manifestPath))),
        setup: () => setup(prisma, manifest, passwordHash),
        writeReady: (value) => replaceManifestFile(manifestPath, value),
      });
    } else {
      completedManifest = await executeCleanupLifecycle(manifest, {
        cleanup: () => cleanup(prisma, manifest),
        writeCleaned: (value) => replaceManifestFile(manifestPath, value),
      });
    }
    console.log(JSON.stringify(publicFixtureSummary(completedManifest, manifestPath)));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'SH-22 E2E fixture harness failed');
  process.exitCode = 1;
});
