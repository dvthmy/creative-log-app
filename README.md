# Creative Experiment Log

Xem [SPEC.md](SPEC.md) (kiến trúc/data model) và [CLAUDE.md](CLAUDE.md) (quy tắc code) trước khi sửa.

## Chạy local

```
npm install
node server.js
```
Mở `http://localhost:3000`. Lần chạy đầu tiên, `data.db` tự tạo và seed dữ liệu từ `seed-data.json`.

## Đưa lên Replit qua Git

### 1. Khởi tạo git trong thư mục này (nếu chưa có)
```
cd creative-log-app
git init
git add .
git commit -m "Initial commit"
```
`node_modules/`, `data.db`, `uploads/*` đã bị `.gitignore` loại — không push nhầm database/media thật lên git.

### 2. Đẩy lên GitHub
Tạo 1 repo trống trên GitHub (không tick "Add README"), rồi:
```
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

### 3. Import vào Replit
- Vào replit.com → **Create Repl** → chọn tab **Import from GitHub** → dán URL repo vừa push.
- Replit tự nhận diện đây là project Node.js (nhờ `package.json`).
- Bấm **Run** — lệnh trong `.replit` sẽ tự `npm install` rồi `node server.js`.
- Replit cấp cho bạn 1 URL public dạng `https://<repl-name>.<user>.repl.co` — đó là link chia sẻ cho team dùng chung.

### 4. QUAN TRỌNG — bật Persistent Storage trước khi dùng thật
Mặc định, một số loại deployment trên Replit (đặc biệt Autoscale) có thể **reset filesystem mỗi lần redeploy** — nghĩa là `data.db` và `uploads/` (toàn bộ video/ảnh + dữ liệu đã nhập) **sẽ mất**.

Vào tab **Deployments** của Repl → chọn loại deployment có **Persistent Storage** (hoặc dùng **Reserved VM** thay vì Autoscale) → đảm bảo `data.db` và thư mục `uploads/` nằm trong phần lưu trữ bền. Nếu không chắc, hỏi trong Replit docs/support trước khi cho team dùng thật — mất dữ liệu do quên bước này rất khó cứu lại.

### 5. Sau khi đã chạy, mỗi lần sửa code
```
git add -A
git commit -m "..."
git push
```
Trên Replit: pull lại (hoặc Replit tự đồng bộ nếu bạn connect GitHub) rồi bấm Run lại.

## Những gì đã bỏ so với bản HTML gốc

- Nút **"Export HTML để chia sẻ"** (đóng gói toàn bộ state + video base64 vào 1 file HTML) đã bỏ — không còn cần thiết vì giờ mọi người dùng chung 1 URL, dữ liệu nằm trên server. Nếu vẫn muốn có 1 nút "Export backup JSON" (không kèm video) để phòng hờ, nói để thêm.
- Cơ chế IndexedDB / lưu cục bộ trên trình duyệt đã bỏ hoàn toàn — mọi thứ giờ qua API + SQLite + `uploads/`.
