-- CreateIndex
CREATE INDEX "DanhGia_ngayDanhGia_idx" ON "DanhGia"("ngayDanhGia");

-- CreateIndex
CREATE INDEX "DanhGia_soSao_idx" ON "DanhGia"("soSao");

-- CreateIndex
CREATE INDEX "DatPhong_maKH_idx" ON "DatPhong"("maKH");

-- CreateIndex
CREATE INDEX "DatPhong_trangThai_idx" ON "DatPhong"("trangThai");

-- CreateIndex
CREATE INDEX "DatPhong_ngayNhan_ngayTra_idx" ON "DatPhong"("ngayNhan", "ngayTra");

-- CreateIndex
CREATE INDEX "HoaDon_trangThai_idx" ON "HoaDon"("trangThai");

-- CreateIndex
CREATE INDEX "KhachHang_soCCCD_idx" ON "KhachHang"("soCCCD");

-- CreateIndex
CREATE INDEX "KhachHang_email_idx" ON "KhachHang"("email");

-- CreateIndex
CREATE INDEX "Phong_maHomestay_idx" ON "Phong"("maHomestay");

-- CreateIndex
CREATE INDEX "Phong_maLoaiPhong_idx" ON "Phong"("maLoaiPhong");

-- CreateIndex
CREATE INDEX "Phong_trangThai_idx" ON "Phong"("trangThai");

-- CreateIndex
CREATE INDEX "Phong_maHomestay_trangThai_idx" ON "Phong"("maHomestay", "trangThai");

-- CreateIndex
CREATE INDEX "SuDungDichVu_maDichVu_idx" ON "SuDungDichVu"("maDichVu");

-- CreateIndex
CREATE INDEX "SuDungDichVu_thoiDiem_idx" ON "SuDungDichVu"("thoiDiem");

-- CreateIndex
CREATE INDEX "TaiKhoan_vaiTro_trangThai_idx" ON "TaiKhoan"("vaiTro", "trangThai");
