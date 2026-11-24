CREATE TABLE "ThanhToanCoc" (
  "maGiaoDich" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "maDatPhong" TEXT NOT NULL,
  "soTien" DOUBLE PRECISION NOT NULL,
  "ngayXuLy" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThanhToanCoc_pkey" PRIMARY KEY ("maGiaoDich")
);
CREATE UNIQUE INDEX "ThanhToanCoc_idempotencyKey_key" ON "ThanhToanCoc"("idempotencyKey");
CREATE UNIQUE INDEX "ThanhToanCoc_maDatPhong_key" ON "ThanhToanCoc"("maDatPhong");
ALTER TABLE "ThanhToanCoc" ADD CONSTRAINT "ThanhToanCoc_maDatPhong_fkey" FOREIGN KEY ("maDatPhong") REFERENCES "DatPhong"("maDatPhong") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HoanCoc" (
  "maDatPhong" TEXT NOT NULL,
  "maGiaoDichHoan" TEXT NOT NULL,
  "maGiaoDich" TEXT,
  "soTienHoan" DOUBLE PRECISION NOT NULL,
  "tienCocDaDong" DOUBLE PRECISION NOT NULL,
  "deltaHours" DOUBLE PRECISION NOT NULL,
  "tyLeHoanPhanTram" INTEGER NOT NULL,
  "chinhSachApDung" TEXT NOT NULL,
  "lyDo" TEXT NOT NULL,
  "trangThai" TEXT NOT NULL DEFAULT 'DANG_XU_LY',
  "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HoanCoc_pkey" PRIMARY KEY ("maDatPhong")
);
CREATE UNIQUE INDEX "HoanCoc_maGiaoDichHoan_key" ON "HoanCoc"("maGiaoDichHoan");
ALTER TABLE "HoanCoc" ADD CONSTRAINT "HoanCoc_maDatPhong_fkey" FOREIGN KEY ("maDatPhong") REFERENCES "DatPhong"("maDatPhong") ON DELETE RESTRICT ON UPDATE CASCADE;
