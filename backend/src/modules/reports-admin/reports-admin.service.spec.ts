import { ReportsAdminService } from './reports-admin.service';
import { ReportQueryRepository } from './repositories/report-query.repository';
import type { ReportDateRangeDto, RevenueReportQueryDto } from './dto/report-query.dto';

describe('ReportsAdminService', () => {
  let service: ReportsAdminService;

  const reportQueries = {
    getRevenueStats: jest.fn(),
    getOccupancyRate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsAdminService(reportQueries as unknown as ReportQueryRepository);
  });

  it('delegates revenue filters and groupBy to the existing SH-14 repository', async () => {
    const expected = { tongHop: { tongDoanhThu: 1_800_000 }, chiTietTheoKy: [] };
    reportQueries.getRevenueStats.mockResolvedValue(expected);
    const query: RevenueReportQueryDto = {
      tuNgay: '2026-11-01',
      denNgay: '2026-11-30',
      groupBy: 'month',
    };

    await expect(service.getRevenueStats(query)).resolves.toBe(expected);
    expect(reportQueries.getRevenueStats).toHaveBeenCalledWith('2026-11-01', '2026-11-30', 'month');
  });

  it('preserves omitted revenue parameters so repository defaults remain authoritative', async () => {
    reportQueries.getRevenueStats.mockResolvedValue({});

    await service.getRevenueStats({});

    expect(reportQueries.getRevenueStats).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('delegates occupancy date filters to the existing SH-14 repository', async () => {
    const expected = { tongSoPhong: 12, tongSoDemKhaDung: 360 };
    reportQueries.getOccupancyRate.mockResolvedValue(expected);
    const query: ReportDateRangeDto = {
      tuNgay: '2026-11-01',
      denNgay: '2026-11-30',
    };

    await expect(service.getOccupancyRate(query)).resolves.toBe(expected);
    expect(reportQueries.getOccupancyRate).toHaveBeenCalledWith('2026-11-01', '2026-11-30');
  });
});
