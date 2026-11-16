# Vibecoding Game

Game chạy trên trình duyệt, mã nguồn nằm trong thư mục `app/`.

## Cấu trúc thư mục

| Thư mục / file | Nội dung |
|---|---|
| `app/` | Mã nguồn game (HTML, CSS, JavaScript) |
| `design/` | Design system (game dùng `design/tokens.css`) |
| `docs/` | Tài liệu dự án |
| `server.js` | Server Node.js nhỏ phục vụ `app/` và `design/` |

## Cách chạy bằng Docker

Yêu cầu: đã cài [Docker Desktop](https://www.docker.com/products/docker-desktop/) (có sẵn Docker Compose) và Docker đang chạy.

Build và khởi động:

```bash
docker compose up -d --build
```

Mở trình duyệt tại <http://localhost:3000>.

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
- Hiện chỉ có một dịch vụ là `app`, chưa có database.
