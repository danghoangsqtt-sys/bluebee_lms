
import React, { useState, useEffect } from 'react';

interface VersionData {
  version: string;
  releaseDate: string;
  changelog: string;
}

const ChangelogModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<VersionData | null>(null);

  useEffect(() => {
    // Sử dụng fetch thay vì import trực tiếp để tránh lỗi module specifier JSON
    const loadVersionData = async () => {
      try {
        const response = await fetch('./version.json');
        if (!response.ok) throw new Error('Không thể tải tệp phiên bản');
        const json: VersionData = await response.json();
        setData(json);

        // Kiểm tra xem người dùng đã xem phiên bản này chưa hoặc vừa mới nâng cấp xong
        const lastSeenVersion = localStorage.getItem('last_seen_version');
        const justUpdated = localStorage.getItem('just_updated');
        
        if (lastSeenVersion !== json.version || justUpdated === 'true') {
          setIsOpen(true);
        }
      } catch (err) {
        console.warn("[DHSYSTEM] Không thể nạp thông tin phiên bản từ local:", err);
      }
    };

    loadVersionData();
  }, []);

  const handleClose = () => {
    if (data) {
      // Lưu lại phiên bản đã xem để không hiện lại lần sau
      localStorage.setItem('last_seen_version', data.version);
    }
    localStorage.removeItem('just_updated');
    setIsOpen(false);
  };

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden border border-white/20 flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full -ml-16 -mb-16 blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                <i className="fas fa-sparkles text-2xl text-yellow-300"></i>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-100 opacity-80">Nâng cấp thành công</span>
                <h4 className="text-[10px] font-black text-white/60 uppercase tracking-widest">AI Self Study System</h4>
              </div>
            </div>
            <h2 className="text-4xl font-black tracking-tighter leading-none mb-2">Chào mừng bạn đến với v{data.version}!</h2>
            <div className="flex items-center gap-2 mt-4">
               <span className="text-[11px] font-black text-indigo-100 bg-white/10 px-3 py-1 rounded-full border border-white/10">{data.releaseDate}</span>
               <span className="text-[11px] font-black text-indigo-100 bg-white/10 px-3 py-1 rounded-full border border-white/10">Build: BLUEBEE-PRO</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-10 flex-1 overflow-y-auto max-h-[350px] custom-scrollbar">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="h-[1px] flex-1 bg-slate-100"></div>
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Bản ghi cập nhật</h4>
               <div className="h-[1px] flex-1 bg-slate-100"></div>
            </div>
            <div className="text-slate-700 text-[15px] leading-relaxed whitespace-pre-line font-bold bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner italic">
              {data.changelog}
            </div>
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-center gap-4">
               <i className="fas fa-info-circle text-blue-600"></i>
               <p className="text-[10px] text-blue-800 font-bold leading-relaxed">Hệ thống AI và Ngân hàng đề của bạn đã được tối ưu hóa theo phiên bản này. Bạn có thể tiếp tục buổi học ngay bây giờ.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-10 pt-0 flex justify-center">
          <button 
            onClick={handleClose}
            className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-[13px] uppercase tracking-[0.25em] shadow-2xl shadow-slate-900/40 hover:bg-blue-600 transition-all active:scale-95 transform"
          >
            Khám phá ngay <i className="fas fa-arrow-right ml-2"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
