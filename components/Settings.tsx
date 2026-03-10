
import React, { useState, useEffect } from 'react';
import { AppSettings, AppVersionInfo } from '../types';
import { checkAppUpdate } from '../services/updateService';
import { validateApiKey } from '../services/geminiService';
import pkg from '../package.json';

interface SettingsProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  modelName: 'gemini-2.5-flash',
  aiVoice: 'Zephyr',
  temperature: 0.7,
  maxOutputTokens: 2048,
  autoSave: true,
  ragTopK: 5,
  thinkingBudget: 0,
  systemExpertise: 'ACADEMIC'
};

const Settings: React.FC<SettingsProps> = ({ onNotify }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    if (parsed.modelName === 'gemini-1.5-flash' || parsed.modelName === 'gemini-3-flash-preview') {
        parsed.modelName = 'gemini-2.5-flash';
        localStorage.setItem('app_settings', JSON.stringify(parsed));
    }
    return parsed;
  });

  const [kbSize, setKbSize] = useState(0);
  
  // API Key State
  const [customApiKey, setCustomApiKey] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'IDLE' | 'TESTING' | 'VALID' | 'INVALID'>('IDLE');

  useEffect(() => {
    const kb = JSON.parse(localStorage.getItem('knowledge_base') || '[]');
    setKbSize(kb.length);
    if (settings.modelName === 'gemini-1.5-flash' || settings.modelName === 'gemini-3-flash-preview') {
        const newSettings = { ...settings, modelName: 'gemini-2.5-flash' };
        setSettings(newSettings);
        localStorage.setItem('app_settings', JSON.stringify(newSettings));
        onNotify("Đã tự động chuyển về Gemini 2.5 Flash để đảm bảo ổn định.", "info");
    }

    // Load custom API key
    const storedKey = localStorage.getItem('DTS_GEMINI_API_KEY');
    if (storedKey) {
        setCustomApiKey(storedKey);
        setKeyStatus('IDLE'); // Assuming valid if previously stored, or allow re-test
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
    onNotify("Đã lưu cấu hình hệ thống LMS.", "success");
  };

  const handleSaveApiKey = () => {
    if (!customApiKey.trim()) {
        onNotify("Vui lòng nhập API Key hợp lệ.", "warning");
        return;
    }
    localStorage.setItem('DTS_GEMINI_API_KEY', customApiKey.trim());
    onNotify("Đã lưu Gemini API Key cá nhân.", "success");
    setKeyStatus('IDLE');
  };

  const handleTestApiKey = async () => {
    if (!customApiKey) return;
    setKeyStatus('TESTING');
    const isValid = await validateApiKey(customApiKey);
    if (isValid) {
        setKeyStatus('VALID');
        onNotify("Kết nối Gemini thành công!", "success");
    } else {
        setKeyStatus('INVALID');
        onNotify("API Key không hợp lệ hoặc hết hạn mức.", "error");
    }
  };

  const handleDeleteApiKey = () => {
    localStorage.removeItem('DTS_GEMINI_API_KEY');
    setCustomApiKey('');
    setKeyStatus('IDLE');
    onNotify("Đã xóa Key cá nhân. Hệ thống sẽ sử dụng Key mặc định.", "info");
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        questions: JSON.parse(localStorage.getItem('questions') || '[]'),
        folders: JSON.parse(localStorage.getItem('question_folders') || '[]'),
        docs: JSON.parse(localStorage.getItem('elearning_docs') || '[]'),
        knowledgeBase: JSON.parse(localStorage.getItem('knowledge_base') || '[]'),
        settings: settings,
        exportDate: new Date().toISOString(),
        system: "LMS Core Management"
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `LMS_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      onNotify("Đã xuất dữ liệu sao lưu thành công.", "success");
    } catch (err) {
      onNotify("Lỗi khi tạo bản sao lưu.", "error");
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.system || !data.system.includes("LMS")) {
          throw new Error("Tệp không đúng định dạng sao lưu của Hệ thống LMS.");
        }

        if (window.confirm("CẢNH BÁO: Hành động này sẽ thay thế toàn bộ dữ liệu hiện tại bằng dữ liệu từ bản sao lưu. Tiếp tục?")) {
          if (data.questions) localStorage.setItem('questions', JSON.stringify(data.questions));
          if (data.folders) localStorage.setItem('question_folders', JSON.stringify(data.folders));
          if (data.docs) localStorage.setItem('elearning_docs', JSON.stringify(data.docs));
          if (data.knowledgeBase) localStorage.setItem('knowledge_base', JSON.stringify(data.knowledgeBase));
          if (data.settings) {
              localStorage.setItem('app_settings', JSON.stringify(data.settings));
              setSettings(data.settings);
          }
          
          onNotify("Khôi phục dữ liệu thành công! Hệ thống đang tải lại...", "success");
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (err: any) {
        onNotify(err.message || "Lỗi khi nhập tệp sao lưu.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const clearAllData = () => {
    if (window.confirm("CẢNH BÁO: Hành động này sẽ xóa toàn bộ Câu hỏi, Tri thức RAG và Giáo trình đã nạp. Bạn có chắc chắn?")) {
      localStorage.removeItem('questions');
      localStorage.removeItem('knowledge_base');
      localStorage.removeItem('elearning_docs');
      localStorage.removeItem('question_folders');
      onNotify("Đã xóa sạch bộ nhớ hệ thống. Đang tải lại...", "info");
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-[Roboto] text-slate-800 pb-20">
      {/* BẢNG ĐIỀU KHIỂN CẤU HÌNH */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-900 flex items-center justify-center text-white">
              <i className="fas fa-microchip"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-blue-900 uppercase tracking-[0.2em]">CẤU HÌNH HỆ THỐNG</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tùy chỉnh các thông số hiển thị và cá nhân hóa không gian học tập của bạn.</p>
            </div>
          </div>
          <button 
            onClick={saveSettings} 
            className="px-10 py-3 bg-blue-900 text-white font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-slate-800 transition-all border border-blue-900"
          >
            Lưu thay đổi [Enter]
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-16 space-y-24">
        
        {/* SECTION 1: AI CORE ENGINE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
          <div className="space-y-4">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/5 border border-blue-900/10 text-blue-900 text-[10px] font-bold uppercase tracking-widest">
                <i className="fas fa-brain"></i> Trí tuệ cốt lõi
             </div>
             <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">LÕI TRÍ TUỆ NHÂN TẠO (AI CORE)</h2>
             <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase tracking-tighter">
                Cấu hình kết nối API Gemini và tham số xử lý ngôn ngữ tự nhiên cho hệ thống RAG và sinh đề thi.
             </p>
          </div>

          <div className="lg:col-span-2 space-y-8">
             <div className="bg-white border border-slate-300 p-10 shadow-sm rounded-sm">
                <div className="space-y-8">
                   <div className="space-y-4">
                      <label htmlFor="gemini-api-key" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Gemini API Key (BYOK)</label>
                      <div className="flex gap-3">
                         <div className="relative flex-1">
                            <input 
                              id="gemini-api-key"
                              title="Gemini API Key"
                              type={isKeyVisible ? "text" : "password"} 
                              value={customApiKey}
                              onChange={(e) => { setCustomApiKey(e.target.value); setKeyStatus('IDLE'); }}
                              placeholder="Dán mã API Key tại đây..."
                              className={`w-full p-4 bg-slate-50 border font-bold text-blue-900 outline-none transition-all text-sm rounded-sm ${keyStatus === 'VALID' ? 'border-green-600 focus:ring-green-600' : keyStatus === 'INVALID' ? 'border-red-600 focus:ring-red-600' : 'border-slate-300 focus:border-blue-900 focus:ring-1 focus:ring-blue-900'}`}
                            />
                            <button 
                                title={isKeyVisible ? "Ẩn mã Key" : "Hiện mã Key"}
                                onClick={() => setIsKeyVisible(!isKeyVisible)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-900"
                            >
                                <i className={`fas ${isKeyVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                         </div>
                         <button 
                            onClick={handleSaveApiKey}
                            className="bg-blue-900 text-white px-8 py-4 font-bold text-xs uppercase tracking-widest hover:bg-slate-800 border border-blue-900 transition-all rounded-sm"
                         >
                            Cập nhật
                         </button>
                      </div>
                   </div>

                   {/* Hướng dẫn lấy API Key */}
                   <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-sm">
                      <h4 className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <i className="fas fa-info-circle text-blue-500"></i> Hướng dẫn lấy API Key Google Gemini
                      </h4>
                      <ol className="list-decimal list-inside text-xs text-slate-700 space-y-2 mb-4 font-medium">
                         <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">Google AI Studio</a> và đăng nhập bằng tài khoản Google.</li>
                         <li>Nhấn nút <strong>Create API Key</strong> trong giao diện.</li>
                         <li>Tạo Key mới cho một project (hoặc chọn project có sẵn) và <strong>Copy</strong> đoạn mã hiển thị.</li>
                         <li>Dán đoạn mã vừa copy vào ô bên trên và chọn <strong>Cập nhật</strong>.</li>
                      </ol>
                      <a href="https://www.youtube.com/results?search_query=H%C6%B0%E1%BB%9Bng+d%E1%BA%ABn+l%E1%BA%A5y+API+KEY+c%E1%BB%A7a+Google+Gemini" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-red-700 transition-all shadow-sm">
                         <i className="fab fa-youtube text-sm"></i> Xem Video Hướng Dẫn
                      </a>
                   </div>

                   <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                      <div className="flex gap-4">
                         <button 
                            title="Kiểm tra kết nối API"
                            onClick={handleTestApiKey} 
                            disabled={keyStatus === 'TESTING' || !customApiKey}
                            className={`px-6 py-3 font-bold text-[10px] uppercase tracking-widest border transition-all flex items-center gap-2 rounded-sm ${
                                keyStatus === 'VALID' ? 'bg-green-50 text-green-700 border-green-600' :
                                keyStatus === 'INVALID' ? 'bg-red-50 text-red-700 border-red-600' :
                                'bg-white text-blue-900 border-slate-300 hover:bg-slate-50'
                            }`}
                         >
                            {keyStatus === 'TESTING' ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-signal"></i>}
                            Kiểm tra kết nối
                         </button>

                         {customApiKey && (
                            <button 
                                title="Xóa mã Key cá nhân"
                                onClick={handleDeleteApiKey}
                                className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest border border-slate-300 text-red-600 hover:bg-red-50 transition-all rounded-sm"
                            >
                                <i className="fas fa-trash-alt mr-2"></i> Xóa định danh
                            </button>
                         )}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase italic">
                         * Key được lưu trữ cục bộ (Local Encrypted)
                      </span>
                   </div>
                </div>
             </div>

             <div className="bg-white border border-slate-300 p-10 shadow-sm rounded-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="space-y-4">
                      <label htmlFor="ai-model-select" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Mô hình AI vận hành</label>
                      <select 
                        id="ai-model-select"
                        title="Chọn mô hình AI"
                        value={settings.modelName} 
                        onChange={e => setSettings({...settings, modelName: e.target.value})} 
                        className="w-full p-4 bg-slate-50 border border-slate-300 font-bold text-blue-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 rounded-sm text-sm"
                      >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Academic Standard)</option>
                      </select>
                   </div>

                   <div className="space-y-4">
                      <label htmlFor="ai-role-select" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Vai trò Trợ lý AI</label>
                      <select 
                        id="ai-role-select"
                        title="Chọn vai trò AI"
                        value={settings.systemExpertise} 
                        onChange={e => setSettings({...settings, systemExpertise: e.target.value as any})} 
                        className="w-full p-4 bg-slate-50 border border-slate-300 font-bold text-blue-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 rounded-sm text-sm"
                      >
                        <option value="ACADEMIC">Cán bộ quản lý</option>
                        <option value="FIELD_EXPERT">Kỹ sư</option>
                        <option value="STUDENT_ASSISTANT">Trợ giảng Hệ thống</option>
                      </select>
                   </div>

                   <div className="col-span-full space-y-6 pt-6 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                        <label htmlFor="temperature-range" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest">Độ biến thiên (Temperature)</label>
                        <span className="px-3 py-1 bg-blue-900 text-white font-bold text-[10px] rounded-sm">{settings.temperature}</span>
                      </div>
                      <input 
                        id="temperature-range"
                        title="Điều chỉnh độ sáng tạo AI"
                        type="range" min="0" max="1" step="0.1" 
                        value={settings.temperature} 
                        onChange={e => setSettings({...settings, temperature: parseFloat(e.target.value)})} 
                        className="w-full h-1.5 bg-slate-200 appearance-none accent-blue-900 cursor-pointer rounded-full" 
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                         <span>Chế độ: Chính xác Tuyệt đối</span>
                         <span>Chế độ: Cân bằng Hệ thống</span>
                         <span>Chế độ: Sáng tạo Linh hoạt</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* SECTION 2: QUẢN TRỊ DỮ LIỆU */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start border-t border-slate-200 pt-24">
          <div className="space-y-4">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/5 border border-blue-900/10 text-blue-900 text-[10px] font-bold uppercase tracking-widest">
                <i className="fas fa-server"></i> Quản trị Dữ liệu
             </div>
             <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">QUẢN TRỊ DỮ LIỆU & SAO LƯU</h2>
             <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase tracking-tighter">
                Xuất hoặc nhập file JSON chứa toàn bộ Ngân hàng câu hỏi, Thư mục và Cấu hình cá nhân để di chuyển giữa các máy tính.
             </p>
          </div>

          <div className="lg:col-span-2 space-y-8">
             <div className="bg-white border border-slate-300 p-10 shadow-sm rounded-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="p-8 border border-slate-100 bg-slate-50 relative group">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Tệp tin Vector RAG</h4>
                      <div className="text-3xl font-bold text-blue-900">{kbSize}</div>
                      <p className="text-[9px] text-slate-500 mt-2 italic uppercase">Đơn vị Knowledge Items</p>
                      <i className="fas fa-database absolute bottom-4 right-4 text-slate-200 text-4xl group-hover:text-blue-900/10 transition-colors"></i>
                   </div>

                   <div className="flex flex-col gap-3 justify-center">
                      <button 
                        title="Sao lưu dữ liệu ra file JSON"
                        onClick={handleExportBackup} 
                        className="flex items-center justify-between p-4 bg-white border border-blue-900 text-blue-900 font-bold text-xs uppercase tracking-widest hover:bg-blue-50 transition-all rounded-sm"
                      >
                         <span>Sao lưu (Export)</span>
                         <i className="fas fa-download"></i>
                      </button>
                      <label title="Khôi phục dữ liệu từ file JSON" className="flex items-center justify-between p-4 bg-blue-900 text-white font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all rounded-sm cursor-pointer">
                         <span>Khôi phục (Import)</span>
                         <i className="fas fa-upload"></i>
                         <input title="Chọn file sao lưu" type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
                      </label>
                   </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-center">
                   <p className="text-[10px] text-slate-500 font-bold uppercase mb-4 tracking-tighter text-center">
                      Xóa sạch toàn bộ dữ liệu trong LocalStorage (Câu hỏi, Tài liệu, Settings). Hành động này không thể hoàn tác.
                   </p>
                   <button 
                    title="Xóa toàn bộ dữ liệu ứng dụng"
                    onClick={clearAllData} 
                    className="px-12 py-3 border border-red-600/20 bg-red-600/5 text-red-600 font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all rounded-sm"
                   >
                      <i className="fas fa-radiation mr-2"></i> KHÔI PHỤC CÀI ĐẶT GỐC
                   </button>
                </div>
             </div>

             <div className="bg-blue-900 p-10 rounded-sm text-white flex items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
                <div className="w-16 h-16 border border-white/20 flex items-center justify-center text-3xl">
                   <i className="fas fa-shield-alt"></i>
                </div>
                <div>
                   <h4 className="text-sm font-bold uppercase tracking-widest mb-1">Quyền riêng tư</h4>
                   <p className="text-xs text-blue-100 font-light max-w-lg leading-relaxed uppercase tracking-tighter">
                      Hệ thống ưu tiên bảo mật dữ liệu. Thông tin học tập của bạn được xử lý minh bạch và tuân thủ các tiêu chuẩn an toàn thông tin.
                   </p>
                </div>
             </div>
          </div>
        </div>

        {/* COPYRIGHT STAMP */}
        <footer className="text-xs text-slate-400 font-medium text-center mt-12 py-6 border-t border-slate-200 uppercase tracking-widest">
           © Bản quyền thuộc về DHsystem. Phân phối độc quyền cho AI SELF STUDY.
        </footer>
      </main>
    </div>
  );
};

export default Settings;
