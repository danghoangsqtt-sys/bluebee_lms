# 📋 Nhật ký Công việc — Phiên làm việc 2026-04-11

## Thông tin phiên
- **Ngày:** 2026-04-11 13:39 (UTC+7)
- **Nhiệm vụ:** Phân tích toàn bộ mã nguồn Bluebee LMS, tìm bugs, lập kế hoạch khắc phục
- **Phạm vi:** Toàn bộ codebase (~35+ files, ~15,000+ dòng code)
- **Trạng thái:** ✅ Hoàn thành Phase Phân tích

---

## Tiến trình Phân tích

### 1. Khám phá Cấu trúc Dự án (13:39 - 13:42)
- Duyệt qua toàn bộ cấu trúc thư mục
- Xác định 9 modules chính: AI, Database, Auth, OnlineTest, SelfStudy, ExamCreator, Documents, QuestionGenerator, ScheduleManager
- Ghi nhận các công nghệ: React 18, Vite, Appwrite, Gemini AI, TailwindCSS

### 2. Phân tích Services Layer (13:42 - 13:48)
- **geminiService.ts** (329 dòng) — AI engine chính
  - Phát hiện `process.env.API_KEY` không hoạt động trong Vite
  - FALLBACK_MODEL khai báo nhưng không sử dụng
  - `evaluateOralAnswer` sai format contents
- **databaseService.ts** (938 dòng) — Data access layer
  - Lộ Server API Key trên client-side (CRITICAL)
  - `Query.notEqual(null)` không hợp lệ
  - Sai total count sau client-side filter
- **documentProcessor.ts** (73 dòng) — PDF processing
  - Import không sử dụng GoogleGenAI
  - process.env fallback không hoạt động

### 3. Phân tích Components (13:48 - 13:55)
- **Chatbot.tsx** (290 dòng) — AI chat
  - History không có limit → potential crash
  - Import Link không sử dụng
- **AIGeneratorTab.tsx** (230 dòng) — AI question generation
  - CRITICAL: Không truyền contextText cho AI → AI chỉ thấy 15K chars
- **ExamRoom.tsx** (568 dòng) — Online testing
  - Timer race condition khi resume
  - Anti-cheat double counting (blur + visibility)
  - Effect dependencies quá rộng → re-register mỗi giây
- **ExamCreator.tsx** (729 dòng) — Exam creation
  - AnswerData key type mismatch (number vs string)
  - Potential double insertion

### 4. Phân tích Auth & Config (13:55 - 13:58)
- **AuthContext.tsx** (177 dòng) — Authentication
  - Race condition khi 2 user đăng ký cùng email
- **.env.local** — Environment config
  - Server API Key lộ ra client

### 5. Phân tích Utils & Lib (13:58 - 14:00)
- **examEngine.ts** (112 dòng) — Exam paper generation
  - Option prefix pipeline bị lồng nhau
- **appwrite.ts** (40 dòng) — Appwrite client config
  - Cấu hình OK, fallback values hợp lý

---

## Kết quả Tổng hợp

| Mức độ | Số lượng | Mô tả |
|---|---|---|
| 🔴 Critical | 5 | Bảo mật, crash, race condition |
| 🟠 High | 7 | Chức năng bị hỏng/sai |
| 🟡 Medium | 10 | Performance, UX, type safety |
| 🔵 Low | 4 | Code cleanup, warnings |
| **Tổng** | **26** | |

### Top 3 Bugs Nguy hiểm nhất:
1. **C-01:** Lộ Appwrite Server API Key trên browser → ai cũng có thể tạo/xóa user
2. **H-01:** AI Question Generator không gửi nội dung tài liệu → AI "bịa" câu hỏi
3. **C-04/C-05:** ExamRoom timer + anti-cheat có race condition → nộp bài nhiều lần

---

## Bước tiếp theo

- [ ] Chờ user review Implementation Plan
- [ ] Thực thi Phase 1: Security & Critical fixes (ưu tiên C-01, C-02)
- [ ] Thực thi Phase 2: AI feature fixes (H-01, M-01)
- [ ] Thực thi Phase 3: Data & UX fixes
- [ ] Thực thi Phase 4: Cleanup

---

## Files đã phân tích (Danh sách đầy đủ)

```
services/
  ├── geminiService.ts ✅
  ├── databaseService.ts ✅
  ├── documentProcessor.ts ✅
  ├── pdfExportService.ts (chưa phân tích chi tiết)
  └── updateService.ts (chưa phân tích chi tiết)

components/
  ├── Chatbot.tsx ✅
  ├── Documents.tsx ✅
  ├── ExamCreator.tsx ✅
  ├── ExamStatistics.tsx (chưa phân tích chi tiết)
  ├── Login.tsx (chưa phân tích chi tiết)
  ├── QuestionBankManager.tsx (chưa phân tích chi tiết - file lớn 60KB)
  ├── Settings.tsx (chưa phân tích chi tiết)
  ├── ProfileSettings.tsx (chưa phân tích chi tiết)
  ├── QuestionGenerator/
  │   ├── index.tsx ✅
  │   ├── AIGeneratorTab.tsx ✅
  │   ├── ManualCreatorTab.tsx (chưa phân tích chi tiết)
  │   └── ReviewList.tsx (chưa phân tích chi tiết)
  ├── OnlineTest/
  │   ├── index.tsx ✅
  │   ├── ExamRoom.tsx ✅
  │   ├── ExamAnalytics.tsx (chưa phân tích chi tiết)
  │   └── LiveProctoring.tsx (chưa phân tích chi tiết)
  ├── SelfStudy/
  │   └── index.tsx ✅
  ├── Admin/
  │   ├── AdminDashboard.tsx (chưa phân tích chi tiết)
  │   ├── ClassManager.tsx (chưa phân tích chi tiết)
  │   ├── OverviewTab.tsx (chưa phân tích chi tiết)
  │   ├── StudentApproval.tsx (chưa phân tích chi tiết)
  │   └── TeacherManager.tsx (chưa phân tích chi tiết)
  ├── Teacher/
  │   ├── LectureManager.tsx (chưa phân tích chi tiết)
  │   ├── TeacherDashboard.tsx (chưa phân tích chi tiết)
  │   └── TeacherStudents.tsx (chưa phân tích chi tiết)
  └── ScheduleManager/
      ├── index.tsx (chưa phân tích chi tiết)
      └── ...

contexts/
  └── AuthContext.tsx ✅

lib/
  └── appwrite.ts ✅

utils/
  ├── examEngine.ts ✅
  ├── documentParser.ts (chưa phân tích chi tiết)
  └── textFormatter.ts (chưa phân tích chi tiết)

Root:
  ├── App.tsx ✅
  ├── types.ts ✅
  ├── .env.local ✅
  └── package.json ✅
```
