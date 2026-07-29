# Creative Experiment Log — Spec

> **Cập nhật quan trọng:** doc này viết cho DB là **SQLite**. Thực tế production hiện dùng **PostgreSQL** (Replit Agent tự migrate vì `better-sqlite3` build fail trên môi trường deploy Replit) — xem lý do đầy đủ + pattern code hiện tại trong [CLAUDE.md](CLAUDE.md) §"Vì sao đổi từ SQLite sang PostgreSQL". Data model/shape (tên bảng, field) bên dưới vẫn đúng, chỉ khác cú pháp SQL (Postgres thay vì SQLite) và toàn bộ query giờ là `async`.

## 1. Nguồn gốc

Tool này bắt đầu là **1 file HTML tĩnh** (`creative-experiment-log-2026-07-28-v3.html`, ở thư mục cha) — không backend, không build step. Toàn bộ state (bảng thực nghiệm, media, nhận xét, dashboard) sống trong `IndexedDB` của trình duyệt, và có nút "Export HTML" để đóng gói toàn bộ state + media (base64) vào 1 file HTML mới để gửi cho người khác xem — không có server nào ở giữa.

Vấn đề với bản gốc: video/ảnh người dùng tự dán/upload chỉ lưu **cục bộ trên máy đang mở trang**. Hai người mở cùng 1 URL Replit sẽ **không** thấy media của nhau. Đây là lý do dự án này cần 1 backend nhỏ.

## 2. Mục tiêu dự án Replit

Giữ nguyên **giao diện, hành vi, và toàn bộ text tiếng Việt** của bản HTML gốc, nhưng:
- Thêm backend (Node.js + Express) để **mọi người dùng chung 1 kho dữ liệu** (rows, media, ghi chú, dashboard) thay vì mỗi trình duyệt lưu riêng.
- Media user tự thêm (upload/paste) lưu vào server (`uploads/` trên disk), không còn IndexedDB.
- Dữ liệu có cấu trúc (rows, plan table, strengths/weaknesses, UI state) lưu SQLite thay vì IndexedDB `meta` store.
- Video demo có sẵn (Google Drive `driveId`) **giữ nguyên cách nhúng iframe** — không cần tải về.
- Chức năng "Export HTML để chia sẻ" có thể bỏ hoặc giữ như backup thủ công (tuỳ — xem §7 Non-goals).

## 3. Data model (map từ state JS gốc sang SQLite)

Bản gốc có các state object này (xem file HTML gốc, hàm `saveState`/`init`):

| State gốc (IndexedDB `meta` key) | Ý nghĩa | Bảng SQLite tương ứng |
|---|---|---|
| `bookwiseRows` | mảng experiment rows của app BookWise | `rows` (app='bookwise') |
| `soulieRows` | mảng experiment rows của app Soulie | `rows` (app='soulie') |
| `notesGal` | media stack tự do ở section "Ghi chú" | `notes_media` |
| `swState` | strengths/weaknesses theo từng group ngày | `sw_state` |
| `planTable` | bảng Experiment Plan (Phần 1) | `plan_rows` |
| `ui` | trạng thái collapse section/group + text tự do đã sửa | `ui_state` (1 row JSON, hoặc key-value) |
| IndexedDB `media` store | blob ảnh/video user tự thêm | filesystem `uploads/<id>.<ext>` + cột `media_id` reference |

### Bảng `rows` (thay cho `bookwiseRows`/`soulieRows`)
```
id            INTEGER PK
app           TEXT   -- 'bookwise' | 'soulie'
media_kind    TEXT   -- 'video' | 'image'
visual_style  TEXT
title         TEXT   -- chỉ Soulie dùng
dur           TEXT   -- chỉ Soulie dùng, ví dụ "1:11"
tool          TEXT
date_group    TEXT   -- '1-14' | '15-28' (đợt trong tháng)
input_desc    TEXT   -- HTML (giữ <ul><li> như bản gốc)
comment       TEXT   -- HTML
sort_order    INTEGER
```

### Bảng `row_media` (thay cho `reference`/`result` arrays trong mỗi row)
```
id          INTEGER PK
row_id      INTEGER FK -> rows.id
slot        TEXT    -- 'reference' | 'result'
kind        TEXT    -- 'upload' | 'drive'
drive_id    TEXT    -- khi kind='drive', giữ nguyên Google Drive file id
media_id    TEXT    -- khi kind='upload', trỏ tới file trong uploads/
media_type  TEXT    -- mime type, ví dụ 'video/mp4'
caption     TEXT
sort_order  INTEGER
```

### Bảng `notes_media`
Giống `row_media` nhưng không gắn `row_id`/`slot` (chỉ 1 danh sách cho section Ghi chú).

### Bảng `plan_rows`
```
id            INTEGER PK
visual_style  TEXT
app           TEXT    -- 'Soulie' | 'BookWise'
media_kind    TEXT
count         INTEGER
groups        TEXT    -- ví dụ '01–14/07, 15–28/07'
sort_order    INTEGER
```
Giữ nguyên cơ chế "seed 1 lần từ rows thật, sau đó tự do sửa tay, có nút Đồng bộ lại thủ công" — xem hàm `seedPlanTable`/`resyncPlanTable` trong file gốc.

### Bảng `sw_state`
```
group_key   TEXT PK   -- 'bw-1-14' | 'bw-15-28' | 'sl-1-14' | 'sl-15-28'
good_html   TEXT
bad_html    TEXT
```

### Bảng `ui_state`
Key-value đơn giản, tương đương object `uiState` gốc: `{ collapsed, texts, groupCollapsed }`. Có thể lưu 1 hàng JSON hoặc bung thành 3 bảng nhỏ — không quan trọng, giữ đơn giản.

## 4. API (Express)

Tối thiểu cần các endpoint sau — REST đơn giản, không cần auth (đây là 1 tool nội bộ dùng chung, xem §7 về việc có cần auth không):

```
GET    /api/state              -- trả toàn bộ state 1 lần (rows, planTable, swState, uiState, notesMedia)
                                   để frontend load giống lúc init() đọc IndexedDB

PATCH  /api/rows/:id            -- sửa 1 field của 1 row (visualStyle, tool, inputDesc, comment, mediaKind...)
POST   /api/rows                -- tạo row mới trong 1 app + date_group
DELETE /api/rows/:id

POST   /api/rows/:id/media      -- thêm media (upload multipart HOẶC { driveId, caption } cho slot reference/result
DELETE /api/media/:mediaId       -- xoá 1 media item (row hoặc notes), xoá luôn file trên disk nếu kind=upload
PATCH  /api/media/:mediaId       -- sửa caption

POST   /api/notes/media          -- thêm media vào section Ghi chú (giống trên, không gắn row)

PUT    /api/plan-rows             -- thay toàn bộ bảng plan (đơn giản hơn patch từng ô, vì bảng nhỏ)
POST   /api/plan-rows/resync      -- re-seed từ rows thật (server tính lại, trả bảng mới)

PUT    /api/sw/:groupKey          -- cập nhật good/bad html của 1 group

PUT    /api/ui                    -- cập nhật uiState (collapsed, texts, groupCollapsed)

GET    /uploads/:filename         -- serve file media đã upload (static)
```

Response của `GET /api/state` nên có shape gần giống object `payload` mà bản gốc dùng khi export, để việc viết frontend converter dễ đối chiếu:
```json
{
  "rows": { "bookwise": [...], "soulie": [...] },
  "notesMedia": [...],
  "planRows": [...],
  "swState": { "bw-1-14": {...}, ... },
  "uiState": { "collapsed": {}, "texts": {}, "groupCollapsed": {} }
}
```

## 5. Frontend

Giữ gần như nguyên vẹn markup/CSS/UX của file HTML gốc (kể cả text tiếng Việt, class name, id) để giảm rủi ro regression. Thay đổi chính chỉ ở phần script:

- Xoá toàn bộ khối `INDEXEDDB` (`dbP`, `tx`, `putMedia`, `getMedia`, `delMedia`).
- `resolveUrl(mediaId)` → thay bằng URL thật tới `/uploads/<mediaId>` (không cần blob URL/cache nữa vì server serve trực tiếp).
- `addMediaFile` → `POST /api/rows/:id/media` hoặc `/api/notes/media` với `multipart/form-data`, thay vì `putMedia` local.
- Mọi `saveState()` (autosave sau debounce/blur) → gọi API tương ứng theo field vừa đổi (PATCH row, PUT sw, v.v.) thay vì `tx('meta','readwrite', ...)`.
- `init()` → gọi `GET /api/state` 1 lần khi load trang, dựng lại `bookwiseRowsState`/`soulieRowsState`/... từ response, thay vì đọc IndexedDB + `tryImportEmbedded`.
- Cơ chế "Export HTML để chia sẻ" (embed JSON + media base64 vào file) — xem §7, quyết định giữ/bỏ.

**Không cần build step / framework** — tiếp tục vanilla JS, load trực tiếp `<script>` trong `index.html`, phù hợp Replit chạy `node server.js` serve luôn static + API trên cùng port.

## 6. Deploy trên Replit — lưu ý quan trọng

- DB giờ là Postgres managed của Replit (`DATABASE_URL`), persist độc lập với container — không cần Persistent Storage cho phần DB nữa. Thư mục `uploads/` (media upload trực tiếp) thì vẫn là file trên disk container — vẫn phải bật **Persistent Storage** (hoặc Reserved VM) cho riêng thư mục này, nếu không sẽ **mất hết video/ảnh upload trực tiếp mỗi lần redeploy** (video Drive link thì không sao, vì không lưu trên disk).
- Giới hạn kích thước file upload (nginx/Express `multer` limit) — bản gốc chặn ở 200MB/file, giữ nguyên ngưỡng này ở backend (`multer({ limits: { fileSize: 200*1024*1024 } })`).
- 1 process Node duy nhất vừa serve static frontend vừa serve API — không cần 2 port riêng.

## 7. Non-goals / quyết định còn mở (cần xác nhận trước khi code)

- **Auth:** bản gốc không có đăng nhập, giả định người dùng tin cậy trong nội bộ. Giữ nguyên "no auth" trừ khi được yêu cầu — Replit deployment vẫn có URL riêng nên có thể giới hạn qua việc không share link công khai.
- **Export HTML để chia sẻ:** với backend đã lưu dữ liệu chung, tính năng "export file để gửi" bớt cần thiết (mọi người vào cùng URL là thấy chung data). Có thể giữ như 1 nút "Export backup JSON" (không cần embed base64 media nữa, chỉ export metadata) hoặc bỏ hẳn — **cần bạn xác nhận**.
- **Realtime giữa nhiều người đang mở cùng lúc:** bản spec này chỉ tính load-on-refresh (không WebSocket). Nếu cần thấy update của người khác ngay lập tức, cần thêm bước sau (polling hoặc WebSocket) — coi là **out of scope** cho v1.
- **Migrate data cũ:** nếu đã có người dùng bản HTML gốc và có dữ liệu trong IndexedDB/máy họ, cần 1 script import 1 lần (đọc file export HTML cũ → POST vào API mới). Chưa viết ở spec này — làm khi cần.
