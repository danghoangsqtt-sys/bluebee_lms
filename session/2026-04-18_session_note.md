# 📋 Nhật ký Công việc — Phiên làm việc 2026-04-18

## Thông tin phiên
- **Ngày:** 2026-04-18 00:00 ~ 01:07 (UTC+7)
- **Nhiệm vụ chính:** Hoàn thiện tính năng Thống kê bài thi & Nâng cấp giao diện Cài đặt
- **Trạng thái:** ✅ Hoàn thành — 0 TypeScript errors, Vite build ✓

---

## Công việc đã thực hiện

### 1. 🐛 Fix lỗi 404 khi lưu câu hỏi mới vào Ngân hàng

| File | Hành động |
|---|---|
| `AIGeneratorTab.tsx` | `id: ID.unique()` → `id: 'temp_' + ID.unique()` — đánh dấu ID tạm |
| `ManualCreatorTab.tsx` | Tương tự, thêm prefix `temp_` cho câu hỏi nhập thủ công |

**Nguyên nhân gốc:** `databaseService.saveQuestion()` nhầm ID tạm 20 ký tự là ID thật của Appwrite → gọi `getDocument()` trước khi tạo mới → HTTP 404 xuất hiện trong console. Thêm prefix `temp_` giúp hệ thống nhận ra đây là câu hỏi mới, bỏ qua bước kiểm tra dư thừa.

---

### 2. 📊 Hoàn thiện Tab "Thống kê" (ExamControlDashboard)

#### [NEW] `components/OnlineTest/ExamStatsOverview.tsx`

Component thống kê tổng quan bài thi, bao gồm:

| Tính năng | Chi tiết |
|---|---|
| Chỉ số cơ bản | Số người dự thi, tổng lượt làm, điểm TB, % < 1 điểm, % ≥ 5 điểm, mốc điểm phổ biến nhất |
| Biểu đồ phổ điểm | Pure CSS bar chart 10 cột (< 1 → ≤ 10), có gridlines + hover |
| Bảng tần số | Kiểu Azota: SL + % cho mỗi mốc điểm, cột "Trên TB (≥ 5)" |
| Xuất Excel | 3 sheets: Phổ điểm, Bảng điểm chi tiết, Tổng quan — dùng thư viện `xlsx` (SheetJS) |

---

### 3. 🔍 Hoàn thiện Tab "Nhận diện câu sai"

#### [NEW] `components/OnlineTest/ExamStatsWrongAnalysis.tsx`

Component phân tích đúng/sai từng câu hỏi:

| Tính năng | Chi tiết |
|---|---|
| Bảng tỷ lệ đúng/sai | Mỗi hàng = 1 câu: tổng HS, đã làm, chưa làm, đúng, sai, % chưa hoàn thành |
| Sortable columns | Bấm header để sắp xếp theo bất kỳ cột nào |
| Expandable rows | Bấm vào hàng → xổ ra danh sách tên HS: làm đúng / làm sai / chưa làm |
| Preview câu hỏi | Nút 👁 mở modal xem nội dung câu hỏi gốc |
| Progress bar | Thanh % đúng trực quan trên mỗi hàng |

---

### 4. ⚙️ Nâng cấp Tab "Cài đặt chung"

#### [MODIFY] `components/OnlineTest/ExamControlDashboard.tsx`

Cải tiến giao diện cài đặt bài thi thành 4 section cân đối:

| Section | Nội dung mới |
|---|---|
| ⏰ Cấu hình thời gian | Thời gian Mở đề + Đóng đề |
| 🛡️ Bảo mật & Xáo trộn | Mật khẩu + Đảo câu hỏi + Đảo đáp án |
| 👥 Đối tượng & Giới hạn | **Dropdown giao cho lớp** (fetch từ DB), **Thời gian làm bài (phút)**, **Số lần thi tối đa** |
| 🔘 Trạng thái phát hành | Radio: **Lưu nháp** / **Xuất bản** (Thi ngay / Theo giờ) |

Thêm: Nút "Hủy", thông báo "Đã lưu thành công", gửi đầy đủ `duration`, `max_attempts`, `class_id`, `status` trong payload `onConfigSave`.

---

## Dependency mới

| Package | Mục đích | Lệnh |
|---|---|---|
| `xlsx` (SheetJS) | Xuất file Excel client-side | `npm install xlsx` |

---

## Kiểm tra & Xác nhận

```
npx tsc --noEmit --skipLibCheck → 0 errors ✅
npx vite build → ✓ built in 7.15s ✅
git push → main branch updated ✅
```

---

## Danh sách file thay đổi

| File | Loại |
|---|---|
| `components/QuestionGenerator/AIGeneratorTab.tsx` | MODIFY — prefix `temp_` cho ID mới |
| `components/QuestionGenerator/ManualCreatorTab.tsx` | MODIFY — prefix `temp_` cho ID mới |
| `components/OnlineTest/ExamStatsOverview.tsx` | **NEW** — Tab Thống kê tổng quan |
| `components/OnlineTest/ExamStatsWrongAnalysis.tsx` | **NEW** — Tab Nhận diện câu sai |
| `components/OnlineTest/ExamControlDashboard.tsx` | MODIFY — Tích hợp 2 tab mới + nâng cấp Cài đặt |
| `package.json` | MODIFY — thêm dependency `xlsx` |

---

## Bước tiếp theo

- [ ] Test tab Thống kê với bài thi có dữ liệu kết quả thực tế
- [ ] Test xuất Excel và kiểm tra nội dung file
- [ ] Test tab Nhận diện câu sai — mở rộng hàng, xem chi tiết HS
- [ ] Kiểm tra Lưu Cấu Hình gửi đúng payload mới (duration, max_attempts, class_id, status)
- [ ] Xem xét thêm biểu đồ tròn (pie chart) cho phân bố điểm nếu cần
