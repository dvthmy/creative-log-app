# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Dự án là gì

Ứng dụng nội bộ "Creative Experiment Log" — bảng theo dõi các thực nghiệm tạo creative AI (video/ảnh) cho 2 app BookWise và Soulie: mỗi experiment 1 dòng (visual style, tool dùng, ảnh/video reference, kết quả, nhận xét), cộng dashboard tổng hợp và bảng "Experiment Plan".

Nó bắt đầu từ 1 file HTML tĩnh duy nhất (xem `../creative-experiment-log-2026-07-28-v3.html` ở thư mục cha — **đọc file này trước khi sửa gì**, đó là nguồn sự thật cho UI/UX/text tiếng Việt/behavior). Repo này là bản port sang có backend để nhiều người dùng chung 1 kho dữ liệu khi deploy trên Replit.

**Đọc [SPEC.md](SPEC.md) trước khi code** — nó map toàn bộ state JS gốc (IndexedDB) sang schema SQLite + API, và ghi rõ các quyết định đã chốt (stack, lưu file trên disk, không auth) cũng như các điểm còn mở cần hỏi lại trước khi implement (export HTML còn giữ không, có cần realtime không).

## Stack đã chốt

- **Backend:** Node.js + Express, 1 process duy nhất serve cả static frontend và API (không cần 2 port).
- **DB:** PostgreSQL (qua `pg`, biến môi trường `DATABASE_URL`), KHÔNG dùng ORM nặng — chỉ query thô, tránh over-engineer cho app nhỏ này. **Toàn bộ tầng DB là async/await** (khác bản đầu dùng SQLite đồng bộ — xem lý do đổi bên dưới).
- **Media storage:** lưu file trực tiếp trên disk (`uploads/`), serve qua route static. Video demo có sẵn tiếp tục dùng Google Drive `driveId` + iframe embed như bản gốc — KHÔNG tải các video Drive đó về.
- **Frontend:** vanilla JS/HTML/CSS, KHÔNG build step, KHÔNG framework. Giữ nguyên class name, id, cấu trúc DOM của bản gốc càng nhiều càng tốt — chỉ thay lớp gọi IndexedDB bằng lớp gọi `fetch()` tới API.

Đừng tự đổi sang React/TypeScript/bundler nếu không được yêu cầu — đây là quyết định đã hỏi và chốt với người dùng, không phải mặc định.

### Vì sao đổi từ SQLite sang PostgreSQL

Bản đầu dùng SQLite (`better-sqlite3`, đồng bộ) theo đúng SPEC.md gốc. Nhưng `better-sqlite3` là native module (cần compile C++), và **build fail trên môi trường deploy của Replit** — Replit Agent đã tự động migrate sang PostgreSQL (Replit có Postgres managed sẵn, cấp qua `DATABASE_URL`) để app chạy được. Sau khi phát hiện việc này (qua merge conflict giữa local và Replit), người dùng đã chốt **giữ Postgres** vì đã chứng minh deploy được trên chính môi trường Replit, thay vì cố sửa lỗi build native module.

**Hệ quả quan trọng:** mọi hàm trong `db.js`/`serialize.js`/`routes/*.js` đều là `async`, dùng `pg` với placeholder `$1, $2...` (không phải `?` hay `@name` như better-sqlite3), và cú pháp SQL theo chuẩn Postgres (`SERIAL` thay vì `AUTOINCREMENT`, `RETURNING id` để lấy id vừa insert, transaction phải tự `BEGIN`/`COMMIT`/`ROLLBACK` qua `pool.connect()` thay vì `db.transaction()` đồng bộ). Khi sửa code, giữ đúng pattern này — đừng quay lại code đồng bộ kiểu better-sqlite3.

`server.js` phải `await db.ready` trước khi `app.listen()`, vì schema + seed chạy async lúc khởi động.

## Cấu trúc dự kiến

```
creative-log-app/
  SPEC.md
  CLAUDE.md
  server.js            -- Express app, await db.ready rồi mới listen
  db.js                -- pg Pool, tạo schema + seed (async), export query() + ready
  serialize.js          -- đọc dữ liệu cho /api/state (toàn bộ async)
  routes/
    rows.js
    rowMedia.js
    notes.js
    sw.js
    ui.js
  public/
    index.html          -- port từ file HTML gốc, xoá phần IndexedDB
    app.js               -- toàn bộ script cũ, sửa lại tầng persistence
  uploads/               -- media user upload, KHÔNG commit vào git (.gitignore)
```
Không còn `data.db` — DB là Postgres ngoài (`DATABASE_URL`), không phải file cục bộ.

## Quy tắc khi sửa code

- Giữ nguyên toàn bộ text tiếng Việt hiển thị cho user (label, placeholder, toast message) — đây là app dùng nội bộ bằng tiếng Việt, không dịch qua tiếng Anh.
- Giữ nguyên tên field trong data model (`visualStyle`, `dateGroup`, `mediaKind`, `driveId`...) khi có thể, để đối chiếu dễ với bản gốc và với SPEC.md.
- Ngưỡng upload file: giữ đúng 200MB/file như bản gốc (`multer` limit), báo lỗi bằng toast giống hành vi cũ.
- Đừng thêm auth/login nếu không được yêu cầu — SPEC.md đã ghi rõ đây là quyết định "no auth" tạm chốt.
- Trước khi thêm tính năng mới ngoài phạm vi SPEC.md (ví dụ realtime, multi-user cursor, versioning), hỏi lại người dùng — đừng tự mở rộng scope.

## Deploy trên Replit

- **DB (Postgres):** đã persist độc lập với container app (Replit managed Postgres) — không mất khi redeploy, không cần Persistent Storage cho phần này.
- **`uploads/` (media user upload trực tiếp, không phải Drive link):** vẫn là file trên disk của container app — vẫn phải bật **Persistent Storage** (hoặc Reserved VM), nếu không các file upload trực tiếp sẽ mất khi Replit redeploy. Xem thêm §6 trong SPEC.md.
- `DATABASE_URL` lấy từ Replit Secrets, không hardcode/commit vào code.

## Chạy dev

Cần biến môi trường `DATABASE_URL` trỏ tới 1 Postgres (local qua Docker, hoặc Replit's Postgres, hoặc bất kỳ Postgres nào khác):
```
DATABASE_URL="postgres://user:pass@host:port/dbname" node server.js
```
Không có bước build. Sửa file trong `public/` là thấy ngay khi reload (không cần watch/HMR vì không có bundler). Lần chạy đầu tiên với DB rỗng, schema + seed data từ `seed-data.json` tự chạy.
