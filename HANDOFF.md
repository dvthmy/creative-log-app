# HANDOFF — Creative Experiment Log

Ghi lại các sự cố deploy đã gặp trên Replit + cách kiểm tra nhanh, để không phải debug lại từ đầu mỗi lần.

## Trước khi bấm Republish, luôn kiểm tra 3 thứ

```bash
# 1. Code trên Workspace có đúng bản mới nhất chưa
git status
git log -1          # so với commit mới nhất trên GitHub

# 2. File chạy được không (không có conflict marker sót lại)
node -c server.js && node -c db.js && node -c serialize.js && echo OK

# 3. .replit có đủ khối [deployment] không
cat .replit
```

Nếu `git status` báo "ahead of origin" nhiều commit lạ kiểu "Published your App" — đó là Replit tự tạo, vô hại, không cần push lên GitHub.

## Sự cố #1: "Run command is required" khi Publish

**Triệu chứng:** bấm Republish, báo lỗi đỏ "Run command is required. Please configure a run command in your deployment configuration."

**Nguyên nhân:** Deployment (Publish) **không đọc `run =` ở đầu file `.replit`** — dòng đó chỉ dùng cho nút Run khi dev trong Workspace. Deployment cần khối `[deployment]` riêng với `build`/`run` dạng mảng.

**Vì sao lỗi này từng lặp lại 2 lần:** lần đầu sửa `.replit` trực tiếp bằng lệnh Shell trên Replit, nhưng **quên chưa commit vào Git** — nên mỗi lần `git pull`/`git reset --hard` để đồng bộ code, `.replit` bị ghi đè về bản cũ (không có `[deployment]`), mất luôn cấu hình. **Giờ đã sửa tận gốc: `.replit` đã commit vào repo với đủ `[deployment]`** — miễn code trên Replit khớp `origin/main` là không mất nữa.

**Nếu lỡ vẫn gặp lại**, kiểm tra `.replit` có đủ khối này không (đổi `deploymentTarget` nếu loại deploy khác):
```toml
[deployment]
deploymentTarget = "gce"
build = ["sh", "-c", "npm install"]
run = ["sh", "-c", "node server.js"]
```

## Sự cố #2: Migration tự động đòi xoá bảng `weeks`

**Triệu chứng:** Publish hiện cảnh báo màu cam "Warning, this migration may permanently remove some data..." kèm dòng `DROP TABLE "weeks" CASCADE`.

**Nguyên nhân:** Replit có **2 database tách biệt** — "Development database" (dùng khi chạy trong Workspace) và "Production database" (app thật). Publish tự so sánh schema 2 bên; nếu Development database chưa có bảng nào đó (vd `weeks`) mà Production có, nó coi Production "thừa" và đề xuất xoá cho khớp Development.

**⚠️ TUYỆT ĐỐI KHÔNG bấm "Approve and publish" khi thấy cảnh báo DROP TABLE** — sẽ xoá thật dữ liệu trên Production.

**Cách xử lý:**
1. Bấm **Cancel** ngay.
2. Trong Shell, chạy `node server.js` một lần (Ctrl+C sau khi thấy log "đang chạy tại port 3000") — code có `CREATE TABLE IF NOT EXISTS` nên sẽ tự tạo bảng còn thiếu trong Development database.
3. Republish lại — lúc này 2 schema khớp nhau, không còn đề xuất xoá bảng.

**Quy tắc chung:** mọi bảng mới thêm vào `db.js` sau này, nhớ chạy `node server.js` một lần trong Workspace trước khi Publish, để Development database không bị "thiếu" bảng so với Production.

## Sự cố #3: UI trên link live không cập nhật dù đã pull

**Cách chẩn đoán nhanh** — kiểm tra 3 tầng theo thứ tự, đừng đoán:

```bash
# Tầng 1: code trên Workspace đã đúng chưa
grep -c 'add-week-btn' public/index.html   # hoặc bất kỳ marker nào của tính năng mới

# Tầng 2: server có đang chạy code đó không (test trực tiếp trên Workspace)
node server.js   # xem log start có lỗi gì không

# Tầng 3: origin (link live thật) đang trả về gì — bỏ qua hết cache trình duyệt
curl -s https://<domain>.replit.app/ | grep -c 'add-week-btn'
```

Nếu tầng 1+2 đúng nhưng tầng 3 vẫn cũ → 99% là **chưa Republish** (pull code vào Workspace không tự đẩy lên bản deploy đang chạy), hoặc Republish đã chạy nhưng cache CDU/trình duyệt — thử Incognito hoặc thêm `?v=2` vào URL.

## Đồng bộ dữ liệu giữa 2 môi trường test

Local (máy dev, Postgres qua Docker) và Replit là **2 database hoàn toàn tách biệt** — không tự đồng bộ. Nếu cần kéo dữ liệu thật từ Replit về local để test, dùng script kiểu:

```js
// đọc production qua API công khai, ghi thẳng vào Postgres local qua `pg`
const state = await (await fetch('https://<domain>.replit.app/api/state')).json();
// TRUNCATE rồi INSERT lại rows/row_media/weeks/notes_media/sw_state/ui_state
// theo đúng thứ tự khoá ngoại — xem lịch sử chat lúc trước để lấy script mẫu.
```
Đây là đồng bộ **1 chiều, 1 lần** — sửa gì ở local sau đó sẽ không tự đẩy ngược lại Replit.

## Ghi chú khác

- Đừng bấm **"Fix with Agent"** khi gặp lỗi build/deploy — dễ khiến Replit tự sửa code không theo ý muốn (đã từng gây conflict git nghiêm trọng, xem lịch sử migrate SQLite → Postgres).
- App dùng PostgreSQL (không phải SQLite ban đầu) — lý do đổi ghi ở [CLAUDE.md](CLAUDE.md).
- Loại deployment: **Reserved VM** (không phải Autoscale) — quan trọng vì `uploads/` (file upload trực tiếp) là file trên disk, Autoscale sẽ xoá sạch mỗi lần redeploy.
