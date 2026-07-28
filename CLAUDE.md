# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Dự án là gì

Ứng dụng nội bộ "Creative Experiment Log" — bảng theo dõi các thực nghiệm tạo creative AI (video/ảnh) cho 2 app BookWise và Soulie: mỗi experiment 1 dòng (visual style, tool dùng, ảnh/video reference, kết quả, nhận xét), cộng dashboard tổng hợp và bảng "Experiment Plan".

Nó bắt đầu từ 1 file HTML tĩnh duy nhất (xem `../creative-experiment-log-2026-07-28-v3.html` ở thư mục cha — **đọc file này trước khi sửa gì**, đó là nguồn sự thật cho UI/UX/text tiếng Việt/behavior). Repo này là bản port sang có backend để nhiều người dùng chung 1 kho dữ liệu khi deploy trên Replit.

**Đọc [SPEC.md](SPEC.md) trước khi code** — nó map toàn bộ state JS gốc (IndexedDB) sang schema SQLite + API, và ghi rõ các quyết định đã chốt (stack, lưu file trên disk, không auth) cũng như các điểm còn mở cần hỏi lại trước khi implement (export HTML còn giữ không, có cần realtime không).

## Stack đã chốt

- **Backend:** Node.js + Express, 1 process duy nhất serve cả static frontend và API (không cần 2 port).
- **DB:** SQLite (file `data.db`), KHÔNG dùng ORM nặng — `better-sqlite3` hoặc tương đương là đủ, tránh over-engineer cho app nhỏ này.
- **Media storage:** lưu file trực tiếp trên disk (`uploads/`), serve qua route static. Video demo có sẵn tiếp tục dùng Google Drive `driveId` + iframe embed như bản gốc — KHÔNG tải các video Drive đó về.
- **Frontend:** vanilla JS/HTML/CSS, KHÔNG build step, KHÔNG framework. Giữ nguyên class name, id, cấu trúc DOM của bản gốc càng nhiều càng tốt — chỉ thay lớp gọi IndexedDB bằng lớp gọi `fetch()` tới API.

Đừng tự đổi sang React/TypeScript/bundler nếu không được yêu cầu — đây là quyết định đã hỏi và chốt với người dùng, không phải mặc định.

## Cấu trúc dự kiến

```
creative-log-app/
  SPEC.md
  CLAUDE.md
  server.js            -- Express app, mount API routes + static + uploads
  db.js                -- khởi tạo SQLite, schema, helper query
  routes/
    rows.js
    media.js
    plan.js
    sw.js
    ui.js
  public/
    index.html          -- port từ file HTML gốc, xoá phần IndexedDB
    app.js               -- toàn bộ script cũ, sửa lại tầng persistence
    style.css            -- có thể giữ inline <style> như gốc, không bắt buộc tách
  uploads/               -- media user upload, KHÔNG commit vào git (.gitignore)
  data.db                -- SQLite, KHÔNG commit vào git
```

## Quy tắc khi sửa code

- Giữ nguyên toàn bộ text tiếng Việt hiển thị cho user (label, placeholder, toast message) — đây là app dùng nội bộ bằng tiếng Việt, không dịch qua tiếng Anh.
- Giữ nguyên tên field trong data model (`visualStyle`, `dateGroup`, `mediaKind`, `driveId`...) khi có thể, để đối chiếu dễ với bản gốc và với SPEC.md.
- Ngưỡng upload file: giữ đúng 200MB/file như bản gốc (`multer` limit), báo lỗi bằng toast giống hành vi cũ.
- Đừng thêm auth/login nếu không được yêu cầu — SPEC.md đã ghi rõ đây là quyết định "no auth" tạm chốt.
- Trước khi thêm tính năng mới ngoài phạm vi SPEC.md (ví dụ realtime, multi-user cursor, versioning), hỏi lại người dùng — đừng tự mở rộng scope.

## Deploy trên Replit

Xem §6 trong SPEC.md — quan trọng nhất là phải bật **Persistent Storage** (hoặc Reserved VM) cho `data.db` và `uploads/`, nếu không toàn bộ dữ liệu mất khi Replit redeploy container.

## Chạy dev

```
npm install
node server.js
```
Không có bước build. Sửa file trong `public/` là thấy ngay khi reload (không cần watch/HMR vì không có bundler).
