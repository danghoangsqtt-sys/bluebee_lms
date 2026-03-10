<p align="center">
  <img src="./public/logo.png" alt="BLUEBEE LMS Logo" width="200"/>
</p>

<h1 align="center">BLUEBEE LMS</h1>
<p align="center"><b>Hệ thống Quản lý Học tập Thông minh tích hợp Trí tuệ nhân tạo</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Appwrite-F02E65?style=for-the-badge&logo=appwrite&logoColor=white" alt="Appwrite" />
  <img src="https://img.shields.io/badge/Google_Gemini-8E75C2?style=for-the-badge&logo=google-gemini&logoColor=white" alt="Gemini" />
</p>

---

## 🚀 Giới thiệu tổng quan

**BLUEBEE LMS** là nền tảng quản lý học tập (Learning Management System) tiên tiến, được kiến tạo để đáp ứng nhu cầu giáo dục số hóa trong kỷ nguyên Trí tuệ nhân tạo. Hệ thống mang lại một không gian tương tác liền mạch giữa Quản trị viên, Giáo viên và Học viên, đồng thời tối ưu hóa hiệu suất bằng cách tự động hóa các tác vụ phức tạp thông qua mô hình ngôn ngữ lớn (LLM).

Đặc quyền của hệ thống nằm ở khả năng **RAG (Retrieval-Augmented Generation)**, cho phép AI hỗ trợ dựa trên chính nguồn học liệu nội bộ, đảm bảo tính chính xác và bảo mật.

---

## ✨ Tính năng cốt lõi

BLUEBEE được thiết kế chuyên sâu cho 3 nhóm đối tượng người dùng chính:

### 🛠 Dành cho Quản trị viên (Admin)

- **Hệ thống Quản trị Tập trung:**
  - Dashboard báo cáo trực quan về tình hình nhân sự và học tập.
  - Quản lý danh sách Giáo viên/Học viên, phê duyệt tài khoản và phân quyền.
- **Truyền thông Nội bộ:**
  - Thiết lập **Marquee Banner** (Thông báo chạy chữ) hiển thị real-time toàn hệ thống.
  - Quản lý tài liệu và kho dữ liệu dùng chung.

### 📖 Dành cho Giáo viên (Teacher)

- **Quản lý Học thuật:**
  - Tổ chức lớp học, theo dõi danh sách học viên và quản lý hồ sơ kỹ thuật số.
  - Xây dựng bài giảng đa phương tiện (Contextual Learning).
- **AI-Powered Question Hub:**
  - **Tạo đề thi tự động:** Trích xuất câu hỏi từ tệp PDF/Word bằng AI.
  - **Phân loại câu hỏi:** Tự động gắn nhãn theo thang đo Bloom và độ khó.
  - **Thống kê chuyên sâu:** Phân tích biểu đồ điểm số và mức độ hoàn thành nhiệm vụ của lớp.

### 🎓 Dành cho Học viên (Student)

- **Learning Hub Dashboard:**
  - Xem lịch trình, nhiệm vụ chưa hoàn thành và thông báo mới nhất.
  - Truy cập bài giảng và tài liệu học tập được chỉ định.
- **Trải nghiệm Thi trực tuyến:**
  - Giao diện thi mượt mà, hỗ trợ định dạng KaTeX cho các biểu thức toán học.
  - Nhận phản hồi ngay lập tức sau khi nộp bài.
- **BLUEBEE AI Assistant:**
  - Chatbot hỗ trợ 24/7 giải đáp kiến thức dựa trên ngữ cảnh tài liệu học tập.

---

## 🛠 Công nghệ sử dụng

Hệ thống được xây dựng trên nền tảng Tech-Stack hiện đại đảm bảo tính mở rộng và bảo mật:

- **Frontend:** React 18 (Hooks, Context API), TypeScript, Vite, Tailwind CSS.
- **Backend/Cloud:** Appwrite SDK (Auth, Database, Cloud Storage).
- **AI Intelligence:** SDK Google Generative AI (`gemini-2.0-flash`).
- **Data Processing:** PDF.js (Parsing PDF), Mammoth (Parsing Docx), Katex (Math rendering).

---

## 🎬 Hướng dẫn Cài đặt & Cấu hình

### 1. Yêu cầu môi trường

- Node.js v18.x trở lên.
- Một tài khoản Appwrite (Self-hosted hoặc Cloud).
- Google Gemini API Key.

### 2. Cài đặt nhanh

```bash
npm install
npm run dev
```

### 3. Cấu hình Biến môi trường (`.env`)

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT=[Project_ID_Của_Bạn]
VITE_GEMINI_API_KEY=[API_Key_Gemini_Của_Bạn]
```

### 💡 Cấu hình Marquee Banner (Thông báo chạy chữ)

Để cập nhật thông báo quan trọng trên trang Dashboard chính:

1. Đăng nhập bằng quyền **Admin**.
2. Truy cập vào trang **Tổng quan**.
3. Tìm biểu tượng bút chì **✏️** trên thanh banner đầu trang.
4. Nhập nội dung thông báo và nhấn **Lưu**. Thông báo sẽ được cập nhật ngay lập tức cho toàn bộ học viên và giáo viên.

---

## 📂 Cấu trúc thư mục (Folder Structure)

```text
src/
├── components/     # Giao diện người dùng theo Module (Admin/Teacher/Student)
├── services/       # Xử lý Logic (Database, Gemini AI, Document processing)
├── contexts/       # Quản lý trạng thái xác thực và ứng dụng
├── types/          # Định nghĩa kiểu dữ liệu TypeScript
└── lib/            # Khởi tạo các SDK bên thứ ba (Appwrite Client)
```

---

## ⚖️ Giấy phép & Bản quyền

Dự án được phát triển và sở hữu bởi **DHsystem**. Mọi hành vi sao chép trái phép đều bị nghiêm cấm.

---

<p align="center"><i>BLUEBEE LMS – Đồng hành cùng sự nghiệp tự học thông minh.</i></p>
