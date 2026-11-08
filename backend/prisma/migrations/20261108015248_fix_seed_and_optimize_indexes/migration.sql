-- DropIndex
DROP INDEX "HoaDon_ngayLap_trangThai_idx";

-- DropIndex
DROP INDEX "Phong_maHomestay_idx";

-- CreateIndex
CREATE INDEX "HoaDon_trangThai_ngayLap_idx" ON "HoaDon"("trangThai", "ngayLap");
