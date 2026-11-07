-- CreateEnum
CREATE TYPE "TrangThaiPhong" AS ENUM ('TRONG', 'DA_DAT', 'DANG_SU_DUNG', 'CHO_DON_DEP', 'BAO_TRI');

-- CreateEnum
CREATE TYPE "TrangThaiDatPhong" AS ENUM ('CHO_COC', 'DA_XAC_NHAN', 'DANG_LUU_TRU', 'HOAN_TAT', 'DA_HUY');

-- CreateEnum
CREATE TYPE "TrangThaiHoaDon" AS ENUM ('CHUA_THANH_TOAN', 'DA_THANH_TOAN');

-- CreateTable
CREATE TABLE "Homestay" (
    "maHomestay" TEXT NOT NULL,
    "tenHomestay" TEXT NOT NULL,
    "diaChi" TEXT NOT NULL,
    "hotline" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "quyDinhChung" TEXT NOT NULL,

    CONSTRAINT "Homestay_pkey" PRIMARY KEY ("maHomestay")
);

-- CreateTable
CREATE TABLE "LoaiPhong" (
    "maLoaiPhong" TEXT NOT NULL,
    "tenLoaiPhong" TEXT NOT NULL,
    "sucChuaToiDa" INTEGER NOT NULL,
    "giaNgayThuong" DOUBLE PRECISION NOT NULL,
    "giaCuoiTuan" DOUBLE PRECISION NOT NULL,
    "moTa" TEXT NOT NULL,

    CONSTRAINT "LoaiPhong_pkey" PRIMARY KEY ("maLoaiPhong")
);

-- CreateTable
CREATE TABLE "TienNghi" (
    "maTienNghi" TEXT NOT NULL,
    "tenTienNghi" TEXT NOT NULL,
    "loaiTienNghi" TEXT NOT NULL,

    CONSTRAINT "TienNghi_pkey" PRIMARY KEY ("maTienNghi")
);

-- CreateTable
CREATE TABLE "Phong" (
    "maPhong" TEXT NOT NULL,
    "soPhong" TEXT NOT NULL,
    "tang" INTEGER NOT NULL,
    "trangThai" "TrangThaiPhong" NOT NULL DEFAULT 'TRONG',
    "maHomestay" TEXT NOT NULL,
    "maLoaiPhong" TEXT NOT NULL,

    CONSTRAINT "Phong_pkey" PRIMARY KEY ("maPhong")
);

-- CreateTable
CREATE TABLE "TaiKhoan" (
    "maTaiKhoan" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "vaiTro" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "trangThai" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "TaiKhoan_pkey" PRIMARY KEY ("maTaiKhoan")
);

-- CreateTable
CREATE TABLE "KhachHang" (
    "maKH" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "soDienThoai" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "soCCCD" TEXT,
    "maTaiKhoan" TEXT,

    CONSTRAINT "KhachHang_pkey" PRIMARY KEY ("maKH")
);

-- CreateTable
CREATE TABLE "DatPhong" (
    "maDatPhong" TEXT NOT NULL,
    "maKH" TEXT NOT NULL,
    "maPhong" TEXT NOT NULL,
    "ngayDat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayNhan" TIMESTAMP(3) NOT NULL,
    "ngayTra" TIMESTAMP(3) NOT NULL,
    "soKhach" INTEGER NOT NULL,
    "tienCoc" DOUBLE PRECISION NOT NULL,
    "tongTienDuKien" DOUBLE PRECISION NOT NULL,
    "trangThai" "TrangThaiDatPhong" NOT NULL DEFAULT 'CHO_COC',
    "ghiChu" TEXT,

    CONSTRAINT "DatPhong_pkey" PRIMARY KEY ("maDatPhong")
);

-- CreateTable
CREATE TABLE "DichVu" (
    "maDichVu" TEXT NOT NULL,
    "tenDichVu" TEXT NOT NULL,
    "donGia" DOUBLE PRECISION NOT NULL,
    "donViTinh" TEXT NOT NULL,

    CONSTRAINT "DichVu_pkey" PRIMARY KEY ("maDichVu")
);

-- CreateTable
CREATE TABLE "SuDungDichVu" (
    "maSuDung" TEXT NOT NULL,
    "maDatPhong" TEXT NOT NULL,
    "maDichVu" TEXT NOT NULL,
    "soLuong" INTEGER NOT NULL,
    "thoiDiem" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thanhTien" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SuDungDichVu_pkey" PRIMARY KEY ("maSuDung")
);

-- CreateTable
CREATE TABLE "HoaDon" (
    "maHoaDon" TEXT NOT NULL,
    "maDatPhong" TEXT NOT NULL,
    "tienPhong" DOUBLE PRECISION NOT NULL,
    "tienDichVu" DOUBLE PRECISION NOT NULL,
    "phuPhi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tienCocDaTra" DOUBLE PRECISION NOT NULL,
    "tongCanThanhToan" DOUBLE PRECISION NOT NULL,
    "ngayLap" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phuongThuc" TEXT NOT NULL DEFAULT 'CHUYEN_KHOAN_QR',
    "trangThai" "TrangThaiHoaDon" NOT NULL DEFAULT 'CHUA_THANH_TOAN',

    CONSTRAINT "HoaDon_pkey" PRIMARY KEY ("maHoaDon")
);

-- CreateTable
CREATE TABLE "DanhGia" (
    "maDanhGia" TEXT NOT NULL,
    "maDatPhong" TEXT NOT NULL,
    "soSao" INTEGER NOT NULL,
    "noiDung" TEXT NOT NULL,
    "ngayDanhGia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phanHoiHost" TEXT,

    CONSTRAINT "DanhGia_pkey" PRIMARY KEY ("maDanhGia")
);

-- CreateTable
CREATE TABLE "_PhongTienNghi" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Phong_soPhong_key" ON "Phong"("soPhong");

-- CreateIndex
CREATE UNIQUE INDEX "TaiKhoan_username_key" ON "TaiKhoan"("username");

-- CreateIndex
CREATE UNIQUE INDEX "KhachHang_maTaiKhoan_key" ON "KhachHang"("maTaiKhoan");

-- CreateIndex
CREATE INDEX "KhachHang_soDienThoai_idx" ON "KhachHang"("soDienThoai");

-- CreateIndex
CREATE INDEX "DatPhong_maPhong_ngayNhan_ngayTra_trangThai_idx" ON "DatPhong"("maPhong", "ngayNhan", "ngayTra", "trangThai");

-- CreateIndex
CREATE INDEX "SuDungDichVu_maDatPhong_idx" ON "SuDungDichVu"("maDatPhong");

-- CreateIndex
CREATE UNIQUE INDEX "HoaDon_maDatPhong_key" ON "HoaDon"("maDatPhong");

-- CreateIndex
CREATE INDEX "HoaDon_ngayLap_trangThai_idx" ON "HoaDon"("ngayLap", "trangThai");

-- CreateIndex
CREATE UNIQUE INDEX "DanhGia_maDatPhong_key" ON "DanhGia"("maDatPhong");

-- CreateIndex
CREATE UNIQUE INDEX "_PhongTienNghi_AB_unique" ON "_PhongTienNghi"("A", "B");

-- CreateIndex
CREATE INDEX "_PhongTienNghi_B_index" ON "_PhongTienNghi"("B");

-- AddForeignKey
ALTER TABLE "Phong" ADD CONSTRAINT "Phong_maHomestay_fkey" FOREIGN KEY ("maHomestay") REFERENCES "Homestay"("maHomestay") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phong" ADD CONSTRAINT "Phong_maLoaiPhong_fkey" FOREIGN KEY ("maLoaiPhong") REFERENCES "LoaiPhong"("maLoaiPhong") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhachHang" ADD CONSTRAINT "KhachHang_maTaiKhoan_fkey" FOREIGN KEY ("maTaiKhoan") REFERENCES "TaiKhoan"("maTaiKhoan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatPhong" ADD CONSTRAINT "DatPhong_maKH_fkey" FOREIGN KEY ("maKH") REFERENCES "KhachHang"("maKH") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatPhong" ADD CONSTRAINT "DatPhong_maPhong_fkey" FOREIGN KEY ("maPhong") REFERENCES "Phong"("maPhong") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuDungDichVu" ADD CONSTRAINT "SuDungDichVu_maDatPhong_fkey" FOREIGN KEY ("maDatPhong") REFERENCES "DatPhong"("maDatPhong") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuDungDichVu" ADD CONSTRAINT "SuDungDichVu_maDichVu_fkey" FOREIGN KEY ("maDichVu") REFERENCES "DichVu"("maDichVu") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoaDon" ADD CONSTRAINT "HoaDon_maDatPhong_fkey" FOREIGN KEY ("maDatPhong") REFERENCES "DatPhong"("maDatPhong") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhGia" ADD CONSTRAINT "DanhGia_maDatPhong_fkey" FOREIGN KEY ("maDatPhong") REFERENCES "DatPhong"("maDatPhong") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PhongTienNghi" ADD CONSTRAINT "_PhongTienNghi_A_fkey" FOREIGN KEY ("A") REFERENCES "Phong"("maPhong") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PhongTienNghi" ADD CONSTRAINT "_PhongTienNghi_B_fkey" FOREIGN KEY ("B") REFERENCES "TienNghi"("maTienNghi") ON DELETE CASCADE ON UPDATE CASCADE;
