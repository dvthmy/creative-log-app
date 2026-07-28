# Creative Experiment Log

Công cụ nội bộ theo dõi các thực nghiệm tạo creative bằng AI (video/ảnh) cho 2 app **BookWise** và **Soulie**. Mỗi thực nghiệm là 1 dòng: visual style đang test, tool AI dùng, ảnh/video reference, kết quả tool tạo ra, nhận xét — cộng thêm dashboard tổng hợp số liệu và bảng "Experiment Plan" theo dõi tiến độ.

Team dùng chung 1 URL, mọi chỉnh sửa (thêm dòng, sửa nhận xét, upload ảnh/video, xoá) lưu ngay trên server và **mọi người đều thấy** — không còn lưu riêng từng máy như bản gốc.

Repo: https://github.com/dvthmy/creative-log-app
Đang chạy tại: https://creative-log-app.replit.app

## Tính năng chính

- Dashboard tổng hợp: số lượng creative đã sản xuất, chia theo app/loại (video/ảnh)
- Bảng "Experiment Plan" — theo dõi visual style nào đã test, số lượng, đợt nào
- Mỗi dòng thực nghiệm (BookWise/Soulie, theo đợt ngày trong tháng): mô tả input, ảnh/video reference, kết quả tool, nhận xét — tất cả sửa trực tiếp trên trang (contenteditable)
- Thêm ảnh/video bằng cách: dán link Google Drive, upload file thật từ máy, dán từ clipboard (Ctrl+V), hoặc kéo-thả file
- Xoá được cả từng ảnh/video và cả 1 dòng thực nghiệm
- Ghi chú "Điểm mạnh / Cần cải thiện" theo từng đợt

## Nguồn gốc

Bắt đầu từ 1 file HTML tĩnh (`creative-experiment-log-2026-07-28-v3.html`, ở thư mục cha) — chạy hoàn toàn trong trình duyệt, lưu dữ liệu bằng IndexedDB cục bộ trên từng máy. Dự án này port lại thành app có backend (Node.js + Express + SQLite) để dữ liệu dùng chung được giữa nhiều người, deploy trên Replit.

## Stack

Node.js + Express + SQLite (`better-sqlite3`) + lưu file media trên disk (`uploads/`). Frontend vanilla JS/HTML/CSS, không build step, không framework. Chi tiết kiến trúc/data model xem [SPEC.md](SPEC.md); quy tắc code khi sửa xem [CLAUDE.md](CLAUDE.md).

## Chạy local

```
npm install
node server.js
```
Mở `http://localhost:3000`. Lần chạy đầu tiên, `data.db` tự tạo và seed dữ liệu từ `seed-data.json`.

Nếu terminal báo `EADDRINUSE: address already in use :::3000` — đã có 1 process Node khác đang chạy, không cần chạy thêm. Muốn dừng: `Ctrl+C` trong terminal đang chạy nó, đợi dấu nhắc quay lại rồi mới chạy lại.

## Đưa code lên GitHub

```
git add -A
git commit -m "..."
git push
```
Repo đã gắn remote `origin` sẵn. `node_modules/`, `data.db`, `data.db-wal`, `data.db-shm`, `uploads/*` đã bị `.gitignore` loại — không push nhầm database/media thật lên git.

## Deploy trên Replit — những điểm dễ vướng

**Import project:** Create Repl → Import from GitHub → dán URL repo. Replit tự nhận diện Node.js nhờ `package.json`.

**"Run command is required" khi Publish:** file `.replit` chỉ áp dụng cho nút Run khi dev trong Workspace — Deployment (Publish) không tự đọc `.replit`, phải khai báo tay trong màn hình **Publishing** (sidebar): Build command `npm install`, Run command `node server.js`.

**Sai loại deployment sẽ mất dữ liệu:** app lưu state vào SQLite (`data.db`) + `uploads/` trên disk local, không dùng cloud storage. Loại **Autoscale** (mặc định Replit hay gợi ý) chạy nhiều instance không chia sẻ disk và **xoá sạch filesystem mỗi lần redeploy** → mất hết data. **Bắt buộc đổi sang "Reserved VM"** (1 instance cố định, disk bền) trong Publishing trước khi cho team dùng thật.

**Visibility Private = bắt đăng nhập Replit:** nếu để Private, người vào link phải có tài khoản Replit + được cấp quyền. Đổi sang **Public** để cả team dùng được không cần đăng nhập Replit.

## Video Google Drive báo "Unable to load video"

Các video demo cũ (đánh dấu `driveId`) nhúng từ Google Drive, không lưu trên server app — lỗi này không phải bug của app, thường do Google Drive giới hạn lượt xem file share công khai (tự hết sau ~1 ngày) hoặc file bị đổi quyền chia sẻ. Muốn ổn định hơn, dùng nút "+" để upload file thật lên server thay cho dán link Drive.

## Khác biệt so với bản HTML gốc

- Đã bỏ nút "Export HTML để chia sẻ" và toàn bộ cơ chế IndexedDB — không cần nữa vì giờ dữ liệu dùng chung qua server.
- Ô "+" trong Reference/Kết quả của Tool: bấm vào mở popup dán link Google Drive; nút "Upload" riêng bên dưới để tải file thật từ máy.
- Nút xoá (✕) trên ảnh/video hiện luôn, không cần hover.
- Có thêm nút "✕ Xoá dòng" để xoá cả 1 dòng thực nghiệm.
