import { tinhGiaPhongChiTiet } from './price';

describe('LoaiPhong.tinhGiaPhongChiTiet / BUSINESS_RULES.md', () => {
  test('Thứ Năm 12/11 → Chủ Nhật 15/11 (3 đêm) = 2,800,000', () => {
    expect(tinhGiaPhongChiTiet('2026-11-12', '2026-11-15', 800_000, 1_000_000)).toEqual({
      soDemTong: 3,
      soDemNgayThuong: 1,
      soDemCuoiTuan: 2,
      giaNgayThuong: 800_000,
      giaCuoiTuan: 1_000_000,
      tongTienDuKien: 2_800_000,
    });
  });

  test('chỉ tính đêm nhận, loại trừ ngày trả', () => {
    expect(tinhGiaPhongChiTiet('2026-11-13', '2026-11-14', 500_000, 650_000).tongTienDuKien).toBe(
      650_000,
    );
  });

  test('chạy qua ranh giới năm mà không sai thứ', () => {
    expect(tinhGiaPhongChiTiet('2026-12-31', '2027-01-02', 500, 800).tongTienDuKien).toBe(1300);
  });

  test.each([
    ['2026-11-12', '2026-11-12'],
    ['2026-11-15', '2026-11-12'],
    ['2026-02-30', '2026-03-03'],
  ])('reject invalid interval %s → %s', (start, end) => {
    expect(() => tinhGiaPhongChiTiet(start, end, 500, 650)).toThrow();
  });

  test('reject nonpositive prices', () => {
    expect(() => tinhGiaPhongChiTiet('2026-11-12', '2026-11-13', 0, 100)).toThrow();
  });
});
