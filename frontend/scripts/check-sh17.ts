import assert from "node:assert/strict";
import { apiClient, ApiError } from "../src/services/apiClient";
import { resetMockState } from "../src/mocks/mockAdapter";
import {
  cccdSchema,
  quantitySchema,
  surchargeSchema,
  reviewSchema,
  ownsBooking,
} from "../src/lib/sh17-validation";
import { withMockBrowserSession } from "./mock-browser-session";

async function rejects(run: () => Promise<unknown>, status: number) {
  await assert.rejects(
    run,
    (e: unknown) => e instanceof ApiError && e.statusCode === status,
  );
}
async function main() {
  for (const id of ["012345678", "012345678901"])
    assert.ok(cccdSchema.safeParse(id).success);
  for (const id of ["", "123", "01234567890a", " 012345678"])
    assert.ok(!cccdSchema.safeParse(id).success);
  for (const n of [0, -1, 1.5, NaN, Infinity])
    assert.ok(!quantitySchema.safeParse(n).success);
  assert.ok(surchargeSchema.safeParse(0).success);
  for (const n of [-1, 0.5, NaN])
    assert.ok(!surchargeSchema.safeParse(n).success);
  for (const n of [0, 6, 2.5])
    assert.ok(
      !reviewSchema.safeParse({ soSao: n, noiDung: "Đánh giá giả lập" })
        .success,
    );
  await withMockBrowserSession(async () => {
    resetMockState();
    await apiClient.login({
      username: "customer_demo",
      password: "Customer@123",
    });
    const customer = (await apiClient.getMe()).data;
    const profile = customer.khachHang!;
    const booking = (
      await apiClient.createBooking({
        maPhong: "P101",
        ngayNhan: "2035-01-01",
        ngayTra: "2035-01-03",
        soKhach: 2,
        maKH: profile.maKH,
        hoTen: profile.hoTen,
        soDienThoai: profile.soDienThoai,
        email: profile.email,
      })
    ).data.datPhong;
    assert.ok(ownsBooking(customer, booking));
    assert.ok(
      !ownsBooking(
        { ...customer, khachHang: { ...customer.khachHang!, maKH: "OTHER" } },
        booking,
      ),
    );
    const qr = (await apiClient.getPaymentQr(booking.maDatPhong)).data;
    await apiClient.triggerPaymentWebhook(
      {
        maDatPhong: booking.maDatPhong,
        maGiaoDich: qr.maGiaoDich,
        soTien: booking.tienCoc,
        trangThaiGiaoDich: "THANH_CONG",
      },
      qr.idempotencyKey,
    );
    await rejects(
      () => apiClient.checkIn(booking.maDatPhong, { soCCCD: "012345678" }),
      403,
    );
    await rejects(
      () =>
        apiClient.createReview({
          maDatPhong: booking.maDatPhong,
          soSao: 5,
          noiDung: "Chưa hoàn tất",
        }),
      400,
    );
    await apiClient.login({ username: "staff_demo", password: "Staff@123" });
    await rejects(
      () => apiClient.checkIn(booking.maDatPhong, { soCCCD: "12" }),
      400,
    );
    const checked = (
      await apiClient.checkIn(booking.maDatPhong, { soCCCD: "012345678" })
    ).data.datPhong;
    assert.equal(checked.trangThai, "DANG_LUU_TRU");
    assert.equal(checked.phong?.trangThai, "DANG_SU_DUNG");
    await rejects(
      () => apiClient.checkIn(booking.maDatPhong, { soCCCD: "012345678901" }),
      400,
    );
    for (const n of [0, -1, 1.5])
      await rejects(
        () =>
          apiClient.addStayService(booking.maDatPhong, {
            maDichVu: "DV01",
            soLuong: n,
          }),
        400,
      );
    const used = (
      await apiClient.addStayService(booking.maDatPhong, {
        maDichVu: "DV01",
        soLuong: 2,
      })
    ).data;
    assert.equal(used.suDungDichVu.thanhTien, 500000);
    await apiClient.updateService("DV01", { donGia: 300000 });
    const history = (await apiClient.getStayServices(booking.maDatPhong)).data;
    assert.equal(history.suDungDichVus[0].thanhTien, 500000);
    assert.equal(history.suDungDichVus[0].dichVu?.donGia, 250000);
    const zero = (
      await apiClient.createCheckOutInvoice(booking.maDatPhong, { phuPhi: 0 })
    ).data;
    assert.equal(zero.phuPhi, 0);
    assert.equal(
      (await apiClient.getBookingById(booking.maDatPhong)).data.trangThai,
      "DANG_LUU_TRU",
    );
    const invoice = (
      await apiClient.createCheckOutInvoice(booking.maDatPhong, {
        phuPhi: 100000,
      })
    ).data;
    assert.equal(invoice.maHoaDon, zero.maHoaDon);
    const expected = booking.tongTienDuKien + 500000 + 100000 - booking.tienCoc;
    assert.equal(invoice.tongCanThanhToan, expected);
    assert.equal(invoice.tienCocDaTra, booking.tienCoc);
    await rejects(
      () => apiClient.payInvoice(invoice.maHoaDon, { phuongThuc: "INVALID" }),
      400,
    );
    assert.equal(
      (await apiClient.getInvoiceById(invoice.maHoaDon)).data.trangThai,
      "CHUA_THANH_TOAN",
    );
    await rejects(() => apiClient.completeRoomCleaning("P101"), 400);
    const paid = (
      await apiClient.payInvoice(invoice.maHoaDon, { phuongThuc: "TIEN_MAT" })
    ).data;
    assert.equal(paid.hoaDon.trangThai, "DA_THANH_TOAN");
    assert.equal(paid.datPhong.trangThai, "HOAN_TAT");
    assert.equal(paid.phong.trangThai, "CHO_DON_DEP");
    await rejects(
      () => apiClient.payInvoice(invoice.maHoaDon, { phuongThuc: "TIEN_MAT" }),
      400,
    );
    assert.equal(
      (await apiClient.completeRoomCleaning("P101")).data.trangThai,
      "TRONG",
    );
    await rejects(() => apiClient.completeRoomCleaning("P101"), 400);
    await apiClient.login({
      username: "customer_demo",
      password: "Customer@123",
    });
    const review = (
      await apiClient.createReview({
        maDatPhong: booking.maDatPhong,
        soSao: 5,
        noiDung: "Trải nghiệm QA SH17 rất tốt",
      })
    ).data;
    await rejects(
      () =>
        apiClient.createReview({
          maDatPhong: booking.maDatPhong,
          soSao: 5,
          noiDung: "Đánh giá lần hai",
        }),
      409,
    );
    await apiClient.login({ username: "staff_demo", password: "Staff@123" });
    await rejects(
      () => apiClient.replyReview(review.maDanhGia, "Không có quyền"),
      403,
    );
    await apiClient.login({
      username: "admin_sweethome",
      password: "Admin@123",
    });
    await apiClient.replyReview(review.maDanhGia, "Cảm ơn khách QA SH17");
    const publicReview = (
      await apiClient.getReviews({ maPhong: "P101", soSao: 5 })
    ).data.find((r) => r.maDatPhong === booking.maDatPhong);
    assert.equal(publicReview?.phanHoiHost, "Cảm ơn khách QA SH17");
    await apiClient.register({
      username: "sh17_other",
      password: "Other@123",
      hoTen: "Khách QA khác",
      soDienThoai: "0900000017",
      email: "sh17-other@example.test",
    });
    await rejects(
      () =>
        apiClient.createReview({
          maDatPhong: booking.maDatPhong,
          soSao: 5,
          noiDung: "Không sở hữu đơn",
        }),
      403,
    );
    await rejects(() => apiClient.getInvoiceById(invoice.maHoaDon), 403);
    console.log(
      JSON.stringify({
        booking: booking.maDatPhong,
        invoice: invoice.maHoaDon,
        tienPhong: invoice.tienPhong,
        tienDichVu: invoice.tienDichVu,
        phuPhi: invoice.phuPhi,
        tienCocDaTra: invoice.tienCocDaTra,
        expected,
        actual: paid.hoaDon.tongCanThanhToan,
        bookingState: paid.datPhong.trangThai,
        roomState: "TRONG",
      }),
    );
  });
  console.log(
    "PASS SH-17: validation, ownership, workflow, historical prices, money, duplicate and role guards (mock).",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
