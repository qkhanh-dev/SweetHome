
import { tinhGiaPhongChiTiet } from './price';

describe('LoaiPhong.tinhGiaPhongChiTiet / BUSINESS_RULES.md', () => {
  // ============================================================
  // 1. CAC TEST GOC
  // ============================================================

  test('Thứ Năm 12/11 → Chủ Nhật 15/11 (3 đêm) = 2,800,000', () => {
    expect(
      tinhGiaPhongChiTiet(
        '2026-11-12',
        '2026-11-15',
        800_000,
        1_000_000,
      ),
    ).toEqual({
      soDemTong: 3,
      soDemNgayThuong: 1,
      soDemCuoiTuan: 2,
      giaNgayThuong: 800_000,
      giaCuoiTuan: 1_000_000,
      tongTienDuKien: 2_800_000,
    });
  });

  test('chỉ tính đêm nhận, loại trừ ngày trả', () => {
    expect(
      tinhGiaPhongChiTiet(
        '2026-11-13',
        '2026-11-14',
        500_000,
        650_000,
      ).tongTienDuKien,
    ).toBe(650_000);
  });

  test('chạy qua ranh giới năm mà không sai thứ', () => {
    expect(
      tinhGiaPhongChiTiet(
        '2026-12-31',
        '2027-01-02',
        500,
        800,
      ).tongTienDuKien,
    ).toBe(1_300);
  });

  test.each([
    ['2026-11-12', '2026-11-12'],
    ['2026-11-15', '2026-11-12'],
    ['2026-02-30', '2026-03-03'],
  ])(
    'reject invalid interval %s → %s',
    (start, end) => {
      expect(() =>
        tinhGiaPhongChiTiet(start, end, 500, 650),
      ).toThrow();
    },
  );

  test('reject nonpositive prices', () => {
    expect(() =>
      tinhGiaPhongChiTiet(
        '2026-11-12',
        '2026-11-13',
        0,
        100,
      ),
    ).toThrow();
  });

  // ============================================================
  // 2. TEST BO SUNG - GIA NGAY THUONG
  // ============================================================

  test('T2 den T3: chi tinh gia ngay thuong', () => {
    const result = tinhGiaPhongChiTiet(
      '2026-11-09',
      '2026-11-10',
      800_000,
      1_000_000,
    );

    expect(result.soDemTong).toBe(1);
    expect(result.soDemNgayThuong).toBe(1);
    expect(result.soDemCuoiTuan).toBe(0);
    expect(result.tongTienDuKien).toBe(800_000);
  });

  // ============================================================
  // 3. TEST BO SUNG - GIA CUOI TUAN
  // ============================================================

  test('T6 den T2: ba dem cuoi tuan', () => {
    const result = tinhGiaPhongChiTiet(
      '2026-11-13',
      '2026-11-16',
      800_000,
      1_000_000,
    );

    expect(result.soDemTong).toBe(3);
    expect(result.soDemNgayThuong).toBe(0);
    expect(result.soDemCuoiTuan).toBe(3);
    expect(result.tongTienDuKien).toBe(3_000_000);
  });

  // ============================================================
  // 4. TEST BO SUNG - KHOANG NGAY GIAO NHAU
  // ============================================================

  test('CN den T3: mot dem cuoi tuan, mot dem thuong', () => {
    const result = tinhGiaPhongChiTiet(
      '2026-11-15',
      '2026-11-17',
      800_000,
      1_000_000,
    );

    expect(result.soDemTong).toBe(2);
    expect(result.soDemNgayThuong).toBe(1);
    expect(result.soDemCuoiTuan).toBe(1);
    expect(result.tongTienDuKien).toBe(1_800_000);
  });

  // ============================================================
  // 5. TEST BO SUNG - NAM NHUAN
  // ============================================================

  test('Nam nhuan: ngay 29/02 hop le', () => {
    const result = tinhGiaPhongChiTiet(
      '2028-02-28',
      '2028-03-01',
      500_000,
      700_000,
    );

    expect(result.soDemTong).toBe(2);
    expect(result.soDemNgayThuong).toBe(2);
    expect(result.soDemCuoiTuan).toBe(0);
    expect(result.tongTienDuKien).toBe(1_000_000);
  });

  // ============================================================
  // 6. TEST BO SUNG - NGAY KHONG TON TAI
  // ============================================================

  test('Tu choi ngay 29/02 cua nam khong nhuan', () => {
    expect(() =>
      tinhGiaPhongChiTiet(
        '2027-02-29',
        '2027-03-02',
        500_000,
        700_000,
      ),
    ).toThrow();
  });
});
