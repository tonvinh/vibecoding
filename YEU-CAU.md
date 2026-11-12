# Đập Chuột — Yêu cầu

Mini game chạy trên trình duyệt. Một lượt chơi 10 giây, người chơi bấm vào chuột xuất hiện trên lưới 3×3 để ghi điểm.

## 1. Luật chơi

| # | Luật |
|---|------|
| L1 | Bảng chơi là lưới 3×3 = 9 ô (hang chuột). |
| L2 | Mỗi lượt kéo dài đúng **10 giây**, đếm ngược từ lúc bấm "Bắt đầu". |
| L3 | Tại mỗi thời điểm có **tối đa 1 con chuột** trên bảng. |
| L4 | Chuột hiện ở một ô ngẫu nhiên, ở lại **0,8 giây** rồi biến mất nếu không bị bấm. |
| L5 | Chuột mới xuất hiện sau **0,3 giây** kể từ khi chuột cũ biến mất hoặc bị đập. |
| L6 | Chuột mới không xuất hiện lại đúng ô vừa xong. |
| L7 | Bấm trúng ô đang có chuột → chuột bị đập, biến mất ngay. |
| L8 | Hết 10 giây → dừng lượt, chuột đang hiện biến mất, không nhận thêm thao tác bấm trên lưới. |
| L9 | Hỗ trợ cả chuột máy tính (click) và chạm (touch). |

## 2. Cách tính điểm

| Hành động | Điểm |
|-----------|------|
| Bấm trúng chuột | **+1** |
| Bấm ô trống | 0 (không trừ) |
| Để chuột tự biến mất | 0 |
| Bấm lại con chuột đã bị đập | 0 (mỗi con chỉ tính 1 lần) |

- Điểm bắt đầu mỗi lượt là 0.
- **Điểm cao nhất** lưu trên trình duyệt (localStorage), giữ lại khi tải lại trang. Không có máy chủ, không bảng xếp hạng.

## 3. Màn hình

| Màn hình | Nội dung | Thao tác |
|----------|----------|----------|
| **Bắt đầu** | Tên game, luật tóm tắt 1 dòng, điểm cao nhất | Nút "Bắt đầu" |
| **Đang chơi** | Lưới 3×3, điểm hiện tại, thời gian còn lại (giây) | Bấm vào ô |
| **Kết thúc** | Điểm lượt này, điểm cao nhất, thông báo "Kỷ lục mới!" nếu vượt | Nút "Chơi lại" |

Phản hồi trực quan khi chơi:

- Đập trúng: chuột đổi hình/hiệu ứng "bị đập" ngắn (~150 ms), điểm nhảy +1.
- 3 giây cuối: đồng hồ đổi màu đỏ.
- Bố cục vừa màn hình điện thoại (rộng 360 px) đến máy tính; ô vuông đủ lớn để bấm bằng ngón tay (≥ 80 px).

## 4. Tiêu chí hoàn thành

| # | Tiêu chí | Cách kiểm |
|---|----------|-----------|
| T1 | Mở file trên Chrome, Safari, Firefox bản mới đều chạy, không lỗi console | Mở từng trình duyệt |
| T2 | Lưới hiển thị đúng 9 ô, 3 hàng × 3 cột | Nhìn |
| T3 | Lượt kết thúc sau 10 giây (sai lệch ≤ 0,2 giây) | Bấm giờ ngoài |
| T4 | Bấm trúng chuột → +1; bấm ô trống → điểm không đổi | Chơi thử |
| T5 | Không bao giờ có 2 chuột cùng lúc; chuột không hiện lại cùng ô liên tiếp | Quan sát 3 lượt |
| T6 | Sau khi hết giờ, bấm lưới không làm đổi điểm | Bấm sau khi kết thúc |
| T7 | "Chơi lại" đưa điểm về 0, thời gian về 10 | Chơi 2 lượt liên tiếp |
| T8 | Điểm cao nhất cập nhật khi vượt kỷ lục và còn sau khi tải lại trang | Tải lại trang |
| T9 | Chơi được bằng cảm ứng trên điện thoại, không bị phóng to/cuộn khi bấm nhanh | Thử trên điện thoại |
| T10 | Chạy được không cần cài đặt hay máy chủ (mở file HTML trực tiếp) | Mở bằng `file://` |

## 5. Ngoài phạm vi

Âm thanh, nhiều cấp độ khó, chuột đặc biệt (cộng/trừ nhiều điểm), đăng nhập, bảng xếp hạng online.

## 6. Thông số đã chốt

| Mục | Giá trị |
|-----|-------------------|
| Thời gian chuột ở lại | 0,8 giây |
| Khoảng nghỉ giữa 2 chuột | 0,3 giây |
| Số chuột cùng lúc | 1 |
| Bấm trượt | Không trừ điểm |
| Lưu điểm cao nhất | Có, trên trình duyệt |
