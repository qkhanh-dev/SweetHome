import { stayDates, tinhGiaPhong, tinhTienHoanCoc } from './booking.rules';

describe('SD01/SD02 business rules', () => {
  it('prices Thursday, Friday and Saturday nights at 800k/1000k', () => {
    const { start, end } = stayDates('2026-11-12', '2026-11-15');
    expect(tinhGiaPhong(start, end, 800000, 1000000)).toEqual({
      soDemLuuTru: 3,
      soDemNgayThuong: 1,
      soDemCuoiTuan: 2,
      tongTienDuKien: 2800000,
      tienCoc: 840000,
    });
  });

  it.each([
    ['2026-02-30', '2026-03-03'],
    ['2026-11-12', '2026-11-12'],
    ['bad', '2026-11-13'],
  ])('rejects invalid dates %s / %s', (start, end) => {
    expect(() => stayDates(start, end)).toThrow();
  });

  it.each([
    [96, 100, 840000],
    [72, 100, 840000],
    [71.999, 50, 420000],
    [48, 50, 420000],
    [24, 50, 420000],
    [23.999, 0, 0],
    [12, 0, 0],
    [-1, 0, 0],
  ])('refund at %s hours', (hours, rate, amount) => {
    const arrival = new Date('2026-11-05T00:00:00Z');
    const now = new Date(+new Date('2026-11-05T07:00:00Z') - hours * 3600000);
    expect(tinhTienHoanCoc(arrival, 840000, now)).toMatchObject({
      tyLeHoanPhanTram: rate,
      soTienHoan: amount,
    });
  });

  it('rounds VND half refunds', () => {
    expect(tinhTienHoanCoc(new Date('2026-11-03'), 101, new Date('2026-11-01')).soTienHoan).toBe(
      51,
    );
  });
});
