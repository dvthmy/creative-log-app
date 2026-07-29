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

Bắt đầu từ 1 file HTML tĩnh (`creative-experiment-log-2026-07-28-v3.html`, ở thư mục cha) — chạy hoàn toàn trong trình duyệt, lưu dữ liệu bằng IndexedDB cục bộ trên từng máy. Dự án này port lại thành app có backend (Node.js + Express + PostgreSQL) để dữ liệu dùng chung được giữa nhiều người, deploy trên Replit.

## Stack

Node.js + Express + PostgreSQL (qua `pg`, biến môi trường `DATABASE_URL`) + lưu file media trên disk (`uploads/`). Frontend vanilla JS/HTML/CSS, không build step, không framework. Chi tiết kiến trúc/data model xem [SPEC.md](SPEC.md); quy tắc code khi sửa xem [CLAUDE.md](CLAUDE.md) — có ghi rõ vì sao đổi từ SQLite sang Postgres.

## Chạy local

Cần 1 Postgres để trỏ tới (local qua Docker, hoặc dùng chung Postgres của Replit, hoặc bất kỳ instance nào khác):
```
npm install
DATABASE_URL="postgres://user:pass@host:port/dbname" node server.js
```
Mở `http://localhost:3000`. Lần chạy đầu tiên với DB rỗng, schema + seed dữ liệu từ `seed-data.json` tự chạy.

Nếu terminal báo `EADDRINUSE: address already in use :::3000` — đã có 1 process Node khác đang chạy, không cần chạy thêm. Muốn dừng: `Ctrl+C` trong terminal đang chạy nó, đợi dấu nhắc quay lại rồi mới chạy lại.

## Đưa code lên GitHub

```
git add -A
git commit -m "..."
git push
```
Repo đã gắn remote `origin` sẵn. `node_modules/`, `uploads/*` đã bị `.gitignore` loại — không push nhầm media thật lên git. `DATABASE_URL` không commit vào code, luôn lấy từ biến môi trường/Secrets.

## Deploy trên Replit — những điểm dễ vướng

**Import project:** Create Repl → Import from GitHub → dán URL repo. Replit tự nhận diện Node.js nhờ `package.json`.

**"Run command is required" khi Publish:** file `.replit` chỉ áp dụng cho nút Run khi dev trong Workspace — Deployment (Publish) không tự đọc `.replit`, phải khai báo tay trong màn hình **Publishing** (sidebar): Build command `npm install`, Run command `node server.js`.

**`DATABASE_URL` phải có trong Secrets:** nếu dùng Postgres managed của Replit, biến này thường tự có sẵn sau khi tạo database trong tab Database. Kiểm tra nó cũng được set trong phần **Deployments → Secrets** (không chỉ Workspace), nếu không app sẽ crash lúc kết nối DB khi deploy.

**Sai loại deployment vẫn có thể mất `uploads/`:** DB (Postgres) persist độc lập với container nên không sao, nhưng thư mục `uploads/` (media upload trực tiếp, không phải Drive link) vẫn là file trên disk container. Loại **Autoscale** (mặc định Replit hay gợi ý) chạy nhiều instance không chia sẻ disk và **xoá sạch filesystem mỗi lần redeploy** → mất các file đã upload trực tiếp. Nếu team upload file thật nhiều, cân nhắc đổi sang **"Reserved VM"** (1 instance cố định, disk bền) trong Publishing.

**Visibility Private = bắt đăng nhập Replit:** nếu để Private, người vào link phải có tài khoản Replit + được cấp quyền. Đổi sang **Public** để cả team dùng được không cần đăng nhập Replit.

## Video Google Drive báo "Unable to load video"

Các video demo cũ (đánh dấu `driveId`) nhúng từ Google Drive, không lưu trên server app — lỗi này không phải bug của app, thường do Google Drive giới hạn lượt xem file share công khai (tự hết sau ~1 ngày) hoặc file bị đổi quyền chia sẻ. Muốn ổn định hơn, dùng nút "+" để upload file thật lên server thay cho dán link Drive.

## Khác biệt so với bản HTML gốc

- Đã bỏ nút "Export HTML để chia sẻ" và toàn bộ cơ chế IndexedDB — không cần nữa vì giờ dữ liệu dùng chung qua server.
- Ô "+" trong Reference/Kết quả của Tool: bấm vào mở popup dán link Google Drive; nút "Upload" riêng bên dưới để tải file thật từ máy.
- Nút xoá (✕) trên ảnh/video hiện luôn, không cần hover.
- Có thêm nút "✕ Xoá dòng" để xoá cả 1 dòng thực nghiệm.
