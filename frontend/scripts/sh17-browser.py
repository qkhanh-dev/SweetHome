"""SH-17 local mock smoke. Run with the webapp-testing with_server.py helper.

Separate role contexts retain separate auth cookies. Business mock storage is
explicitly copied between roles because the browser adapter has no shared DB.
Artifacts contain synthetic data only; never export cookies, tokens or CCCD.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("SH17_BASE_URL", "http://localhost:3017")
OUT = Path(".qa/sh17")
OUT.mkdir(parents=True, exist_ok=True)
KEY = "sweethome.mock.booking-state.v1"
BOOKING = "DP2026110601"
report = []

def record(case, **values):
    report.append({"case": case, "result": "PASS", **values})
    print(json.dumps(report[-1], ensure_ascii=False), flush=True)

def visit(page, path):
    page.goto(BASE + path)
    page.wait_for_load_state("networkidle")

def login(page, username, password):
    visit(page, "/login")
    page.get_by_label("Tên đăng nhập").fill(username)
    page.get_by_label("Mật khẩu", exact=True).fill(password)
    page.get_by_role("button", name="Đăng nhập", exact=True).click()
    page.wait_for_url(lambda u: "/login" not in u)
    page.wait_for_load_state("networkidle")

def get_state(page):
    return page.evaluate("key => localStorage.getItem(key)", KEY)

def set_state(page, state):
    page.evaluate("([key,value]) => localStorage.setItem(key,value)", [KEY, state])

def snapshot(page, name):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)

def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Horizontal page overflow"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    contexts = [browser.new_context(viewport={"width": 1365, "height": 900}) for _ in range(3)]
    staff, customer, admin = [c.new_page() for c in contexts]
    errors = []
    for page in [staff, customer, admin]:
        page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        login(staff, "staff_demo", "Staff@123")
        login(customer, "customer_demo", "Customer@123")
        login(admin, "admin_sweethome", "Admin@123")
        visit(staff, "/admin/reviews")
        expect(staff).to_have_url(BASE + "/staff/rooms")
        visit(customer, "/staff/check-in")
        expect(customer).to_have_url(BASE + "/")
        visit(customer, "/booking/DP2026110601")
        expect(customer.get_by_role("button", name="Gửi đánh giá", exact=True)).to_have_count(0)
        record("direct URL role guards; unfinished booking has no review form")

        visit(staff, "/staff/check-in")
        staff.get_by_label("Mã đơn hoặc số điện thoại").fill("0901234567")
        staff.get_by_role("button", name="Tra cứu", exact=True).click()
        expect(staff.get_by_role("button").filter(has_text="DP2026110601")).to_be_visible()
        expect(staff.get_by_role("button").filter(has_text="DP2026110602")).to_be_visible()
        staff.get_by_role("button").filter(has_text=BOOKING).click()
        staff.set_viewport_size({"width": 390, "height": 844}); no_overflow(staff); snapshot(staff, "00-check-in-form-mobile")
        staff.set_viewport_size({"width": 1365, "height": 900})
        staff.get_by_label("Số CCCD", exact=True).fill("123")
        staff.get_by_role("button", name="Xác nhận Check-in").click()
        expect(staff.locator(".sh17-error")).to_contain_text("9 hoặc 12")
        staff.get_by_label("Số CCCD", exact=True).fill("012345678901")
        staff.get_by_role("button", name="Xác nhận Check-in").dblclick()
        expect(staff.get_by_text("Đã nhận phòng thành công.")).to_be_visible()
        expect(staff.get_by_label("Số CCCD", exact=True)).to_have_count(0)
        state = json.loads(get_state(staff))
        b = next(x for x in state["bookings"] if x["maDatPhong"] == BOOKING)
        assert b["trangThai"] == "DANG_LUU_TRU"
        assert dict(state["roomStatuses"])["P101"] == "DANG_SU_DUNG"
        assert next(x for x in state["customers"] if x["maKH"] == b["maKH"])["soCCCD"] == "012345678901"
        staff.evaluate("() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; }")
        staff.get_by_role("button", name="In phiếu nhận phòng", exact=True).click()
        assert staff.evaluate("window.__printCalls") == 1
        staff.emulate_media(media="print")
        expect(staff.locator("aside")).to_be_hidden()
        snapshot(staff, "check-in-print-layout")
        staff.pdf(path=str(OUT / "check-in-print.pdf"), format="A4")
        staff.emulate_media(media="screen")
        snapshot(staff, "01-check-in-desktop")
        record("multiple phone matches; invalid/leading-zero 12-digit CCCD; check-in and print", booking=BOOKING, bookingState=b["trangThai"], roomState="DANG_SU_DUNG", deposit=840000)

        visit(staff, "/staff/services")
        staff.get_by_label("Phòng đang sử dụng / kỳ lưu trú").select_option(BOOKING)
        expect(staff.get_by_role("button", name="Ghi nhận dịch vụ")).to_be_visible()
        staff.get_by_label("Dịch vụ", exact=True).select_option("DV01")
        for value in ["0", "-1", "1.5"]:
            staff.get_by_label("Số lượng", exact=True).fill(value)
            staff.get_by_role("button", name="Ghi nhận dịch vụ").click()
            expect(staff.locator(".sh17-error")).to_contain_text("nguyên dương")
        staff.get_by_label("Số lượng", exact=True).fill("2")
        staff.get_by_role("button", name="Ghi nhận dịch vụ").dblclick()
        expect(staff.get_by_test_id("service-total")).to_contain_text("500.000")
        staff.get_by_label("Dịch vụ", exact=True).select_option("DV02")
        staff.get_by_label("Số lượng", exact=True).fill("1")
        staff.get_by_role("button", name="Ghi nhận dịch vụ").click()
        expect(staff.get_by_test_id("service-total")).to_contain_text("650.000")
        staff.reload(); staff.wait_for_load_state("networkidle")
        staff.get_by_label("Phòng đang sử dụng / kỳ lưu trú").select_option(BOOKING)
        expect(staff.get_by_test_id("service-total")).to_contain_text("650.000")
        record("service quantities and double click; history survives reload", serviceTotal=650000)
        snapshot(staff, "02-services-desktop")
        staff.set_viewport_size({"width": 390, "height": 844}); no_overflow(staff); snapshot(staff, "03-services-mobile")
        staff.set_viewport_size({"width": 1365, "height": 900})

        visit(staff, "/staff/check-out")
        staff.get_by_label("Kỳ lưu trú / mở lại hóa đơn").select_option("booking:" + BOOKING)
        staff.get_by_label("Phụ phí (VNĐ)").fill("100000")
        staff.get_by_role("button", name="Lập hóa đơn", exact=True).dblclick()
        expect(staff.get_by_test_id("invoice-money")).to_contain_text("2.710.000")
        state = json.loads(get_state(staff))
        invoices = [i for i in state["stayInvoices"] if i["maDatPhong"] == BOOKING]
        assert len(invoices) == 1
        invoice = invoices[0]
        assert invoice["tienCocDaTra"] == 840000
        assert invoice["tongCanThanhToan"] == 2800000 + 650000 + 100000 - 840000 == 2710000
        assert next(b for b in state["bookings"] if b["maDatPhong"] == BOOKING)["trangThai"] == "DANG_LUU_TRU"
        assert dict(state["roomStatuses"])["P101"] == "DANG_SU_DUNG"
        staff.reload(); staff.wait_for_load_state("networkidle")
        expect(staff.get_by_test_id("invoice")).to_contain_text(invoice["maHoaDon"])
        staff.get_by_role("button", name="Xác nhận thanh toán", exact=True).click()
        expect(staff.locator(".sh17-error")).to_contain_text("Chọn phương thức")
        staff.get_by_label("Phương thức thanh toán").select_option("TIEN_MAT")
        staff.get_by_role("button", name="Xác nhận thanh toán", exact=True).dblclick()
        expect(staff.get_by_role("button", name="In biên lai / Lưu thành PDF")).to_be_visible()
        state = json.loads(get_state(staff))
        paid = next(i for i in state["stayInvoices"] if i["maDatPhong"] == BOOKING)
        assert paid["trangThai"] == "DA_THANH_TOAN"
        assert next(b for b in state["bookings"] if b["maDatPhong"] == BOOKING)["trangThai"] == "HOAN_TAT"
        assert dict(state["roomStatuses"])["P101"] == "CHO_DON_DEP"
        staff.evaluate("() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; }")
        staff.get_by_role("button", name="In biên lai / Lưu thành PDF").click()
        assert staff.evaluate("window.__printCalls") == 1
        staff.emulate_media(media="print")
        expect(staff.locator("aside")).to_be_hidden()
        snapshot(staff, "invoice-print-layout")
        staff.pdf(path=str(OUT / "invoice-mock-print.pdf"), format="A4")
        staff.emulate_media(media="screen")
        snapshot(staff, "04-invoice-desktop")
        staff.set_viewport_size({"width": 390, "height": 844}); no_overflow(staff); snapshot(staff, "05-invoice-mobile")
        staff.set_viewport_size({"width": 1365, "height": 900})
        staff.reload(); staff.wait_for_load_state("networkidle")
        expect(staff.get_by_role("button", name="Xác nhận thanh toán", exact=True)).to_have_count(0)
        visit(staff, "/staff/rooms"); visit(staff, "/staff/check-out")
        staff.get_by_role("button", name="Hoàn tất dọn phòng 101", exact=True).click()
        expect(staff.get_by_role("status").filter(has_text="Phòng 101")).to_be_visible()
        assert dict(json.loads(get_state(staff))["roomStatuses"])["P101"] == "TRONG"
        record("invoice money; double create/pay; unpaid room retained; invoice reload; print; cleaning after navigation", invoice=invoice["maHoaDon"], room=2800000, services=650000, surcharge=100000, deposit=840000, total=2710000, bookingState="HOAN_TAT", roomState="TRONG")

        set_state(customer, get_state(staff))
        visit(customer, "/booking/" + BOOKING)
        expect(customer.get_by_role("button", name="Gửi đánh giá", exact=True)).to_be_visible()
        customer.evaluate("() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; }")
        customer.get_by_role("button", name="In phiếu xác nhận", exact=True).click()
        assert customer.evaluate("window.__printCalls") == 1
        customer.emulate_media(media="print")
        expect(customer.get_by_test_id("invoice")).to_be_hidden()
        expect(customer.get_by_role("heading", name="Đơn " + BOOKING, exact=True)).to_be_visible()
        customer.pdf(path=str(OUT / "booking-confirmation-print.pdf"), format="A4")
        customer.emulate_media(media="screen")
        expect(customer.get_by_test_id("invoice")).to_be_visible()
        record("SH10 confirmation print remains separate from invoice receipt")
        customer.set_viewport_size({"width": 390, "height": 844}); no_overflow(customer); snapshot(customer, "06-review-form-mobile")
        customer.set_viewport_size({"width": 1365, "height": 900})
        customer.get_by_role("radio", name="4 sao", exact=True).focus()
        customer.keyboard.press("Space")
        customer.get_by_label("Nhận xét", exact=True).fill("ok")
        customer.get_by_role("button", name="Gửi đánh giá", exact=True).click()
        expect(customer.locator(".sh17-error")).to_contain_text("5 ký tự")
        customer.get_by_label("Nhận xét", exact=True).fill("SH17: Phòng sạch, dịch vụ chu đáo.")
        customer.get_by_role("button", name="Gửi đánh giá", exact=True).dblclick()
        expect(customer.get_by_text("Cảm ơn bạn đã đánh giá.")).to_be_visible()
        customer.reload(); customer.wait_for_load_state("networkidle")
        expect(customer.get_by_role("button", name="Gửi đánh giá", exact=True)).to_have_count(0)
        snapshot(customer, "06-customer-review")
        set_state(admin, get_state(customer))
        visit(admin, "/admin/reviews")
        card = admin.get_by_test_id("review-" + BOOKING).locator("..")
        card.get_by_label("Nội dung phản hồi", exact=True).fill("SH17: Cảm ơn bạn, hẹn gặp lại!")
        card.get_by_role("button", name="Lưu phản hồi", exact=True).click()
        expect(card.get_by_text("SH17: Cảm ơn bạn, hẹn gặp lại!", exact=True)).to_be_visible()
        set_state(customer, get_state(admin))
        visit(customer, "/rooms/P101")
        expect(customer.get_by_test_id("review-" + BOOKING)).to_contain_text("SH17: Cảm ơn bạn, hẹn gặp lại!")
        customer.set_viewport_size({"width": 390, "height": 844}); no_overflow(customer); snapshot(customer, "07-room-reply-mobile")
        record("customer keyboard review; duplicate after reload; admin reply; public room response", stars=4)

        # Add synthetic independent stays to exercise two-room races and failure recovery.
        state = json.loads(get_state(staff))
        source = next(b for b in state["bookings"] if b["maDatPhong"] == BOOKING)
        edge_a = {**source, "maDatPhong": "SH17_EDGE_A", "maPhong": "P101", "trangThai": "DA_XAC_NHAN"}
        edge_b = {**source, "maDatPhong": "SH17_EDGE_B", "maPhong": "P201", "trangThai": "DANG_LUU_TRU"}
        state["bookings"].extend([edge_a, edge_b])
        state["roomStatuses"] = [[id, "DA_DAT" if id == "P101" else "DANG_SU_DUNG" if id == "P201" else status] for id, status in state["roomStatuses"]]
        set_state(staff, json.dumps(state))
        visit(staff, "/staff/check-in")
        staff.get_by_label("Mã đơn hoặc số điện thoại").fill("SH17_EDGE_A")
        staff.get_by_role("button", name="Tra cứu", exact=True).click()
        staff.get_by_role("button").filter(has_text="SH17_EDGE_A").click()
        staff.get_by_label("Số CCCD", exact=True).fill("012345678")
        staff.get_by_role("button", name="Xác nhận Check-in").click()
        expect(staff.get_by_text("Đã nhận phòng thành công.")).to_be_visible()
        record("9-digit leading-zero CCCD in browser")
        visit(staff, "/staff/services")
        select = staff.get_by_label("Phòng đang sử dụng / kỳ lưu trú")
        select.select_option("SH17_EDGE_A")
        select.select_option("SH17_EDGE_B")
        expect(staff.locator("caption")).to_contain_text("SH17_EDGE_B")
        expect(staff.get_by_test_id("service-total")).to_contain_text("0")
        select.select_option("SH17_EDGE_A")
        expect(staff.locator("caption")).to_contain_text("SH17_EDGE_A")
        staff.get_by_label("Dịch vụ", exact=True).select_option("DV03")
        staff.get_by_label("Số lượng", exact=True).fill("1")
        staff.get_by_role("button", name="Ghi nhận dịch vụ").click()
        select.select_option("SH17_EDGE_B")
        expect(staff.locator("caption")).to_contain_text("SH17_EDGE_B")
        expect(staff.locator("tbody tr")).to_have_count(0)
        select.select_option("SH17_EDGE_A")
        expect(staff.get_by_test_id("service-total")).to_contain_text("50.000")
        expect(staff.locator("tbody tr")).to_have_count(1)
        # Repeat A -> B -> A during a write: the final reread must not duplicate rows.
        staff.get_by_role("button", name="Ghi nhận dịch vụ").click()
        select.select_option("SH17_EDGE_B")
        select.select_option("SH17_EDGE_A")
        expect(staff.get_by_test_id("service-total")).to_contain_text("100.000")
        expect(staff.locator("tbody tr")).to_have_count(2)
        record("rapid room A/B reads and mutation; A/B/A write has no duplicate rows")

        visit(staff, "/staff/check-out")
        staff.get_by_label("Kỳ lưu trú / mở lại hóa đơn").select_option("booking:SH17_EDGE_A")
        staff.get_by_label("Phụ phí (VNĐ)").fill("0")
        staff.get_by_role("button", name="Lập hóa đơn", exact=True).click()
        expect(staff.get_by_test_id("invoice")).to_be_visible()
        state = json.loads(get_state(staff))
        edge_invoice = next(i for i in state["stayInvoices"] if i["maDatPhong"] == "SH17_EDGE_A")
        assert edge_invoice["phuPhi"] == 0
        # The invoice's actual deposit differs from the booking's expected 30%.
        edge_invoice["tienCocDaTra"] = 700000
        edge_invoice["tongCanThanhToan"] = edge_invoice["tienPhong"] + edge_invoice["tienDichVu"] + edge_invoice["phuPhi"] - 700000
        # Deliberate mock fault: invoice is unpaid, but its stay changed externally.
        next(b for b in state["bookings"] if b["maDatPhong"] == "SH17_EDGE_A")["trangThai"] = "DA_XAC_NHAN"
        set_state(staff, json.dumps(state))
        staff.reload(); staff.wait_for_load_state("networkidle")
        expect(staff.get_by_test_id("invoice-money")).to_contain_text("700.000")
        expect(staff.get_by_test_id("invoice-money")).to_contain_text("2.200.000")
        staff.get_by_label("Phương thức thanh toán").select_option("TIEN_MAT")
        staff.get_by_role("button", name="Xác nhận thanh toán", exact=True).click()
        expect(staff.locator(".sh17-error")).to_contain_text("không ở trạng thái đang lưu trú")
        expect(staff.get_by_label("Phương thức thanh toán")).to_have_value("TIEN_MAT")
        state = json.loads(get_state(staff))
        assert next(i for i in state["stayInvoices"] if i["maDatPhong"] == "SH17_EDGE_A")["trangThai"] == "CHUA_THANH_TOAN"
        assert next(b for b in state["bookings"] if b["maDatPhong"] == "SH17_EDGE_A")["trangThai"] != "HOAN_TAT"
        assert dict(state["roomStatuses"])["P101"] == "DANG_SU_DUNG"
        record("zero surcharge; invoice actual deposit differs from expected 30%; mock payment failure keeps stay/room and method input", actualDeposit=700000, expectedDeposit=840000, total=2200000)

        # A completed booking owned by another synthetic customer exposes no review/receipt actions.
        state = json.loads(get_state(customer))
        other = {**source, "maDatPhong": "SH17_OTHER", "maKH": "KH_SH17_OTHER", "trangThai": "HOAN_TAT"}
        state["bookings"].append(other)
        state["customers"].append({"maKH": "KH_SH17_OTHER", "hoTen": "Khách QA khác", "soDienThoai": "0900000017", "email": "other@example.test", "soCCCD": None})
        set_state(customer, json.dumps(state))
        visit(customer, "/booking/SH17_OTHER")
        expect(customer.get_by_role("button", name="Gửi đánh giá", exact=True)).to_have_count(0)
        expect(customer.get_by_role("button", name="In biên lai / Lưu thành PDF")).to_have_count(0)
        record("another customer's completed booking has no review/receipt action")
        assert not errors, errors
        (OUT / "results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    finally:
        for c in contexts: c.close()
        browser.close()
