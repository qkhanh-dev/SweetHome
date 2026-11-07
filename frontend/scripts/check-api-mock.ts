import assert from "node:assert/strict";
import { apiClient, ApiError, setAccessToken } from "@/services/apiClient";
import {
  lamTronPhanTram,
  tinhGiaPhongChiTiet,
  tinhTienHoanCoc,
  tinhTienCoc,
  tinhTongHoaDon,
} from "@/mocks/businessRules";
import { resetMockState } from "@/mocks/mockAdapter";
import { TrangThaiDatPhong, TrangThaiPhong } from "@/types/sweethome";
import type { ApiResponse } from "@/types/sweethome";

function envelope<T>(response: ApiResponse<T>, status = 200): void {
  assert.deepEqual(Object.keys(response).sort(), [
    "data",
    "message",
    "statusCode",
    "success",
    "timestamp",
  ]);
  assert.equal(response.success, true);
  assert.equal(response.statusCode, status);
  assert.equal(typeof response.message, "string");
  assert.ok(Number.isFinite(Date.parse(response.timestamp)));
}

async function errorStatus(run: () => Promise<unknown>, status: number): Promise<ApiError> {
  let found: unknown;
  await assert.rejects(run, (error: unknown) => {
    found = error;
    return error instanceof ApiError && error.statusCode === status;
  });
  assert.ok(found instanceof ApiError);
  const payload = found.payload as Record<string, unknown>;
  assert.deepEqual(Object.keys(payload).sort(), [
    "details",
    "error",
    "message",
    "path",
    "statusCode",
    "success",
    "timestamp",
  ]);
  assert.equal(payload.success, false);
  assert.equal(payload.statusCode, status);
  assert.equal(payload.message, found.message);
  assert.deepEqual(payload.details, []);
  assert.equal(typeof payload.error, "string");
  assert.equal(typeof payload.path, "string");
  assert.ok(Number.isFinite(Date.parse(String(payload.timestamp))));
  return found;
}

function webhookPayload(maDatPhong: string, soTien: number) {
  return {
    maDatPhong,
    maGiaoDich: `PAY_${maDatPhong}`,
    soTien,
    trangThaiGiaoDich: "THANH_CONG",
  };
}

async function main(): Promise<void> {
  assert.equal(process.env.NEXT_PUBLIC_USE_MOCK, "true");
  resetMockState();
  setAccessToken(null);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Mock adapter không được gọi fetch tới Backend.");
  };

  try {
    const roomReadStart = performance.now();
    const rooms = await apiClient.getRooms();
    envelope(rooms);
    assert.ok(performance.now() - roomReadStart >= 195, "Mock phải chờ tối thiểu 200ms.");
    assert.deepEqual(
      rooms.data.map((room) => [room.maPhong, room.trangThai]),
      [
        ["P101", "DA_DAT"],
        ["P201", "CHO_DON_DEP"],
      ],
    );
    assert.equal(rooms.data.some((room) => "passwordHash" in room), false);
    const history = await apiClient.getMyHistory();
    envelope(history);
    assert.ok(history.data.length > 0);
    assert.ok(history.data.every((booking) => booking.maKH === "KH001"));

    const roomDetail = await apiClient.getRoomById("P201");
    envelope(roomDetail);
    assert.equal(roomDetail.data.maPhong, "P201");
    assert.equal(roomDetail.data.loaiPhong?.maLoaiPhong, "LP02");
    assert.ok(roomDetail.data.tienNghis?.some((item) => item.maTienNghi === "TN02"));
    assert.equal(roomDetail.data.homestay?.maHomestay, "HS01");
    await errorStatus(() => apiClient.getRoomById("__missing__"), 404);

    const roomType = await apiClient.getRoomTypeById("LP02");
    envelope(roomType);
    assert.equal(roomType.data.tenLoaiPhong, "Deluxe Mountain View");
    await errorStatus(() => apiClient.getRoomTypeById("__missing__"), 404);

    const selectedAvailability = await apiClient.getAvailableRooms({
      ngayNhan: "2026-11-12",
      ngayTra: "2026-11-15",
      soKhach: 2,
      tienNghiIds: ["TN01", "TN02"],
      maLoaiPhong: "LP02",
    });
    envelope(selectedAvailability);
    assert.equal(selectedAvailability.data.length, 1);
    assert.equal(selectedAvailability.data[0].maPhong, "P201");
    assert.deepEqual(
      [
        selectedAvailability.data[0].soDemLuuTru,
        selectedAvailability.data[0].soDemNgayThuong,
        selectedAvailability.data[0].soDemCuoiTuan,
        selectedAvailability.data[0].tongTienDuKien,
        selectedAvailability.data[0].tienCoc,
      ],
      [3, 1, 2, 2_800_000, 840_000],
    );
    assert.equal(
      (await apiClient.getAvailableRooms({
        ngayNhan: "2026-11-12",
        ngayTra: "2026-11-15",
        soKhach: 2,
        tienNghiIds: ["TN01", "TN03"],
        maLoaiPhong: "LP02",
      })).data.length,
      0,
    );
    assert.equal(
      (await apiClient.getAvailableRooms({
        ngayNhan: "2026-11-12",
        ngayTra: "2026-11-15",
        soKhach: 5,
      })).data.length,
      0,
    );
    await errorStatus(
      () => apiClient.getAvailableRooms({ ngayNhan: "2026-11-15", ngayTra: "2026-11-15", soKhach: 2 }),
      400,
    );

    const snapshot = await apiClient.getRoomById("P201");
    snapshot.data.tienNghis?.splice(0);
    assert.equal((await apiClient.getRoomById("P201")).data.tienNghis?.length, 2);

    const mockRoom = await apiClient.createRoom({
      soPhong: "909",
      tang: 9,
      maHomestay: "HS01",
      maLoaiPhong: "LP01",
      maTienNghis: ["TN01"],
    });
    envelope(mockRoom, 201);
    const newRoomId = mockRoom.data.maPhong;
    assert.equal(mockRoom.data.trangThai, "TRONG");
    assert.equal(mockRoom.data.loaiPhong?.maLoaiPhong, "LP01");
    assert.equal(mockRoom.data.tienNghis?.[0].maTienNghi, "TN01");
    assert.equal((await apiClient.getRooms({ tang: 9 })).data[0].maPhong, newRoomId);
    const updatedRoom = await apiClient.updateRoom(newRoomId, { tang: 10, maTienNghis: ["TN01", "TN02"] });
    envelope(updatedRoom);
    assert.equal(updatedRoom.data.tang, 10);
    assert.equal(updatedRoom.data.tienNghis?.length, 2);
    await apiClient.updateRoomStatus(newRoomId, TrangThaiPhong.BAO_TRI);
    assert.equal((await apiClient.getAvailableRooms({ ngayNhan: "2030-11-16", ngayTra: "2030-11-18", soKhach: 2 })).data.some((room) => room.maPhong === newRoomId), false);
    await apiClient.updateRoomStatus(newRoomId, TrangThaiPhong.TRONG);
    await errorStatus(() => apiClient.updateRoomStatus(newRoomId, TrangThaiPhong.DA_DAT), 400);
    const deletedRoom = await apiClient.deleteRoom(newRoomId);
    envelope(deletedRoom);
    assert.deepEqual(deletedRoom.data, { deleted: true, maPhong: newRoomId });

    await errorStatus(
      () => apiClient.createBooking({
        maPhong: "P101",
        ngayNhan: "2026-11-12",
        ngayTra: "2026-11-15",
        soKhach: 2,
        hoTen: "Overlap",
        soDienThoai: "0903333444",
        email: "overlap@example.test",
      }),
      409,
    );
    await errorStatus(
      () => apiClient.createBooking({
        maPhong: "P101",
        ngayNhan: "2030-11-16",
        ngayTra: "2030-11-18",
        soKhach: 3,
        hoTen: "Over capacity",
        soDienThoai: "0903333444",
        email: "over-capacity@example.test",
      }),
      400,
    );

    const bookingResponse = await apiClient.createBooking({
      maPhong: "P201",
      ngayNhan: "2030-11-16",
      ngayTra: "2030-11-18",
      soKhach: 2,
      hoTen: "Mock Guest",
      soDienThoai: "0903333444",
      email: "mock-guest@example.test",
      ghiChu: "Late arrival",
    });
    envelope(bookingResponse, 201);
    const booking = bookingResponse.data.datPhong;
    assert.equal(booking.trangThai, "CHO_COC");
    assert.equal(booking.khachHang?.soCCCD, null);
    assert.equal(booking.ghiChu, "Late arrival");
    assert.equal(bookingResponse.data.paymentQr.maDatPhong, booking.maDatPhong);
    assert.equal(bookingResponse.data.paymentQr.soTienCoc, Math.round(booking.tongTienDuKien * 0.3));
    assert.equal(new URL(bookingResponse.data.paymentQr.qrCodeUrl).searchParams.get("amount"), String(booking.tienCoc));
    assert.equal(new URL(bookingResponse.data.paymentQr.qrCodeUrl).searchParams.get("addInfo"), `SWEETHOME COC ${booking.maDatPhong}`);

    const unpaidRefundPreview = await apiClient.getRefundPreview(booking.maDatPhong);
    envelope(unpaidRefundPreview);
    assert.deepEqual(
      [unpaidRefundPreview.data.deltaHours, unpaidRefundPreview.data.tyLeHoanPhanTram, unpaidRefundPreview.data.soTienHoan],
      [0, 0, 0],
    );
    assert.equal(
      unpaidRefundPreview.data.chinhSachApDung,
      "Đơn chưa thanh toán tiền cọc (CHO_COC) - Hủy miễn phí, không phát sinh giao dịch hoàn tiền.",
    );

    const sameBooking = await apiClient.getBookingById(booking.maDatPhong);
    envelope(sameBooking);
    assert.equal(sameBooking.data.maDatPhong, booking.maDatPhong);
    assert.equal(sameBooking.data.khachHang?.email, "mock-guest@example.test");
    assert.equal((await apiClient.lookupBookings("0903333444")).data[0].maDatPhong, booking.maDatPhong);
    assert.equal((await apiClient.getBookings({ trangThai: TrangThaiDatPhong.CHO_COC, maPhong: "P201" })).data[0].maDatPhong, booking.maDatPhong);
    assert.equal((await apiClient.getBookings({ maPhong: "P101" })).data.every((item) => item.maPhong === "P101"), true);
    assert.equal((await apiClient.getPaymentQr(booking.maDatPhong)).data.maGiaoDich, `PAY_${booking.maDatPhong}`);
    await errorStatus(() => apiClient.getBookingById("__missing__"), 404);
    await errorStatus(() => apiClient.lookupBookings("not-a-phone-or-code").then((res) => {
      assert.equal(res.data.length, 0);
      return apiClient.getRefundPreview("__missing__");
    }), 404);

    await errorStatus(
      () => apiClient.triggerPaymentWebhook(webhookPayload(booking.maDatPhong, booking.tienCoc - 1), "wrong-amount"),
      400,
    );
    assert.equal((await apiClient.getBookingById(booking.maDatPhong)).data.trangThai, "CHO_COC");
    const paidDeposit = await apiClient.triggerPaymentWebhook(
      webhookPayload(booking.maDatPhong, booking.tienCoc),
      `idem-${booking.maDatPhong}`,
    );
    envelope(paidDeposit);
    assert.equal(paidDeposit.data.idempotentReplay, false);
    assert.equal(paidDeposit.data.datPhong.trangThai, "DA_XAC_NHAN");
    assert.equal(paidDeposit.data.phong.trangThai, "DA_DAT");
    const webhookReplay = await apiClient.triggerPaymentWebhook(
      webhookPayload(booking.maDatPhong, booking.tienCoc),
      `idem-${booking.maDatPhong}`,
    );
    envelope(webhookReplay);
    assert.equal(webhookReplay.data.idempotentReplay, true);

    const refund = await apiClient.getRefundPreview(booking.maDatPhong);
    envelope(refund);
    assert.equal(refund.data.tyLeHoanPhanTram, 100);
    assert.equal(refund.data.soTienHoan, booking.tienCoc);
    const cancelled = await apiClient.cancelBooking(booking.maDatPhong, "Đổi lịch");
    envelope(cancelled);
    assert.equal(cancelled.data.datPhong.trangThai, "DA_HUY");
    assert.equal(cancelled.data.datPhong.ghiChu, "Lý do hủy: Đổi lịch");
    assert.equal(cancelled.data.hoanCoc.tyLeHoanPhanTram, 100);
    assert.equal(cancelled.data.hoanCoc.soTienHoan, booking.tienCoc);
    assert.equal(cancelled.data.phong.trangThai, "TRONG");
    await errorStatus(() => apiClient.cancelBooking(booking.maDatPhong, "Lặp"), 400);

    const retryBookingResponse = await apiClient.createBooking({
      maPhong: "P201",
      ngayNhan: "2030-11-16",
      ngayTra: "2030-11-18",
      soKhach: 2,
      hoTen: "Second Guest",
      soDienThoai: "0903333666",
      email: "second-guest@example.test",
    });
    await errorStatus(
      () => apiClient.triggerPaymentWebhook(
        webhookPayload(retryBookingResponse.data.datPhong.maDatPhong, retryBookingResponse.data.datPhong.tienCoc),
        `idem-${booking.maDatPhong}`,
      ),
      409,
    );

    const checkedInBookingResponse = await apiClient.createBooking({
      maPhong: "P101",
      ngayNhan: "2030-11-16",
      ngayTra: "2030-11-18",
      soKhach: 2,
      hoTen: "Stay Guest",
      soDienThoai: "0903333777",
      email: "stay-guest@example.test",
    });
    const stayBooking = checkedInBookingResponse.data.datPhong;
    await apiClient.triggerPaymentWebhook(webhookPayload(stayBooking.maDatPhong, stayBooking.tienCoc));
    await errorStatus(() => apiClient.checkIn(stayBooking.maDatPhong, { soCCCD: "12" }), 400);
    const checkedIn = await apiClient.checkIn(stayBooking.maDatPhong, { soCCCD: "012345678901" });
    envelope(checkedIn);
    assert.equal(checkedIn.data.datPhong.trangThai, "DANG_LUU_TRU");
    assert.equal(checkedIn.data.datPhong.khachHang?.soCCCD, "012345678901");
    assert.equal((await apiClient.getRoomById("P101")).data.trangThai, "DANG_SU_DUNG");

    const initialStayServices = await apiClient.getStayServices(stayBooking.maDatPhong);
    envelope(initialStayServices);
    assert.equal(initialStayServices.data.tongTienDichVuTamTinh, 0);
    await errorStatus(() => apiClient.addStayService(stayBooking.maDatPhong, { maDichVu: "DV01", soLuong: 0 }), 400);
    await errorStatus(() => apiClient.addStayService(stayBooking.maDatPhong, { maDichVu: "__missing__", soLuong: 1 }), 404);
    const recorded = await apiClient.addStayService(stayBooking.maDatPhong, { maDichVu: "DV01", soLuong: 2 });
    envelope(recorded, 201);
    assert.equal(recorded.data.suDungDichVu.thanhTien, 500_000);
    assert.equal(recorded.data.tongTienDichVuTamTinh, 500_000);
    const removed = await apiClient.removeStayService(stayBooking.maDatPhong, recorded.data.suDungDichVu.maSuDung);
    envelope(removed);
    assert.deepEqual(removed.data, { deleted: true, maSuDung: recorded.data.suDungDichVu.maSuDung, tongTienDichVuTamTinh: 0 });
    const recordedAgain = await apiClient.addStayService(stayBooking.maDatPhong, { maDichVu: "DV01", soLuong: 2 });
    assert.equal(recordedAgain.data.tongTienDichVuTamTinh, 500_000);

    const invoice = await apiClient.createCheckOutInvoice(stayBooking.maDatPhong, {
      phuPhi: 100_000,
      phuongThuc: "CHUYEN_KHOAN_QR",
      ghiChuPhuPhi: "Trả phòng trễ",
    });
    envelope(invoice, 201);
    const expectedPrice = tinhGiaPhongChiTiet("2030-11-16", "2030-11-18", 500_000, 650_000).tongTienDuKien;
    assert.equal(invoice.data.tienPhong, expectedPrice);
    assert.equal(invoice.data.tienDichVu, 500_000);
    assert.equal(invoice.data.tienCocDaTra, tinhTienCoc(expectedPrice));
    assert.equal(invoice.data.tongCanThanhToan, expectedPrice + 500_000 + 100_000 - tinhTienCoc(expectedPrice));
    assert.equal(invoice.data.datPhong?.suDungDichVus?.length, 1);
    assert.equal((await apiClient.getInvoiceById(invoice.data.maHoaDon)).data.tongCanThanhToan, invoice.data.tongCanThanhToan);
    assert.equal((await apiClient.getInvoices()).data.some((item) => item.maHoaDon === invoice.data.maHoaDon), true);

    const payment = await apiClient.payInvoice(invoice.data.maHoaDon, { phuongThuc: "TIEN_MAT" });
    envelope(payment);
    assert.equal(payment.data.hoaDon.trangThai, "DA_THANH_TOAN");
    assert.equal(payment.data.datPhong.trangThai, "HOAN_TAT");
    assert.equal(payment.data.phong.trangThai, "CHO_DON_DEP");
    assert.equal(payment.data.pdfDownloadUrl, `/api/invoices/${invoice.data.maHoaDon}/pdf`);
    assert.equal(apiClient.getInvoicePdfUrl(invoice.data.maHoaDon), `http://localhost:3001/api/invoices/${invoice.data.maHoaDon}/pdf`);
    await errorStatus(() => apiClient.payInvoice(invoice.data.maHoaDon, { phuongThuc: "TIEN_MAT" }), 400);
    await errorStatus(() => apiClient.completeRoomCleaning("P101").then(() => apiClient.completeRoomCleaning("P101")), 400);
    assert.equal((await apiClient.getRoomById("P101")).data.trangThai, "TRONG");

    const review = await apiClient.createReview({ maDatPhong: stayBooking.maDatPhong, soSao: 5, noiDung: "Mock workflow review" });
    envelope(review, 201);
    assert.equal(review.data.phanHoiHost, null);
    await errorStatus(() => apiClient.createReview({ maDatPhong: stayBooking.maDatPhong, soSao: 5, noiDung: "Duplicate review" }), 409);
    const filteredReviews = await apiClient.getReviews({ maPhong: "P101", maLoaiPhong: "LP01", soSao: 5 });
    envelope(filteredReviews);
    assert.ok(filteredReviews.data.some((item) => item.maDanhGia === review.data.maDanhGia));
    const replied = await apiClient.replyReview(review.data.maDanhGia, "Cảm ơn bạn đã đánh giá.");
    envelope(replied);
    assert.equal((await apiClient.getReviews({ maPhong: "P101" })).data.find((item) => item.maDanhGia === review.data.maDanhGia)?.phanHoiHost, "Cảm ơn bạn đã đánh giá.");

    const invoiceDay = invoice.data.ngayLap.slice(0, 10);
    const revenue = await apiClient.getRevenueStats({ tuNgay: invoiceDay, denNgay: invoiceDay, groupBy: "day" });
    envelope(revenue);
    const paidOnReportDay = (await apiClient.getInvoices()).data.filter(
      (item) => item.trangThai === "DA_THANH_TOAN" && item.ngayLap.slice(0, 10) === invoiceDay,
    );
    assert.ok(paidOnReportDay.some((item) => item.maHoaDon === invoice.data.maHoaDon));
    assert.equal(revenue.data.tongHop.soHoaDonDaThanhToan, paidOnReportDay.length);
    assert.equal(revenue.data.tongHop.tongTienPhong, paidOnReportDay.reduce((sum, item) => sum + item.tienPhong, 0));
    assert.equal(revenue.data.tongHop.tongTienDichVu, paidOnReportDay.reduce((sum, item) => sum + item.tienDichVu, 0));
    assert.equal(revenue.data.tongHop.tongPhuPhi, paidOnReportDay.reduce((sum, item) => sum + item.phuPhi, 0));
    assert.equal(revenue.data.tongHop.tongDoanhThu, paidOnReportDay.reduce((sum, item) => sum + item.tienPhong + item.tienDichVu + item.phuPhi, 0));
    assert.equal(revenue.data.tongHop.tongTienCocDaThu, paidOnReportDay.reduce((sum, item) => sum + item.tienCocDaTra, 0));
    assert.equal(revenue.data.tongHop.tongThuKhiCheckOut, paidOnReportDay.reduce((sum, item) => sum + item.tongCanThanhToan, 0));
    assert.equal(revenue.data.chiTietTheoKy.reduce((sum, point) => sum + point.tongDoanhThu, 0), revenue.data.tongHop.tongDoanhThu);

    const occupancy = await apiClient.getOccupancyStats({ tuNgay: "2030-11-01", denNgay: "2030-11-30" });
    envelope(occupancy);
    assert.equal(occupancy.data.soNgayTrongKy, 30);
    assert.equal(occupancy.data.tongSoPhong, 2);
    assert.equal(occupancy.data.tongSoDemDaKhaiThac, 2);
    assert.equal(occupancy.data.tongSoDemKhaDung, 60);
    assert.equal(occupancy.data.tyLeLapDayToanHomestay, 3.33);
    assert.equal(occupancy.data.thongKeTrangThaiHienTai.TRONG, 2);

    const refundBoundaryDate = "2030-12-10";
    const checkInAt = new Date(`${refundBoundaryDate}T07:00:00.000Z`);
    const full = tinhTienHoanCoc(840_000, refundBoundaryDate, TrangThaiDatPhong.DA_XAC_NHAN, new Date(checkInAt.getTime() - 72 * 3_600_000));
    const half = tinhTienHoanCoc(840_000, refundBoundaryDate, TrangThaiDatPhong.DA_XAC_NHAN, new Date(checkInAt.getTime() - 24 * 3_600_000));
    const none = tinhTienHoanCoc(840_000, refundBoundaryDate, TrangThaiDatPhong.DA_XAC_NHAN, new Date(checkInAt.getTime() - 23 * 3_600_000 - 59 * 60_000));
    assert.deepEqual([full.tyLeHoanPhanTram, full.soTienHoan], [100, 840_000]);
    assert.deepEqual([half.tyLeHoanPhanTram, half.soTienHoan], [50, 420_000]);
    assert.deepEqual([none.tyLeHoanPhanTram, none.soTienHoan], [0, 0]);
    assert.equal(full.chinhSachApDung, "Hủy trước giờ nhận phòng >= 72 giờ (3 ngày): Hoàn 100% tiền cọc.");
    assert.equal(half.chinhSachApDung, "Hủy trước giờ nhận phòng từ 24 giờ đến dưới 72 giờ: Hoàn 50% tiền cọc.");
    assert.equal(none.chinhSachApDung, "Hủy sát giờ nhận phòng (< 24 giờ): Không hoàn tiền cọc (0%).");
    assert.deepEqual(
      tinhTienHoanCoc(840_000, refundBoundaryDate, TrangThaiDatPhong.CHO_COC, new Date(0)),
      {
        deltaHours: 0,
        tyLeHoanPhanTram: 0,
        soTienHoan: 0,
        chinhSachApDung: "Đơn chưa thanh toán tiền cọc (CHO_COC) - Hủy miễn phí, không phát sinh giao dịch hoàn tiền.",
      },
    );
    assert.equal(tinhTongHoaDon(2_800_000, 650_000, 100_000, 840_000), 2_710_000);
    assert.equal(lamTronPhanTram((1 / 3) * 100), 33.33);

    const initialInvoice = await apiClient.getInvoiceById("HD2026111501");
    assert.equal(initialInvoice.data.trangThai, "DA_THANH_TOAN");
    const initialBooking = await apiClient.getBookingById("DP2026110602");
    assert.equal(initialBooking.data.trangThai, "HOAN_TAT");
    assert.equal(initialBooking.data.hoaDon?.trangThai, "DA_THANH_TOAN");
    assert.equal(initialBooking.data.danhGia?.maDanhGia, "DG001");

    console.log("PASS mock endpoints, IDs, filters, relationships, state changes, pricing, refunds, invoice, idempotency and reports");
  } finally {
    globalThis.fetch = originalFetch;
    setAccessToken(null);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
