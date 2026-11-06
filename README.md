# SweetHome – Hệ Thống Quản Lý & Đặt Phòng Homestay Trực Tuyến (Phiên Bản Tinh Gọn v2)

> **Môn học:** Phân tích và Thiết kế Hướng Đối Tượng (OOAD)  
> **Giảng viên hướng dẫn:** Thầy Huỳnh Nguyễn Khắc Huy  
> **Kiến trúc:** Modular Monolith BCE (`Boundary – Control – Entity`) | Monorepo (`Next.js App Router` + `NestJS` + `Prisma ORM` + `PostgreSQL 16` + `Docker Compose`)

---

## 1. TÀI LIỆU KỸ THUẬT & QUY CHUẨN BẮT BUỘC (SINGLE SOURCE OF TRUTH)

Trước khi bắt đầu bất kỳ Task nào từ Tầng 2 (`SH-02` $\rightarrow$ `SH-28`), toàn bộ thành viên trong nhóm **bắt buộc đọc kỹ** bộ tài liệu nền tảng đã chốt tại thư mục [`docs/`](./docs):

1. **[`docs/DacTaChucNang_v2.md`](./docs/DacTaChucNang_v2.md):** Đặc tả chi tiết 3 Actors, 6 Phân hệ cốt lõi, 19–21 Use Cases, 11 Lớp thực thể, 3 Enums và 6 Kịch bản tuần tự (`SD01` – `SD06`).
2. **[`docs/API_CONTRACT_v1.md`](./docs/API_CONTRACT_v1.md):** Đặc tả đầy đủ **15 nhóm RESTful API** (URL, HTTP Method, Headers, Request DTO, Response JSON), mẫu chuẩn `schema.prisma`, `sweethome.ts` và chữ ký hàm `apiClient.ts` giữ nguyên **100% tên thuộc tính** của `ClassDiagram_v2.xml`.
3. **[`docs/BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md):** Quy định chốt cứng **3 Enum trạng thái** (`TrangThaiPhong`, `TrangThaiDatPhong`, `TrangThaiHoaDon`), **4 công thức tính toán tài chính cốt lõi**, quy tắc chống đặt trùng phòng (`Anti-Double-Booking`), `Idempotency-Key` cho Webhook và ma trận phân quyền RBAC 3 vai trò.
4. **Bộ 3 Sơ đồ Thiết kế UML v2 (Draw.io XML tại [`docs/diagrams/ver2/`](./docs/diagrams/ver2)):**
   - [`ClassDiagram_v2.xml`](./docs/diagrams/ver2/ClassDiagram_v2.xml) *(11 Lớp thực thể & 3 Enums)*
   - [`Usecase_v2_diagram.xml`](./docs/diagrams/ver2/Usecase_v2_diagram.xml) *(3 Actors & 6 Phân hệ chức năng)*
   - [`Sequence_Diagrams_v2.xml`](./docs/diagrams/ver2/Sequence_Diagrams_v2.xml) *(7 Tabs: Tổng hợp & Chi tiết `SD01` – `SD06` chuẩn BCE)*

---

## 2. CẤU TRÚC THƯ MỤC MONOREPO

```text
SweetHome/
├── backend/                        # Mã nguồn Backend (NestJS Modular Monolith + Prisma ORM)
│   ├── prisma/                     # schema.prisma, migrations/ & seed.ts (SH-02, SH-03)
│   └── src/
│       ├── common/                 # Guards (JwtAuthGuard, RolesGuard), Filters, Interceptors
│       └── modules/                # 6 Modules ánh xạ trực tiếp từ 6 Phân hệ & <<control>>:
│           ├── homestay-rooms/     # PH1: Homestay, LoaiPhong, TienNghi, Phong (SH-07)
│           ├── booking/            # PH2: BookingController, PaymentGatewayService (SD01, SD02 - SH-08)
│           ├── stay-operations/    # PH3: StayController, ServiceController (SD03, SD04 - SH-15)
│           ├── billing-payment/    # PH4: PaymentController, PDFKit Receipt (SD05 - SH-16)
│           ├── reviews/            # PH5: ReviewController (SD06 - SH-15)
│           └── reports-admin/      # PH6: Auth, Users, Revenue & Occupancy Reports (SH-07, SH-14, SH-15)
├── frontend/                       # Mã nguồn Frontend (Next.js App Router + Tailwind CSS + shadcn/ui)
│   └── src/
│       ├── app/                    # Route Groups theo 3 Actors (Các lớp <<boundary>>):
│       │   ├── (guest)/            # :BookingUI, :ReviewUI (SH-09, SH-10, SH-17)
│       │   ├── (staff)/            # :CheckInUI, :ServiceUI, :CheckOutUI, RoomGrid (SH-09, SH-17)
│       │   └── (admin)/            # Quản trị Phòng/Giá, Dịch vụ, Tài khoản, Dashboard Recharts (SH-09, SH-18)
│       ├── types/
│       │   └── sweethome.ts        # 11 Interfaces & 3 Enums chuẩn ClassDiagram_v2.xml (SH-05)
│       ├── mocks/
│       │   └── mockData.ts         # Dữ liệu giả lập khớp 100% API_CONTRACT_v1.md (SH-05)
│       └── services/
│           └── apiClient.ts        # Bộ chuyển mạch tự động Mock / Real API qua NEXT_PUBLIC_USE_MOCK
├── docs/                           # Tài liệu Đặc tả, API Contract, Business Rules & Sơ đồ UML
│   ├── API_CONTRACT_v1.md          # Hợp đồng giao tiếp 15 nhóm RESTful API (v1.0)
│   ├── BUSINESS_RULES.md           # Quy chuẩn 3 Enums & 4 Công thức tính toán cốt lõi
│   ├── DacTaChucNang_v2.md         # Đặc tả chức năng phiên bản tinh gọn v2
│   └── diagrams/ver2/              # Bộ 3 file Draw.io XML chuẩn v2
├── docker-compose.yml              # Khởi tạo PostgreSQL 16 (5432), Backend (3001), Frontend (3000)
├── .env.example                    # Mẫu biến môi trường chuẩn cho toàn Monorepo
├── .gitignore                      # Cấu hình loại trừ file rác, build, node_modules, .env
└── README.md                       # Hướng dẫn cài đặt, quy ước nhánh & quy trình làm việc
```

---

## 3. YÊU CẦU MÔI TRƯỜNG & HƯỚNG DẪN CÀI ĐẶT (SETUP GUIDE)

### 3.1. Công cụ bắt buộc cài đặt
1. **Node.js v20 LTS** (Khuyến nghị `v20.11.0+`, kiểm tra bằng `node -v` và `npm -v`).
   - Tải tại: https://nodejs.org/en/download (Chọn bản **LTS 20.x**) hoặc cài qua `nvm`:
     ```bash
     nvm install 20
     nvm use 20
     ```
2. **Docker Desktop** (Tích hợp sẵn `docker compose` v2 để chạy PostgreSQL 16 tại cổng `5432`).
3. **Git** & trình soạn thảo **VS Code** (Khuyến nghị cài extension: *Prisma*, *ESLint*, *Prettier*, *Draw.io Integration*).

### 3.2. Các bước khởi chạy dự án lần đầu

#### Bước 1: Clone kho mã nguồn & chuyển sang nhánh `dev`
```bash
git clone https://github.com/qkhanh-dev/SweetHome.git
cd SweetHome
git checkout dev
```

#### Bước 2: Thiết lập biến môi trường (`.env`)
Sao chép file [`.env.example`](./.env.example) thành `.env` ở thư mục gốc (và trong `backend/.env`, `frontend/.env.local` khi khởi tạo):
```bash
cp .env.example .env
```
Các biến môi trường quan trọng trong `.env`:
- `DATABASE_URL="postgresql://sweethome_user:sweethome_secret_2026@localhost:5432/sweethome_db?schema=public"`
- `JWT_SECRET="sweethome_super_secret_jwt_key_2026_v2_ooad"`
- `DEPOSIT_RATE=0.3` *(Tỷ lệ tiền đặt cọc giữ chỗ 30%)*
- `NEXT_PUBLIC_API_URL="http://localhost:3001/api"`
- `NEXT_PUBLIC_USE_MOCK=true` *(Đặt `true` khi code giao diện độc lập ở Tầng 2–6; đổi sang `false` khi nối API thật ở Tầng 7–8)*

#### Bước 3: Khởi chạy Database PostgreSQL 16 bằng Docker (`SH-02`, `SH-03`)
```bash
docker compose up -d postgres
```
Sau khi container `sweethome-postgres` báo `healthy` tại cổng `5432`:
```bash
cd backend
npm install
npx prisma migrate dev --name init_sweethome_v2
npx prisma db seed
```

#### Bước 4: Khởi chạy Backend NestJS (`SH-04`) & Frontend Next.js (`SH-05`)
- **Chạy Backend (Cổng `3001`):**
  ```bash
  cd backend
  npm run start:dev
  # Swagger UI: http://localhost:3001/api/docs
  ```
- **Chạy Frontend (Cổng `3000`):**
  ```bash
  cd frontend
  npm install
  npm run dev
  # Web App: http://localhost:3000
  ```

#### Bước 5: Chạy toàn bộ hệ thống bằng 1 lệnh Docker Compose (`SH-21`, `SH-27`)
```bash
docker compose --profile fullstack up --build -d
```

---

## 4. QUY ƯỚC PHÂN NHÁNH GIT (BRANCHING STRATEGY) & COMMIT

### 4.1. Cấu trúc nhánh bảo vệ (Protected Branches)
- **`main`**: Nhánh sản phẩm ổn định cuối cùng (Production / Release nộp bài ở `SH-28`). **Tuyệt đối không push trực tiếp lên `main`**.
- **`dev`**: Nhánh tích hợp trung tâm của cả nhóm (Integration branch). Mọi nhánh tính năng sau khi hoàn thành Pre-QA Checklist sẽ tạo Pull Request (PR) hợp nhất vào `dev`.

### 4.2. Quy ước đặt tên nhánh theo Mã Task Jira (`SH-01` $\rightarrow$ `SH-28`)
Mỗi thành viên khi bắt đầu một Task trong bảng phân công **bắt buộc tách nhánh mới từ `dev`** theo cú pháp:
```text
feat/SH-<số-thứ-tự>-<mô-tả-ngắn-gọn-kebab-case>
fix/SH-<số-thứ-tự>-<mô-tả-lỗi-kebab-case>
docs/SH-<số-thứ-tự>-<mô-tả-tài-liệu>
```
**Ví dụ chuẩn:**
- `feat/SH-02-prisma-schema-migration` *(Huy làm Database)*
- `feat/SH-04-nestjs-scaffold-swagger` *(Khang dựng khung Backend)*
- `feat/SH-05-nextjs-scaffold-mock-adapter` *(Hoàng dựng khung Frontend)*
- `feat/SH-07-be-auth-and-rooms-crud` *(Thụy code Backend PH1 & PH6)*
- `feat/SH-08-be-booking-qr-cancel` *(Khang code Backend SD01 & SD02)*
- `feat/SH-09-fe-search-and-admin-rooms` *(Hoàng code Frontend tìm phòng & quản trị phòng)*
- `feat/SH-10-fe-booking-qr-cancel-auth` *(Khánh code Frontend đặt/hủy phòng & Auth)*

**Quy trình thao tác Git tiêu chuẩn cho từng Task:**
```bash
# 1. Luôn kéo code mới nhất từ nhánh dev về trước khi tạo nhánh
git checkout dev
git pull origin dev

# 2. Tạo nhánh mới theo mã Task được giao
git checkout -b feat/SH-08-be-booking-qr-cancel

# 3. Code, tự kiểm tra theo Pre-QA Checklist của Task và commit
git add .
git commit -m "feat(SH-08): implement online booking, VietQR deposit webhook and auto refund"

# 4. Đẩy nhánh lên GitHub và tạo Pull Request vào nhánh dev
git push -u origin feat/SH-08-be-booking-qr-cancel
```

### 4.3. Quy ước thông điệp Commit (Conventional Commits)
Mọi commit phải gắn kèm mã Task `(SH-xx)` để dễ dàng truy vết lịch sử:
- `feat(SH-xx): <mô tả tính năng mới>`
- `fix(SH-xx): <mô tả sửa lỗi sau khi QA test>`
- `docs(SH-xx): <cập nhật tài liệu kỹ thuật / báo cáo>`
- `refactor(SH-xx): <tối ưu hóa code không làm đổi API Contract>`
- `test(SH-xx): <bổ sung kịch bản kiểm thử / Postman collection>`
- `chore(SH-xx): <cập nhật cấu hình Docker, package.json>`

---

## 5. BẢNG PHÂN CÔNG VAI TRÒ NHÓM (6 THÀNH VIÊN – 28 JIRA TASKS)

| Thành viên | Vai trò chính | Các Task phụ trách chính (`SH-01` – `SH-28`) |
| :--- | :--- | :--- |
| **Khánh** | Team Lead / Frontend / Lead QA / Chủ biên Báo cáo | `SH-01`, `SH-10`, `SH-11` (QA), `SH-18`, `SH-19` (QA), `SH-25`, `SH-27` (E2E QA), `SH-28` |
| **Hoàng** | Frontend Developer | `SH-05`, `SH-09`, `SH-17`, `SH-24` |
| **Khang** | Backend Developer (Core Booking & Billing) | `SH-04`, `SH-08` (`SD01`, `SD02`), `SH-16` (`SD05` & PDF), `SH-22` |
| **Thụy** | Backend Developer (Auth, Rooms, Stay Ops & Review) & DB Reviewer | `SH-07` (`PH1`, `UC6.3`), `SH-15` (`SD03`, `SD04`, `SD06`, `PH6`), `SH-23` + Check DB (`SH-02`, `SH-03`, `SH-14`) |
| **Huy** | Database & DevOps Engineer | `SH-02` (Prisma Schema), `SH-03` (Seed & Index), `SH-14` (SQL/Prisma Report Queries), `SH-21` (Docker Compose) |
| **Lập** | QA Tester (Tiêu chuẩn) & Tổng hợp Báo cáo | `SH-06` (Báo cáo Mục 1–3), `SH-12` (QA), `SH-13` (Báo cáo Mục 4–5), `SH-20` (QA), `SH-26` (Báo cáo Mục 6–7) |
