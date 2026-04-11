# Hệ thống Quản trị Đề thi Toàn diện (Exam Control Dashboard)

Tính năng này nhằm mục đích xây dựng một giao diện **Quản trị Kỳ thi (Control Dashboard) Toàn màn hình** thay thế hoàn toàn cho các hộp thoại (modal) nhỏ lẻ hiện tại (Config, Live Proctoring, Analytics). Giao diện mới sẽ được thiết kế bám sát UX/UI của các hệ thống thi chuyên nghiệp như Azota, mang lại trải nghiệm liền mạch cho Giáo viên và Admin.

## User Review Required

> [!IMPORTANT]
> **Thiết kế này sẽ thay đổi hoàn toàn cách Giáo viên quản lý một đề thi!**
> Thay vì hiện ra các hộp thoại popup nhỏ giọt khi bấm Config hay Thống kê, thao tác bấm vào một bài thi sẽ mở ra một Màn hình Quản trị "Một trạm" (One-Stop Dashboard) chiếm toàn bộ màn hình, mang đến cảm giác làm việc chuyên nghiệp cao. Xin hãy phê duyệt thay đổi thiết kế cốt lõi này!

## Proposed Changes

Chúng ta sẽ tạo ra một Component mới nhằm gộp chung và thay thế tất cả các tính năng quản lý bài thi rời rạc hiện tại. 

---

### Màn hình Tổng quan (Dashboard UI)

#### [NEW] `components/ExamControlDashboard.tsx`
Màn hình này sẽ được kích hoạt khi giáo viên/admin nhấp vào Tên Đề Thi. 
Tổ chức thành 2 khu vực chính:
- **Left Sidebar (Cột tính năng):**
  - Thông tin nhanh: Tên đề, Ngày tạo, Số lượt làm.
  - Menu chức năng:
    - ⚙️ **Cài đặt & Cấu hình:** Di dời thiết lập giờ giấc, mật khẩu, xáo trộn từ Config Modal hiện hành vào đây.
    - 🔴 **Giám thị Trực tuyến (Live):** Hiển thị màn hình Live Proctoring đang có, hiển thị Red flag/cảnh báo tab (Gian lận).
    - 📊 **Thống kê Phổ điểm:** Render phổ điểm tổng quan (Biểu đồ, điểm trung bình, chỉ số phân loại phổ điểm).
    - 📝 **Đánh giá & Bảng điểm:** Danh sách kết quả chi tiết kèm theo **Nhận xét thông minh từ AI Gemini**.

---

### Tích hợp AI Đánh giá Thí sinh (AI Evaluation)

#### [MODIFY] `services/databaseService.ts`
- Bổ sung trường `ai_evaluation` vào entity Kết quả thi (`ExamResult`) để lưu lại nhận xét vào Database, giúp tiết kiệm API call mỗi khi bật lại bảng.
- Thêm phương thức `updateExamResultAI(resultId, text)`.

#### [MODIFY] `services/geminiService.ts`
- Thêm một prompt function `evaluateStudentPerformance(score, timeSpent, redFlags, wrongAnswers)`.
- Hệ thống Gemini AI sẽ tiến hành đưa ra nhận xét ngắn (1-2 câu) dựa trên: thời gian nộp bài so với tổng thời lượng, điểm số, mức độ làm sai kiến thức, và **ý thức thi cử (số lần vi phạm gian lận redFlags)**.

---

### Chuyển đổi Logic Routing tại Danh sách Bài Thi

#### [MODIFY] `components/OnlineTest/index.tsx` & `components/SelfStudy/index.tsx`
- Sửa lại nút bấm: Khi cấu hình `isTeacherOrAdmin = true`, ấn vào tên Đề kiểm tra sẽ nhảy sang Component `<ExamControlDashboard />`.
- Giấu các nút rườm rà dưới đuôi (Config, Live, Stats) nếu đã có Dashboard gom chung.

## Open Questions

> [!WARNING]
> **1. Việc gọi AI nhận xét:** Việc gọi AI chấm và nhận xét cho hàng chục/trăm thí sinh cùng lúc sẽ khá chậm và gây tốn giới hạn (Rate Limit) cho API Gemini. Tôi đề xuất tại Bảng thi, mặc định cột "Nhận xét" sẽ trống, và sẽ có **nút bấm "💬 Khởi tạo Nhận xét AI"** bên cạnh mỗi học sinh. Khi bạn quan tâm em nào, bạn ấn vào thì AI mới làm việc cho em đó. Bạn có đồng ý với cơ chế "Gọi On-Demand" (Sinh theo yêu cầu) này hay muốn tự động quẹt toàn bộ lớp (bỏ qua rủi ro Delay)?
>
> **2. Nút bấm cũ:** Khi có Dashboard to đùng chứa hết mọi thứ này, chúng ta có nên xóa các nút Live, Stats, Config nhỏ xíu nằm rời rạc bên dưới mỗi thẻ Bài thi để giao diện gọn gàng hơn không?

## Verification Plan

### Manual Verification
1. Giáo viên nhấp vào Tên Đề kiểm tra.
2. Màn hình Dashboard mới mở ra toàn màn hình bao trùm. Menu sidebar bên trái hiển thị rõ ràng.
3. Giáo viên chuyển Tab: Chuyển qua Live thấy chạy Realtime, chuyển qua Thống kê thấy tỷ lệ điểm, chuyển sang Bảng điểm thấy Nút "Sinh nhận xét AI".
4. Bấm sinh nhận xét AI thử nghiệm cho một thí sinh và kiểm tra nội dung có chính xác với điểm số và số lần vi phạm không.
