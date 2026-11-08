// backend/prisma/seed.ts
// SweetHome v2 - Seed Data Mẫu Chuẩn Nghiệp Vụ (Task SH-03)
// Đảm bảo Idempotency (xóa sạch dữ liệu cũ theo đúng thứ tự trước khi nạp mới)

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  TrangThaiPhong,
  TrangThaiDatPhong,
  TrangThaiHoaDon,
} from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('===============================================================');
  console.log(' BẮT ĐẦU NẠP SEED DATA CHO HỆ THỐNG SWEETHOME V2 (PRISMA 7)');
  console.log('===============================================================');

  // --------------------------------------------------------------------------
  // BƯỚC 1: XÓA SẠCH DỮ LIỆU CŨ THEO THỨ TỰ (IDEMPOTENT CLEAN-UP)
  // --------------------------------------------------------------------------
  console.log('1. Đang làm sạch dữ liệu cũ để đảm bảo tính Idempotent...');
  await prisma.$transaction([
    prisma.danhGia.deleteMany(),
    prisma.hoaDon.deleteMany(),
    prisma.suDungDichVu.deleteMany(),
    prisma.datPhong.deleteMany(),
    prisma.phong.deleteMany(),
    prisma.khachHang.deleteMany(),
    prisma.taiKhoan.deleteMany(),
    prisma.dichVu.deleteMany(),
    prisma.tienNghi.deleteMany(),
    prisma.loaiPhong.deleteMany(),
    prisma.homestay.deleteMany(),
  ]);
  console.log('   Đã dọn dẹp sạch sẽ 11 bảng dữ liệu.');

  // --------------------------------------------------------------------------
  // BƯỚC 2: KHỞI TẠO TÀI KHOẢN (TaiKhoan - 6 tài khoản phân quyền RBAC)
  // --------------------------------------------------------------------------
  console.log('2. Đang tạo dữ liệu TaiKhoan...');
  // Password mẫu: '123456' đã được băm bcrypt 10 rounds (chuẩn 60 ký tự, đã verify bcrypt.compare)
  const defaultPasswordHash =
    '$2b$10$xq.4qNyhHjkLQl8a4RcGN.sMgcxb.tLc3f7NI/GIEkPaJIspL1zkq';

  const tkAdmin = await prisma.taiKhoan.create({
    data: {
      username: 'admin',
      passwordHash: defaultPasswordHash,
      vaiTro: 'ADMIN',
      trangThai: 'ACTIVE',
    },
  });

  const tkStaffDalat = await prisma.taiKhoan.create({
    data: {
      username: 'staff_dalat',
      passwordHash: defaultPasswordHash,
      vaiTro: 'STAFF',
      trangThai: 'ACTIVE',
    },
  });

  const tkStaffVungtau = await prisma.taiKhoan.create({
    data: {
      username: 'staff_vungtau',
      passwordHash: defaultPasswordHash,
      vaiTro: 'STAFF',
      trangThai: 'ACTIVE',
    },
  });

  const tkCustomer1 = await prisma.taiKhoan.create({
    data: {
      username: 'khanh_customer',
      passwordHash: defaultPasswordHash,
      vaiTro: 'CUSTOMER',
      trangThai: 'ACTIVE',
    },
  });

  const tkCustomer2 = await prisma.taiKhoan.create({
    data: {
      username: 'hoang_customer',
      passwordHash: defaultPasswordHash,
      vaiTro: 'CUSTOMER',
      trangThai: 'ACTIVE',
    },
  });

  const tkCustomerLocked = await prisma.taiKhoan.create({
    data: {
      username: 'locked_user',
      passwordHash: defaultPasswordHash,
      vaiTro: 'CUSTOMER',
      trangThai: 'LOCKED',
    },
  });

  // --------------------------------------------------------------------------
  // BƯỚC 3: KHỞI TẠO CƠ SỞ HOMESTAY (Homestay - 3 cơ sở tại Đà Lạt, Vũng Tàu, Hội An)
  // --------------------------------------------------------------------------
  console.log('3. Đang tạo dữ liệu Homestay...');
  const hsDalat = await prisma.homestay.create({
    data: {
      tenHomestay: 'SweetHome Đà Lạt - Thung Lũng Mây',
      diaChi: '48 Khởi Nghĩa Bắc Sơn, Phường 10, TP. Đà Lạt, Lâm Đồng',
      hotline: '0901234567',
      email: 'dalat@sweethome.vn',
      quyDinhChung:
        'Check-in từ 14:00, check-out trước 12:00. Nghiêm cấm hút thuốc trong phòng ngủ. Giữ yên tĩnh chung sau 22:00 để bảo đảm không gian nghỉ dưỡng.',
    },
  });

  const hsVungtau = await prisma.homestay.create({
    data: {
      tenHomestay: 'SweetHome Vũng Tàu - Biển Xanh',
      diaChi: '12 Lê Hồng Phong, Phường Thắng Tam, TP. Vũng Tàu, Bà Rịa - Vũng Tàu',
      hotline: '0902345678',
      email: 'vungtau@sweethome.vn',
      quyDinhChung:
        'Check-in từ 14:00, check-out trước 12:00. Vui lòng tắm tráng nước ngọt tại sảnh trước khi lên phòng sau khi tắm biển.',
    },
  });

  const hsHoian = await prisma.homestay.create({
    data: {
      tenHomestay: 'SweetHome Hội An - Phố Cổ Heritage',
      diaChi: '86 Trần Phú, Phường Minh An, TP. Hội An, Quảng Nam',
      hotline: '0903456789',
      email: 'hoian@sweethome.vn',
      quyDinhChung:
        'Check-in từ 14:00, check-out trước 12:00. Giữ gìn vệ sinh và bảo tồn kiến trúc nhà gỗ cổ kính của Homestay.',
    },
  });

  // --------------------------------------------------------------------------
  // BƯỚC 4: KHỞI TẠO TIỆN NGHI (TienNghi - 10 tiện ích đa dạng)
  // --------------------------------------------------------------------------
  console.log('4. Đang tạo dữ liệu TienNghi...');
  const tnWifi = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Wi-Fi 6 Mesh Tốc độ cao', loaiTienNghi: 'Kỹ thuật số' },
  });
  const tnBonTam = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Bồn tắm nằm view kính panorama', loaiTienNghi: 'Phòng tắm' },
  });
  const tnMayChieu = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Máy chiếu phim 4K 120-inch & Netflix', loaiTienNghi: 'Giải trí' },
  });
  const tnBanCong = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Ban công ngắm bình minh & thung lũng', loaiTienNghi: 'Không gian' },
  });
  const tnBbq = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Khu vực bếp nướng BBQ ngoài trời', loaiTienNghi: 'Ăn uống' },
  });
  const tnDieuHoa = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Điều hòa Inverter 2 chiều êm ái', loaiTienNghi: 'Cơ bản' },
  });
  const tnTuLanh = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Tủ lạnh mini bar cao cấp', loaiTienNghi: 'Cơ bản' },
  });
  const tnMaySay = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Máy sấy tóc ion công suất lớn', loaiTienNghi: 'Phòng tắm' },
  });
  const tnAmNuoc = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Ấm đun siêu tốc & Set Trà Oolong', loaiTienNghi: 'Ăn uống' },
  });
  const tnSmartTv = await prisma.tienNghi.create({
    data: { tenTienNghi: 'Smart TV 55-inch 4K HDR', loaiTienNghi: 'Giải trí' },
  });

  // --------------------------------------------------------------------------
  // BƯỚC 5: KHỞI TẠO HẠNG PHÒNG (LoaiPhong - 3 hạng phòng chuẩn giá ngày/cuối tuần)
  // --------------------------------------------------------------------------
  console.log('5. Đang tạo dữ liệu LoaiPhong...');
  const lpStandard = await prisma.loaiPhong.create({
    data: {
      tenLoaiPhong: 'Standard Cozy Double',
      sucChuaToiDa: 2,
      giaNgayThuong: 500000,
      giaCuoiTuan: 650000,
      moTa: 'Phòng đôi tiêu chuẩn ấm cúng dành cho 2 khách, cửa sổ đón sáng tự nhiên, trang bị đầy đủ tiện nghi thiết yếu.',
    },
  });

  const lpDeluxe = await prisma.loaiPhong.create({
    data: {
      tenLoaiPhong: 'Deluxe Panoramic View',
      sucChuaToiDa: 2,
      giaNgayThuong: 800000,
      giaCuoiTuan: 1000000,
      moTa: 'Hạng phòng cao cấp với ban công riêng biệt ngắm trọn thung lũng hoặc bãi biển, trang bị bồn tắm nằm và máy chiếu 4K.',
    },
  });

  const lpFamily = await prisma.loaiPhong.create({
    data: {
      tenLoaiPhong: 'Family VIP Suite Garden',
      sucChuaToiDa: 4,
      giaNgayThuong: 1400000,
      giaCuoiTuan: 1800000,
      moTa: 'Căn suite 2 phòng ngủ rộng rãi kèm sân vườn riêng, lý tưởng cho gia đình hoặc nhóm bạn thân 4–5 người thư giãn.',
    },
  });

  // --------------------------------------------------------------------------
  // BƯỚC 6: KHỞI TẠO PHÒNG (Phong - 10 phòng trải đều 5 trạng thái & gắn N-N TienNghi)
  // --------------------------------------------------------------------------
  console.log('6. Đang tạo dữ liệu Phong & gán quan hệ N-N với TienNghi...');

  // Phòng Đà Lạt
  const phong101 = await prisma.phong.create({
    data: {
      soPhong: 'P101',
      tang: 1,
      trangThai: TrangThaiPhong.TRONG,
      maHomestay: hsDalat.maHomestay,
      maLoaiPhong: lpStandard.maLoaiPhong,
      tienNghis: {
        connect: [{ maTienNghi: tnWifi.maTienNghi }, { maTienNghi: tnDieuHoa.maTienNghi }, { maTienNghi: tnMaySay.maTienNghi }, { maTienNghi: tnAmNuoc.maTienNghi }],
      },
    },
  });

  const phong102 = await prisma.phong.create({
    data: {
      soPhong: 'P102',
      tang: 1,
      trangThai: TrangThaiPhong.DA_DAT,
      maHomestay: hsDalat.maHomestay,
      maLoaiPhong: lpDeluxe.maLoaiPhong,
      tienNghis: {
        connect: [
          { maTienNghi: tnWifi.maTienNghi },
          { maTienNghi: tnBonTam.maTienNghi },
          { maTienNghi: tnMayChieu.maTienNghi },
          { maTienNghi: tnBanCong.maTienNghi },
          { maTienNghi: tnDieuHoa.maTienNghi },
          { maTienNghi: tnMaySay.maTienNghi },
        ],
      },
    },
  });

  const phong201 = await prisma.phong.create({
    data: {
      soPhong: 'P201',
      tang: 2,
      trangThai: TrangThaiPhong.TRONG,
      maHomestay: hsDalat.maHomestay,
      maLoaiPhong: lpDeluxe.maLoaiPhong,
      tienNghis: {
        connect: [
          { maTienNghi: tnWifi.maTienNghi },
          { maTienNghi: tnBonTam.maTienNghi },
          { maTienNghi: tnMayChieu.maTienNghi },
          { maTienNghi: tnBanCong.maTienNghi },
          { maTienNghi: tnTuLanh.maTienNghi },
        ],
      },
    },
  });

  const phong202 = await prisma.phong.create({
    data: {
      soPhong: 'P202',
      tang: 2,
      trangThai: TrangThaiPhong.CHO_DON_DEP,
      maHomestay: hsDalat.maHomestay,
      maLoaiPhong: lpFamily.maLoaiPhong,
      tienNghis: {
        connect: [
          { maTienNghi: tnWifi.maTienNghi },
          { maTienNghi: tnBonTam.maTienNghi },
          { maTienNghi: tnBbq.maTienNghi },
          { maTienNghi: tnBanCong.maTienNghi },
          { maTienNghi: tnSmartTv.maTienNghi },
          { maTienNghi: tnTuLanh.maTienNghi },
        ],
      },
    },
  });

  const phong301 = await prisma.phong.create({
    data: {
      soPhong: 'P301',
      tang: 3,
      trangThai: TrangThaiPhong.BAO_TRI,
      maHomestay: hsDalat.maHomestay,
      maLoaiPhong: lpFamily.maLoaiPhong,
      tienNghis: {
        connect: [
          { maTienNghi: tnWifi.maTienNghi },
          { maTienNghi: tnBonTam.maTienNghi },
          { maTienNghi: tnBbq.maTienNghi },
          { maTienNghi: tnSmartTv.maTienNghi },
        ],
      },
    },
  });

  // Phòng Vũng Tàu
  const phong103 = await prisma.phong.create({
    data: {
      soPhong: 'P103',
      tang: 1,
      trangThai: TrangThaiPhong.TRONG,
      maHomestay: hsVungtau.maHomestay,
      maLoaiPhong: lpStandard.maLoaiPhong,
      tienNghis: {
        connect: [{ maTienNghi: tnWifi.maTienNghi }, { maTienNghi: tnDieuHoa.maTienNghi }, { maTienNghi: tnMaySay.maTienNghi }],
      },
    },
  });

  const phong203 = await prisma.phong.create({
    data: {
      soPhong: 'P203',
      tang: 2,
      trangThai: TrangThaiPhong.TRONG,
      maHomestay: hsVungtau.maHomestay,
      maLoaiPhong: lpDeluxe.maLoaiPhong,
      tienNghis: {
        connect: [
          { maTienNghi: tnWifi.maTienNghi },
          { maTienNghi: tnBonTam.maTienNghi },
          { maTienNghi: tnBanCong.maTienNghi },
          { maTienNghi: tnSmartTv.maTienNghi },
        ],
      },
    },
  });

  const phong302 = await prisma.phong.create({
    data: {
      soPhong: 'P302',
      tang: 3,
      trangThai: TrangThaiPhong.DANG_SU_DUNG,
      maHomestay: hsVungtau.maHomestay,
      maLoaiPhong: lpFamily.maLoaiPhong,
      tienNghis: {
        connect: [
          { maTienNghi: tnWifi.maTienNghi },
          { maTienNghi: tnBbq.maTienNghi },
          { maTienNghi: tnSmartTv.maTienNghi },
          { maTienNghi: tnTuLanh.maTienNghi },
        ],
      },
    },
  });

  // Phòng Hội An
  const phong104 = await prisma.phong.create({
    data: {
      soPhong: 'P104',
      tang: 1,
      trangThai: TrangThaiPhong.TRONG,
      maHomestay: hsHoian.maHomestay,
      maLoaiPhong: lpStandard.maLoaiPhong,
      tienNghis: {
        connect: [{ maTienNghi: tnWifi.maTienNghi }, { maTienNghi: tnDieuHoa.maTienNghi }, { maTienNghi: tnAmNuoc.maTienNghi }],
      },
    },
  });

  const phong204 = await prisma.phong.create({
    data: {
      soPhong: 'P204',
      tang: 2,
      trangThai: TrangThaiPhong.TRONG,
      maHomestay: hsHoian.maHomestay,
      maLoaiPhong: lpDeluxe.maLoaiPhong,
      tienNghis: {
        connect: [
          { maTienNghi: tnWifi.maTienNghi },
          { maTienNghi: tnBanCong.maTienNghi },
          { maTienNghi: tnBonTam.maTienNghi },
          { maTienNghi: tnSmartTv.maTienNghi },
        ],
      },
    },
  });

  // --------------------------------------------------------------------------
  // BƯỚC 7: KHỞI TẠO KHÁCH HÀNG (KhachHang - 5 khách hàng với CCCD hợp lệ)
  // --------------------------------------------------------------------------
  console.log('7. Đang tạo dữ liệu KhachHang...');
  const khKhanh = await prisma.khachHang.create({
    data: {
      hoTen: 'Cao Nguyên Quốc Khánh',
      soDienThoai: '0912345678',
      email: 'khanh.cao@gmail.com',
      soCCCD: '079098001122',
      maTaiKhoan: tkCustomer1.maTaiKhoan,
    },
  });

  const khHoang = await prisma.khachHang.create({
    data: {
      hoTen: 'Trần Khải Hoàng',
      soDienThoai: '0923456789',
      email: 'hoang.tran@gmail.com',
      soCCCD: '079098002233',
      maTaiKhoan: tkCustomer2.maTaiKhoan,
    },
  });

  const khThuy = await prisma.khachHang.create({
    data: {
      hoTen: 'Nguyễn Văn Thụy',
      soDienThoai: '0934567890',
      email: 'thuy.nguyen@gmail.com',
      soCCCD: '079098003344',
      // Khách vãng lai không tạo tài khoản
    },
  });

  const khLap = await prisma.khachHang.create({
    data: {
      hoTen: 'Phạm Tấn Lập',
      soDienThoai: '0945678901',
      email: 'lap.pham@gmail.com',
      soCCCD: '079098004455',
    },
  });

  const khHuy = await prisma.khachHang.create({
    data: {
      hoTen: 'Huỳnh Nguyễn Khắc Huy',
      soDienThoai: '0956789012',
      email: 'huy.huynh@gmail.com',
      soCCCD: '079098005566',
    },
  });

  // --------------------------------------------------------------------------
  // BƯỚC 8: KHỞI TẠO DANH MỤC DỊCH VỤ (DichVu - 6 dịch vụ hỗ trợ lưu trú)
  // --------------------------------------------------------------------------
  console.log('8. Đang tạo dữ liệu DichVu...');
  const dvXeMay = await prisma.dichVu.create({
    data: {
      tenDichVu: 'Thuê xe máy tay ga (AirBlade 125cc)',
      donGia: 150000,
      donViTinh: 'Ngày',
    },
  });

  const dvBbq = await prisma.dichVu.create({
    data: {
      tenDichVu: 'Set nướng BBQ sân vườn hải sản & thịt bò',
      donGia: 350000,
      donViTinh: 'Set',
    },
  });

  const dvGiatUi = await prisma.dichVu.create({
    data: {
      tenDichVu: 'Giặt ủi sấy thơm lấy nhanh',
      donGia: 40000,
      donViTinh: 'Kg',
    },
  });

  const dvAnSang = await prisma.dichVu.create({
    data: {
      tenDichVu: 'Bữa sáng đặc sản địa phương & Cà phê',
      donGia: 65000,
      donViTinh: 'Suất',
    },
  });

  const dvDuaDon = await prisma.dichVu.create({
    data: {
      tenDichVu: 'Đưa đón sân bay / ga tàu 7 chỗ',
      donGia: 300000,
      donViTinh: 'Chuyến',
    },
  });

  const dvLuaTrai = await prisma.dichVu.create({
    data: {
      tenDichVu: 'Bó củi thông sưởi lửa trại sân vườn',
      donGia: 80000,
      donViTinh: 'Bó',
    },
  });

  // --------------------------------------------------------------------------
  // BƯỚC 9: KHỞI TẠO ĐƠN ĐẶT PHÒNG, DỊCH VỤ, HÓA ĐƠN & ĐÁNH GIÁ (6 Kịch bản SD)
  // --------------------------------------------------------------------------
  console.log('9. Đang tạo dữ liệu DatPhong, SuDungDichVu, HoaDon và DanhGia...');

  // Mốc thời gian tham chiếu hiện tại
  const now = new Date();

  // --------------------------------------------------------------------------
  // KỊCH BẢN 1: ĐƠN HOÀN TẤT (HOAN_TAT) - Đã Check-out, Quyết toán & Có Đánh giá có Host phản hồi
  // Khách: Cao Nguyên Quốc Khánh - Phòng: P201 (Deluxe Đà Lạt)
  // Thời gian: 3 ngày trước đến hôm qua (2 đêm: 1 Thứ Năm [800k] + 1 Thứ Sáu [1000k]) -> Tổng 1.8M, Cọc 540k
  // --------------------------------------------------------------------------
  const ngayNhan1 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const ngayTra1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const dp1 = await prisma.datPhong.create({
    data: {
      maKH: khKhanh.maKH,
      maPhong: phong201.maPhong,
      ngayDat: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      ngayNhan: ngayNhan1,
      ngayTra: ngayTra1,
      soKhach: 2,
      tongTienDuKien: 1800000,
      tienCoc: 540000, // 30% của 1.8M
      trangThai: TrangThaiDatPhong.HOAN_TAT,
      ghiChu: 'Khách đến nghỉ tuần trăng mật, chuẩn bị giúp phòng tầng cao view thoáng.',
    },
  });

  // Dịch vụ của đơn 1: 1 Set BBQ (350k) + 1 Ngày xe máy (150k) = 500k
  await prisma.suDungDichVu.create({
    data: {
      maDatPhong: dp1.maDatPhong,
      maDichVu: dvBbq.maDichVu,
      soLuong: 1,
      thoiDiem: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      thanhTien: 350000,
    },
  });
  await prisma.suDungDichVu.create({
    data: {
      maDatPhong: dp1.maDatPhong,
      maDichVu: dvXeMay.maDichVu,
      soLuong: 1,
      thoiDiem: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      thanhTien: 150000,
    },
  });

  // Hóa đơn 1-1 với đơn 1:
  // tongCanThanhToan = tienPhong (1.8M) + tienDichVu (500k) + phuPhi (0) - tienCocDaTra (540k) = 1,760,000
  await prisma.hoaDon.create({
    data: {
      maDatPhong: dp1.maDatPhong,
      tienPhong: 1800000,
      tienDichVu: 500000,
      phuPhi: 0,
      tienCocDaTra: 540000,
      tongCanThanhToan: 1760000,
      ngayLap: ngayTra1,
      phuongThuc: 'CHUYEN_KHOAN_QR',
      trangThai: TrangThaiHoaDon.DA_THANH_TOAN,
    },
  });

  // Đánh giá 0..1-1 cho đơn 1 (ĐÃ CÓ phản hồi từ Host):
  await prisma.danhGia.create({
    data: {
      maDatPhong: dp1.maDatPhong,
      soSao: 5,
      noiDung:
        'Phòng view thung lũng ngắm mây cực kỳ đẹp, máy chiếu xem phim buổi tối chill lắm! Host nhiệt tình, đồ ăn BBQ rất ngon và tươi sạch.',
      ngayDanhGia: ngayTra1,
      phanHoiHost:
        'Cảm ơn bạn Khánh và bạn đời đã lựa chọn SweetHome! Rất hân hạnh được đón tiếp hai bạn trong những kỳ nghỉ kỷ niệm tiếp theo ạ!',
    },
  });

  // --------------------------------------------------------------------------
  // KỊCH BẢN 2: ĐƠN HOÀN TẤT (HOAN_TAT) - Đã thanh toán & Đánh giá CHƯA có phản hồi host (phanHoiHost: null)
  // Khách: Trần Khải Hoàng - Phòng: P202 (Family Suite Đà Lạt)
  // Thời gian: 2 đêm cuối tuần -> 2 * 1.8M = 3.6M, Cọc 1.08M
  // --------------------------------------------------------------------------
  const ngayNhan2 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const ngayTra2 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const dp2 = await prisma.datPhong.create({
    data: {
      maKH: khHoang.maKH,
      maPhong: phong202.maPhong,
      ngayDat: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      ngayNhan: ngayNhan2,
      ngayTra: ngayTra2,
      soKhach: 4,
      tongTienDuKien: 3600000,
      tienCoc: 1080000,
      trangThai: TrangThaiDatPhong.HOAN_TAT,
      ghiChu: 'Gia đình có trẻ nhỏ, xin thêm nệm phụ mỏng.',
    },
  });

  // Dịch vụ đơn 2: 2 Set BBQ (700k) + 2 Suất ăn sáng (130k) = 830k
  await prisma.suDungDichVu.create({
    data: {
      maDatPhong: dp2.maDatPhong,
      maDichVu: dvBbq.maDichVu,
      soLuong: 2,
      thoiDiem: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      thanhTien: 700000,
    },
  });
  await prisma.suDungDichVu.create({
    data: {
      maDatPhong: dp2.maDatPhong,
      maDichVu: dvAnSang.maDichVu,
      soLuong: 2,
      thoiDiem: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      thanhTien: 130000,
    },
  });

  // Hóa đơn đơn 2:
  // tongCanThanhToan = 3.6M + 830k + 50k (phụ thu check-out muộn 30p) - 1.08M = 3,400,000
  await prisma.hoaDon.create({
    data: {
      maDatPhong: dp2.maDatPhong,
      tienPhong: 3600000,
      tienDichVu: 830000,
      phuPhi: 50000,
      tienCocDaTra: 1080000,
      tongCanThanhToan: 3400000,
      ngayLap: ngayTra2,
      phuongThuc: 'TIEN_MAT',
      trangThai: TrangThaiHoaDon.DA_THANH_TOAN,
    },
  });

  // Đánh giá đơn 2 (CHƯA có phản hồi từ Host -> phanHoiHost: null):
  await prisma.danhGia.create({
    data: {
      maDatPhong: dp2.maDatPhong,
      soSao: 4,
      noiDung:
        'Căn suite rộng rãi, thiết kế ấm cúng rất hợp gia đình. Điểm trừ nhỏ là con dốc vào homestay hơi khó đi đối với xe gầm thấp.',
      ngayDanhGia: ngayTra2,
      phanHoiHost: null,
    },
  });

  // --------------------------------------------------------------------------
  // KỊCH BẢN 3: ĐƠN ĐANG LƯU TRÚ (DANG_LUU_TRU) - Khách đã Check-in bằng CCCD
  // Khách: Nguyễn Văn Thụy - Phòng: P302 (Family Vũng Tàu)
  // Thời gian: Nhận hôm qua, trả ngày mai -> 2 đêm cuối tuần = 3.6M, Cọc 1.08M
  // --------------------------------------------------------------------------
  const ngayNhan3 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const ngayTra3 = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const dp3 = await prisma.datPhong.create({
    data: {
      maKH: khThuy.maKH,
      maPhong: phong302.maPhong,
      ngayDat: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      ngayNhan: ngayNhan3,
      ngayTra: ngayTra3,
      soKhach: 4,
      tongTienDuKien: 3600000,
      tienCoc: 1080000,
      trangThai: TrangThaiDatPhong.DANG_LUU_TRU,
      ghiChu: 'Khách yêu cầu chuẩn bị củi sưởi và hỗ trợ chỗ đậu ô tô 7 chỗ.',
    },
  });

  // Đang gọi dịch vụ trong kỳ lưu trú: 2 ngày xe máy (300k) + Giặt ủi 3kg (120k) + 1 bó củi (80k) = 500k
  await prisma.suDungDichVu.create({
    data: {
      maDatPhong: dp3.maDatPhong,
      maDichVu: dvXeMay.maDichVu,
      soLuong: 2,
      thoiDiem: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      thanhTien: 300000,
    },
  });
  await prisma.suDungDichVu.create({
    data: {
      maDatPhong: dp3.maDatPhong,
      maDichVu: dvGiatUi.maDichVu,
      soLuong: 3,
      thoiDiem: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      thanhTien: 120000,
    },
  });
  await prisma.suDungDichVu.create({
    data: {
      maDatPhong: dp3.maDatPhong,
      maDichVu: dvLuaTrai.maDichVu,
      soLuong: 1,
      thoiDiem: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      thanhTien: 80000,
    },
  });

  // Hóa đơn nháp khi chuẩn bị check-out (CHUA_THANH_TOAN):
  // tongCanThanhToan = 3.6M + 500k - 1.08M = 3,020,000
  await prisma.hoaDon.create({
    data: {
      maDatPhong: dp3.maDatPhong,
      tienPhong: 3600000,
      tienDichVu: 500000,
      phuPhi: 0,
      tienCocDaTra: 1080000,
      tongCanThanhToan: 3020000,
      ngayLap: now,
      phuongThuc: 'CHUYEN_KHOAN_QR',
      trangThai: TrangThaiHoaDon.CHUA_THANH_TOAN,
    },
  });

  // --------------------------------------------------------------------------
  // KỊCH BẢN 4: ĐƠN ĐÃ XÁC NHẬN CỌC (DA_XAC_NHAN) - Chờ khách đến nhận phòng
  // Khách: Phạm Tấn Lập - Phòng: P102 (Deluxe Đà Lạt)
  // Thời gian: Đặt cho tuần tới (2 đêm cuối tuần): 2 * 1.0M = 2.0M, Cọc 600k
  // --------------------------------------------------------------------------
  const ngayNhan4 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const ngayTra4 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  await prisma.datPhong.create({
    data: {
      maKH: khLap.maKH,
      maPhong: phong102.maPhong,
      ngayDat: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      ngayNhan: ngayNhan4,
      ngayTra: ngayTra4,
      soKhach: 2,
      tongTienDuKien: 2000000,
      tienCoc: 600000, // 30%
      trangThai: TrangThaiDatPhong.DA_XAC_NHAN,
      ghiChu: 'Đã thanh toán 30% cọc qua VietQR chuyển khoản tự động.',
    },
  });

  // --------------------------------------------------------------------------
  // KỊCH BẢN 5: ĐƠN CHỜ THANH TOÁN CỌC (CHO_COC) - Khách vừa tạo đơn
  // Khách: Huỳnh Nguyễn Khắc Huy - Phòng: P203 (Deluxe Vũng Tàu)
  // Thời gian: 3 đêm ngày thường (Thứ Hai -> Thứ Năm): 3 * 800k = 2.4M, Cọc 720k
  // --------------------------------------------------------------------------
  const ngayNhan5 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const ngayTra5 = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000);
  await prisma.datPhong.create({
    data: {
      maKH: khHuy.maKH,
      maPhong: phong203.maPhong,
      ngayDat: now,
      ngayNhan: ngayNhan5,
      ngayTra: ngayTra5,
      soKhach: 2,
      tongTienDuKien: 2400000,
      tienCoc: 720000,
      trangThai: TrangThaiDatPhong.CHO_COC,
      ghiChu: 'Hệ thống đang chờ webhook VietQR xác nhận tiền cọc 30% (720.000đ).',
    },
  });

  // --------------------------------------------------------------------------
  // KỊCH BẢN 6: ĐƠN ĐÃ HỦY (DA_HUY) - Hủy trước > 72h và hoàn 100% tiền cọc
  // Khách: Cao Nguyên Quốc Khánh - Phòng: P101 (Standard)
  // --------------------------------------------------------------------------
  const ngayNhan6 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const ngayTra6 = new Date(now.getTime() + 17 * 24 * 60 * 60 * 1000);
  await prisma.datPhong.create({
    data: {
      maKH: khKhanh.maKH,
      maPhong: phong101.maPhong,
      ngayDat: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      ngayNhan: ngayNhan6,
      ngayTra: ngayTra6,
      soKhach: 2,
      tongTienDuKien: 1000000,
      tienCoc: 300000,
      trangThai: TrangThaiDatPhong.DA_HUY,
      ghiChu:
        'Khách báo thay đổi lịch công tác. Hủy trước giờ nhận phòng > 72 giờ: Đã hoàn 100% tiền cọc (300.000 VNĐ) qua PaymentGateway.',
    },
  });

  console.log('===============================================================');
  console.log(' NẠP SEED DATA THÀNH CÔNG 100% TRÊN PRISMA 7 & POSTGRESQL 16!');
  console.log('===============================================================');
}

main()
  .catch((e) => {
    console.error('LỖI KHI NẠP SEED DATA:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

