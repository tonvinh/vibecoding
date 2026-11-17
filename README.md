# Vibecoding Game

Game chạy trên trình duyệt, mã nguồn nằm trong thư mục `app/`.

## Cấu trúc thư mục

| Thư mục / file | Nội dung |
|---|---|
| `app/` | Mã nguồn game (HTML, CSS, JavaScript) |
| `design/` | Design system (game dùng `design/tokens.css`) |
| `docs/` | Tài liệu dự án |
| `admin/` | Trang quản trị (danh sách người chơi), mở ở `/admin` |
| `server.js`, `src/` | Server Node.js: phục vụ file, API đăng ký và API admin |
| `docker-compose.yml` | Hai dịch vụ: `app` (server) và `db` (PostgreSQL, dữ liệu trong volume `db-data`) |
| `.env.example` | Mẫu file `.env` chứa mật khẩu admin và database |

## Cách chạy bằng Docker

Yêu cầu: đã cài [Docker Desktop](https://www.docker.com/products/docker-desktop/) (có sẵn Docker Compose) và Docker đang chạy.

Lần đầu, tạo file `.env` từ mẫu rồi đổi hai mật khẩu trong đó (file này không đưa lên git):

```bash
cp .env.example .env
```

Build và khởi động:

```bash
docker compose up -d --build
```

Mở trình duyệt tại <http://localhost:3000> để chơi (phải đăng ký họ tên, email, số điện thoại trước).
Trang quản trị ở <http://localhost:3000/admin>, đăng nhập bằng `ADMIN_USER` và `ADMIN_PASSWORD` trong `.env`.

Xem log:

```bash
docker compose logs -f app
```

Dừng:

```bash
docker compose down
```

Lưu ý:

- Mã nguồn được sao chép vào image lúc build. Sau khi sửa file trong `app/` hoặc `design/`, chạy lại `docker compose up -d --build` để thấy thay đổi.
- Nếu cổng 3000 đã có chương trình khác dùng, đổi số bên trái trong mục `ports` của `docker-compose.yml` (ví dụ `"8080:3000"`) rồi mở <http://localhost:8080>.
- `docker compose down` giữ nguyên dữ liệu người chơi. Chỉ `docker compose down -v` mới xoá volume database.
- Đổi `ADMIN_PASSWORD` trong `.env` thì chạy lại `docker compose up -d`. Mật khẩu database chỉ được áp dụng lúc tạo volume lần đầu.
- Thiếu `ADMIN_USER`/`ADMIN_PASSWORD`, hoặc mật khẩu ngắn hơn 8 ký tự: trang admin bị khoá, game vẫn chạy.
- Khi cho người ngoài truy cập, phải đặt server sau HTTPS.
