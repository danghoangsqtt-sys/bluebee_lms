
import React, { useState } from 'react';

const UserGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'OVERVIEW' | 'CHAT' | 'DOCS' | 'BANK' | 'GAME' | 'UPDATE'>('OVERVIEW');

  const SectionButton = ({ id, label, icon, color }: { id: any, label: string, icon: string, color: string }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
        activeSection === id 
          ? `bg-${color}-600 text-white shadow-xl scale-105 z-10` 
          : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
      }`}
    >
      <i className={`fas ${icon} text-lg`}></i>
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in pb-24 px-6 pt-10 font-inter">
      <div className="text-center space-y-4">
        <div className="inline-block bg-blue-50 text-blue-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-2 border border-blue-100">
           Trung tâm Hỗ trợ & Vận hành Hệ thống
        </div>
        <h1 className="text-5xl font-black text-gray-900 tracking-tight">Hướng dẫn làm chủ LMS Core</h1>
        <p className="text-gray-500 text-lg font-medium max-w-2xl mx-auto leading-relaxed">Cẩm nang chi tiết về vận hành tri thức AI và quản lý dữ liệu học tập an toàn.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 relative">
        <SectionButton id="OVERVIEW" label="Hệ thống & Bảo mật" icon="fa-shield-halved" color="blue" />
        <SectionButton id="CHAT" label="Trợ lý AI" icon="fa-robot" color="purple" />
        <SectionButton id="DOCS" label="Tài liệu RAG" icon="fa-book-atlas" color="indigo" />
        <SectionButton id="BANK" label="Ngân hàng đề" icon="fa-server" color="teal" />
        <SectionButton id="GAME" label="Trò chơi" icon="fa-gamepad" color="orange" />
        <SectionButton id="UPDATE" label="Quản trị" icon="fa-microchip" color="red" />
      </div>

      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-gray-50 overflow-hidden min-h-[650px] flex flex-col">
        {activeSection === 'OVERVIEW' && (
          <div className="p-12 md:p-20 space-y-12 animate-fade-in flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                    <h2 className="text-4xl font-black text-blue-900 leading-tight">Kiến trúc "Local-First" & Bảo mật tuyệt đối</h2>
                    <p className="text-gray-600 text-lg leading-relaxed font-medium">
                      Khác với các nền tảng đám mây thông thường, LMS Core được thiết kế để bảo vệ quyền riêng tư và quyền sở hữu trí tuệ của bạn một cách triệt để.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex flex-col gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm"><i className="fas fa-hdd"></i></div>
                    <h4 className="font-black text-blue-900 text-sm uppercase">Lưu trữ Cục bộ</h4>
                    <p className="text-xs text-blue-700/70 font-bold leading-relaxed">Toàn bộ Ngân hàng đề, Giáo trình PDF và Lịch sử thi được lưu trực tiếp trên ổ cứng máy tính của bạn (AppData/Roaming).</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100 flex flex-col gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm"><i className="fas fa-user-shield"></i></div>
                    <h4 className="font-black text-green-900 text-sm uppercase">Toàn quyền dữ liệu</h4>
                    <p className="text-xs text-green-700/70 font-bold leading-relaxed">Dữ liệu không bao giờ rời khỏi máy trừ khi bạn gửi prompt tới AI. Hãy sao lưu file 'database.json' định kỳ để chuyển máy.</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-[3rem] p-12 border border-gray-100 relative shadow-inner">
                <h3 className="font-black text-gray-800 mb-8 text-xl uppercase tracking-widest flex items-center gap-3">
                   <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span> Lộ trình triển khai
                </h3>
                <ol className="space-y-6">
                  {[
                    "Vào mục 'Cấu hình' -> Nhập Google Gemini API Key cá nhân để kích hoạt bộ não AI.",
                    "Tại 'Tài liệu' -> Tải lên giáo trình PDF (Nguồn điện an toàn & Môi trường) và nhấn 'Huấn luyện'.",
                    "Sử dụng AI Biên soạn tại mục 'Ngân hàng đề' để trích xuất câu hỏi tự động từ PDF.",
                    "Tổ chức thi thử hoặc xuất bản đề thi A4 để phân phối cho sinh viên.",
                    "Khuyến khích sinh viên ôn luyện qua Game Quiz để tăng tính tương tác."
                  ].map((step, i) => (
                    <li key={i} className="flex gap-6 group">
                      <span className="w-10 h-10 bg-white text-blue-600 border border-blue-100 rounded-2xl flex items-center justify-center text-sm font-black flex-shrink-0 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">{i+1}</span>
                      <span className="text-gray-600 text-sm font-bold pt-2">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'CHAT' && (
          <div className="p-12 md:p-20 space-y-8 animate-fade-in flex-1">
             <h2 className="text-3xl font-black text-slate-900">Sử dụng Trợ lý AI Đa phương thức</h2>
             <p className="text-slate-600 text-lg leading-relaxed font-medium">Hệ thống tích hợp Gemini 3 tiên tiến với 2 chế độ tương tác chuyên sâu:</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-6">
                <div className="bg-purple-50 p-10 rounded-[2.5rem] border border-purple-100 space-y-4">
                   <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-lg text-2xl"><i className="fas fa-comment-dots"></i></div>
                   <h3 className="text-xl font-black text-purple-900">Chat Văn bản (RAG-based)</h3>
                   <p className="text-sm text-purple-800/70 font-medium leading-relaxed">Hỏi đáp mọi kiến thức chuyên môn. AI sẽ ưu tiên trích lục từ giáo trình PDF bạn đã nạp để đưa ra câu trả lời chính xác nhất theo đề cương.</p>
                </div>
                <div className="bg-blue-50 p-10 rounded-[2.5rem] border border-blue-100 space-y-4">
                   <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-lg text-2xl"><i className="fas fa-microphone-lines"></i></div>
                   <h3 className="text-xl font-black text-blue-900">Vấn đáp (Live Voice)</h3>
                   <p className="text-sm text-blue-800/70 font-medium leading-relaxed">Chế độ Low-Latency cho phép bạn trình bày kiến thức bằng giọng nói. AI sẽ lắng nghe, phân tích và phân hồi như một Cán bộ quản lý thực thụ.</p>
                </div>
             </div>
             <div className="p-6 bg-slate-900 rounded-3xl text-white/80 text-xs font-bold flex items-center gap-4">
                <i className="fas fa-info-circle text-blue-400"></i>
                Lưu ý: AI sử dụng API Key cá nhân của bạn để đảm bảo tốc độ tối đa và không bị giới hạn bởi người dùng khác.
             </div>
          </div>
        )}

        {activeSection === 'DOCS' && (
          <div className="p-12 md:p-20 space-y-8 animate-fade-in flex-1">
             <h2 className="text-3xl font-black text-slate-900">Quản trị Tri thức RAG (Retrieval-Augmented Generation)</h2>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div className="space-y-6">
                   <p className="text-slate-600 text-lg leading-relaxed font-medium">Đây là "trái tim" của hệ thống, nơi biến các file PDF tĩnh thành bộ não tri thức động.</p>
                   <ul className="space-y-4">
                      <li className="flex gap-4 items-start">
                         <i className="fas fa-check-circle text-green-500 mt-1"></i>
                         <p className="text-sm text-slate-700 font-bold"><strong>Băm nhỏ tri thức:</strong> PDF được chia thành các đoạn văn bản 1000 ký tự để AI dễ dàng truy xuất.</p>
                      </li>
                      <li className="flex gap-4 items-start">
                         <i className="fas fa-check-circle text-green-500 mt-1"></i>
                         <p className="text-sm text-slate-700 font-bold"><strong>Vector hóa:</strong> Sử dụng mô hình 'text-embedding-004' để chuyển đổi văn bản sang ngôn ngữ toán học (Vector).</p>
                      </li>
                      <li className="flex gap-4 items-start">
                         <i className="fas fa-check-circle text-green-500 mt-1"></i>
                         <p className="text-sm text-slate-700 font-bold"><strong>Hỗ trợ đa phương thức:</strong> Đọc hiểu tiếng Việt, công thức LaTeX, bảng biểu và mô tả hình ảnh trong giáo trình.</p>
                      </li>
                   </ul>
                </div>
                <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mẹo vận hành tài liệu</h4>
                   <p className="text-xs text-slate-500 italic leading-relaxed">
                      "Hãy tải lên các file PDF có text (không phải scan ảnh mờ) để đạt hiệu quả trích xuất tri thức cao nhất. Hệ thống hỗ trợ xem trực tiếp tài liệu ngay bên cạnh cửa sổ chat để bạn tiện đối chiếu."
                   </p>
                </div>
             </div>
          </div>
        )}

        {activeSection === 'BANK' && (
          <div className="p-12 md:p-20 space-y-12 animate-fade-in flex-1">
             <h2 className="text-3xl font-black text-slate-900">Quản lý Ngân hàng đề thi Chuyên nghiệp</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm space-y-4">
                   <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center text-xl"><i className="fas fa-folder-tree"></i></div>
                   <h3 className="font-black text-slate-800 text-sm">Cấu trúc Folder</h3>
                   <p className="text-xs text-slate-500 font-medium leading-relaxed">Chia nhỏ ngân hàng câu hỏi theo từng chương hoặc từng chuyên đề (An toàn điện, Môi trường, Nguồn PV...).</p>
                </div>
                <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm space-y-4">
                   <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl"><i className="fas fa-magic"></i></div>
                   <h3 className="font-black text-slate-800 text-sm">AI Biên soạn</h3>
                   <p className="text-xs text-slate-500 font-medium leading-relaxed">Tự động trích xuất câu hỏi trắc nghiệm/tự luận từ giáo trình PDF chỉ với vài giây tính toán.</p>
                </div>
                <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm space-y-4">
                   <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl"><i className="fas fa-print"></i></div>
                   <h3 className="font-black text-slate-800 text-sm">In Đề thi A4</h3>
                   <p className="text-xs text-slate-500 font-medium leading-relaxed">Thiết lập ma trận Bloom (Nhận biết/Thông hiểu/Vận dụng) để sinh đề ngẫu nhiên và xuất file in chuẩn A4.</p>
                </div>
             </div>
             <div className="bg-teal-50 p-8 rounded-[3rem] border border-teal-100">
                <p className="text-teal-900 font-bold leading-relaxed">
                   <strong>Tính năng Ma trận đề thi:</strong> Cho phép trộn ngẫu nhiên thứ tự câu hỏi và phương án, tự động sinh mã đề thi (Mã 101, 102...) để chống quay cóp trong phòng thi.
                </p>
             </div>
          </div>
        )}

        {activeSection === 'GAME' && (
          <div className="p-12 md:p-20 space-y-12 animate-fade-in flex-1">
             <div className="text-center space-y-4">
                <h2 className="text-3xl font-black text-slate-900">Học mà chơi, Chơi mà học</h2>
                <p className="text-slate-600 font-medium">Tăng cường khả năng ghi nhớ thông qua các chế độ trò chơi tương tác cao.</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="flex gap-6 items-start">
                   <div className="w-16 h-16 bg-yellow-400 text-slate-900 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg"><i className="fas fa-coins"></i></div>
                   <div>
                      <h4 className="font-black text-slate-900 text-lg">Ai là triệu phú</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">Mô phỏng gameshow thực tế với 15 câu hỏi và 4 quyền trợ giúp (50:50, Gọi điện cho người thân, Hỏi khán giả, Tổ tư vấn chuyên gia).</p>
                   </div>
                </div>
                <div className="flex gap-6 items-start">
                   <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg"><i className="fas fa-bolt-lightning"></i></div>
                   <div>
                      <h4 className="font-black text-slate-900 text-lg">Thử thách 60 giây</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">Luyện tập khả năng phản xạ nhanh dưới áp lực thời gian. Trả lời đúng liên tiếp để nhận combo điểm thưởng.</p>
                   </div>
                </div>
                <div className="flex gap-6 items-start">
                   <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg"><i className="fas fa-clone"></i></div>
                   <div>
                      <h4 className="font-black text-slate-900 text-lg">Flashcard Thông minh</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">Phương pháp Active Recall giúp ghi nhớ các khái niệm an toàn điện và tiêu chuẩn môi trường một cách bền vững.</p>
                   </div>
                </div>
                <div className="flex gap-6 items-start">
                   <div className="w-16 h-16 bg-purple-600 text-white rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg"><i className="fas fa-microphone"></i></div>
                   <div>
                      <h4 className="font-black text-slate-900 text-lg">Kiểm tra Vấn đáp AI</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">Sinh viên tự trình bày bài học bằng giọng nói, AI sẽ chấm điểm dựa trên độ chính xác của từ khóa và ý hiểu.</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeSection === 'UPDATE' && (
          <div className="p-12 md:p-20 space-y-12 animate-fade-in flex-1">
             <div className="bg-red-50 p-10 rounded-[2.5rem] border border-red-100 flex flex-col md:flex-row items-center gap-8">
                <div className="w-20 h-20 bg-red-600 text-white rounded-3xl flex items-center justify-center text-4xl shrink-0 shadow-2xl shadow-red-200"><i className="fas fa-tools"></i></div>
                <div>
                   <h2 className="text-3xl font-black text-red-900 mb-2">Trung tâm Quản trị & Cập nhật</h2>
                   <p className="text-red-700 font-medium leading-relaxed italic">Quy trình duy trì hệ thống và so sánh phiên bản tự động.</p>
                </div>
             </div>

             <div className="max-w-3xl mx-auto w-full">
                <div className="space-y-6">
                   <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-3">
                      <i className="fas fa-sync-alt text-blue-600"></i> Cơ chế Smart Update
                   </h3>
                   <div className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm space-y-6">
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">Hệ thống sử dụng tệp <strong>version.json</strong> trên máy chủ GitHub để so sánh với phiên bản nội bộ và đưa ra các đề xuất nâng cấp an toàn.</p>
                      <ul className="space-y-4">
                         <li className="flex gap-4">
                            <i className="fas fa-bell text-blue-500 mt-1"></i>
                            <p className="text-xs font-bold text-slate-500">Thông báo đẩy ngay lập tức khi phát hiện bản vá lỗi hoặc tính năng mới từ đội ngũ phát triển.</p>
                         </li>
                         <li className="flex gap-4">
                            <i className="fas fa-scroll text-blue-500 mt-1"></i>
                            <p className="text-xs font-bold text-slate-500">Hiển thị lịch sử thay đổi (Changelog) chi tiết cho mỗi bản nâng cấp để bạn nắm bắt các cải tiến.</p>
                         </li>
                         <li className="flex gap-4">
                            <i className="fas fa-database text-blue-500 mt-1"></i>
                            <p className="text-xs font-bold text-slate-500">Đảm bảo toàn vẹn dữ liệu: Việc cập nhật không làm ảnh hưởng đến cơ sở dữ liệu câu hỏi hiện có của bạn.</p>
                         </li>
                      </ul>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserGuide;
