# Bible Quiz - Hướng dẫn Setup Sprint 1

## Tổng quan Sprint 1
Sprint 1 đã hoàn thành các tính năng cơ bản:
- ✅ Database schema với MySQL + Flyway migrations
- ✅ JPA entities và repositories
- ✅ Authentication system với OAuth2 (Google/Facebook) và JWT
- ✅ Basic REST APIs cho auth, books, questions
- ✅ React frontend với Vite + TypeScript
- ✅ Docker Compose cho local development

## Yêu cầu hệ thống
- Java 17+
- Node.js 18+
- Docker & Docker Compose
- MySQL 8.0
- Redis 7

## Cài đặt và chạy

### 1. Cấu hình environment variables

Dự án có 3 file `.env` (tất cả đều gitignored):

#### 1.1. `apps/api/.env` — Backend
Spring Boot đọc file này qua `spring-dotenv`. **Bắt buộc cho Mode 1** (BE chạy native bằng `./mvnw`). Mode 2/3 vẫn nên có file này để tiện switch giữa các mode.
```bash
# OAuth2 — tạo tại https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-secret
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com

# AI question generator (admin feature) — tạo tại https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...

# Stitch design MCP (chỉ cần khi sync design từ Stitch)
STITCH_API_KEY=AIzaSy...
```

> Trong Google Cloud Console, thêm redirect URI `http://localhost:8080/login/oauth2/code/google`
> cho dev local. Cùng redirect URI này dùng cho cả 3 mode (api luôn bind port 8080).

#### 1.2. `apps/web/.env.local` — Frontend (tùy chọn)
Overrides cho dev local. Mặc định `apps/web/.env` đã set đủ để chạy với backend `localhost:8080`. Chỉ tạo `.env.local` khi muốn override.
```bash
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
```

> `apps/web/.env.production` có `VITE_API_BASE_URL=` (empty) → frontend gọi same-origin
> (nginx proxy xử lý routing sang api). KHÔNG sửa file này trừ khi biết rõ.

#### 1.3. Root `.env` — chỉ cần khi chạy `docker compose` (Mode 2 + Mode 3)
Docker Compose đọc file này để substitute `${GOOGLE_CLIENT_ID}` / `${GOOGLE_CLIENT_SECRET}` trong [compose.yml](compose.yml).
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-secret
```

#### 1.4. OAuth2 providers
| Provider | Console | Redirect URI dev local |
|----------|---------|------------------------|
| Google | https://console.cloud.google.com/ | `http://localhost:8080/login/oauth2/code/google` |
| Facebook (optional) | https://developers.facebook.com/ | `http://localhost:8080/login/oauth2/code/facebook` |

### 2. Chạy app — chọn 1 trong 3 mode

Pick mode nào tùy mục đích đang code:

| Mode | FE | BE | MySQL/Redis | URL truy cập | Hot-reload | Khi nào dùng |
|------|----|----|-------------|---------------|-------------|--------------|
| **1** | command | command | docker | http://localhost:5173 | FE + BE | Sửa cả FE lẫn BE, cần reload tức thì |
| **2** | docker | docker | docker | http://localhost:3000 | KHÔNG | Test prod build (nginx + jar), trước khi release |
| **3** | command | docker | docker | http://localhost:5173 | FE only | Chỉ sửa FE, không muốn build BE local |

Sau khi `docker compose up` lần đầu, các container giữ trạng thái — lần sau chỉ cần `up -d` thay vì `up --build`.

#### Mode 1 — Native FE + Native BE (chỉ MySQL/Redis docker)

```bash
# Terminal A: bật infra
docker compose up -d mysql redis

# Terminal B: backend
cd apps/api
./mvnw clean install        # lần đầu hoặc khi pom.xml đổi
./mvnw spring-boot:run      # API tại http://localhost:8080

# Terminal C: frontend
cd apps/web
npm install                 # lần đầu hoặc khi package.json đổi
npm run dev                 # Frontend tại http://localhost:5173
```

OAuth Google sẽ redirect về `http://localhost:5173/auth/callback?...` (default `app.frontend-url` của Spring profile dev). Mở `http://localhost:5173` để bắt đầu.

#### Mode 2 — Full Docker (FE + BE + MySQL + Redis container)

```bash
docker compose up -d        # build + start cả 4 service
# - FE (nginx + built SPA): http://localhost:3000
# - API (jar):              http://localhost:8080
# - MySQL:                  localhost:3307
# - Redis:                  localhost:6379

# Sau khi sửa code, rebuild image rồi restart:
docker compose up -d --build api web
```

Mode này KHÔNG có hot-reload — sửa code phải `--build` lại. Dùng để verify production build trước khi merge / deploy.

#### Mode 3 — Hybrid: Native FE + Docker BE/MySQL/Redis

```bash
# Terminal A: backend stack trong docker (skip web container)
docker compose -f compose.yml -f compose.local-fe.yml up -d api mysql redis

# Terminal B: frontend native
cd apps/web && npm run dev
# Frontend tại http://localhost:5173
```

Override file [`compose.local-fe.yml`](compose.local-fe.yml) flip `APP_FRONTEND_URL` của api container sang `http://localhost:5173` để OAuth redirect đúng. CORS đã include 5173 sẵn trong base [compose.yml](compose.yml).

Switch về Mode 2 (full docker): bỏ `-f compose.local-fe.yml` và start lại `web` container:
```bash
docker compose up -d web
```

### 3. Chạy Playwright E2E tests
```bash
cd apps/web

# Lần đầu: cài browsers (Chromium, ~170MB)
npx playwright install chromium

# Chạy tất cả e2e tests (headless) — target mặc định http://localhost:5173
# Playwright tự khởi động dev server ở :5173 (reuseExistingServer=true nên
# sẽ dùng lại nếu bạn đã chạy `npm run dev`). Backend :8080 + MySQL + Redis
# phải up sẵn trước khi chạy.
npm run test:e2e

# Chạy e2e trên server khác (docker compose, staging, …)
# Set PLAYWRIGHT_BASE_URL — khi URL ≠ :5173, Playwright KHÔNG tự bật dev server,
# bạn chịu trách nhiệm server đó đang chạy.
#
# PowerShell:
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"; npm run test:e2e
# Git Bash / Linux / macOS:
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
# Staging:
PLAYWRIGHT_BASE_URL=https://staging.example.com npm run test:e2e
```

#### Target frontend + API riêng (dev dual-port, proxy đặc biệt)
Mặc định `global-setup.ts` suy ra API URL từ `PLAYWRIGHT_BASE_URL`:
- `PLAYWRIGHT_BASE_URL=http://localhost:5173` → API = `http://localhost:8080` (dev default)
- URL khác → API = cùng origin với frontend (giả định same-origin proxy như docker/staging)

Override bằng `PLAYWRIGHT_API_URL` nếu setup đặc biệt:
```bash
# Ví dụ: frontend trên :3000 nhưng API gọi thẳng :8080 (không proxy)
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
PLAYWRIGHT_API_URL=http://localhost:8080 \
  npm run test:e2e

# Chạy với browser UI hiển thị (debug)
npm run test:e2e:headed

# Chỉ một suite
npx playwright test tests/e2e/smoke/
npx playwright test tests/e2e/happy-path/

# Chỉ một file
npx playwright test tests/e2e/smoke/web-user/W-M01-auth.spec.ts

# Chạy theo tên test (grep)
npx playwright test -g "login successful"

# Debug từng bước (pause + inspector)
npx playwright test --debug

# Xem HTML report sau khi chạy xong
npm run test:e2e:report
```

## Kiểm tra tính năng

### 1. API Endpoints
- `GET /books` - Danh sách sách Kinh Thánh
- `GET /questions` - Danh sách câu hỏi (có filter)
- `GET /auth/me` - Thông tin user hiện tại
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Đăng xuất

### 2. Frontend Features
- Trang đăng nhập với Google/Facebook OAuth2
- Trang chủ với các chế độ chơi
- Navigation và authentication state management
- Responsive UI với Tailwind CSS

### 3. Database
- Tự động tạo database `biblequiz`
- Chạy Flyway migrations để tạo tables
- Seed data với 66 sách Kinh Thánh và 5 câu hỏi mẫu

## Cấu trúc dự án

```
biblequize/
├── apps/
│   ├── api/                 # Spring Boot Backend
│   │   ├── src/main/java/com/biblequiz/
│   │   │   ├── entity/      # JPA Entities
│   │   │   ├── repository/  # JPA Repositories
│   │   │   ├── service/     # Business Logic
│   │   │   ├── controller/  # REST Controllers
│   │   │   ├── auth/        # Authentication
│   │   │   └── config/      # Configuration
│   │   └── src/main/resources/
│   │       ├── application.yml
│   │       └── db/migration/ # Flyway migrations
│   └── web/                 # React Frontend
│       ├── src/
│       │   ├── components/  # UI Components
│       │   ├── pages/       # Page Components
│       │   ├── store/       # State Management
│       │   ├── api/         # API Client
│       │   └── styles/      # CSS Styles
│       └── package.json
├── compose.yml              # Docker Compose
└── README.md
```

## Troubleshooting

### Lỗi kết nối database
```bash
# Kiểm tra MySQL container
docker compose logs mysql

# Restart MySQL
docker compose restart mysql
```

### Lỗi OAuth2
- Kiểm tra redirect URI trong Google/Facebook console
- Đảm bảo client ID và secret đúng
- Kiểm tra CORS configuration

### Lỗi frontend
```bash
# Clear node_modules và reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
npm run dev -- --force
```

## Account Admin
Bước 1 — Tạo tài khoản:
```
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@biblequiz.com","password":"Admin@1234"}'

```
Bước 2 — Promote lên ADMIN:
```
curl -X POST http://localhost:8080/api/me/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@biblequiz.com"}'

```
## Liên hệ
Nếu gặp vấn đề, vui lòng tạo issue trên GitHub repository.
