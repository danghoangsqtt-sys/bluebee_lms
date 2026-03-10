import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Lấy danh sách lớp để học viên chọn khi đăng ký
  useEffect(() => {
      import('../services/databaseService').then(module => {
          module.databaseService.fetchClasses().then(res => setClasses(res || []));
      });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (password.length < 8) {
        setError("Mật khẩu phải có từ 8 ký tự trở lên!");
        setLoading(false);
        return;
    }

    try {
      if (mode === 'LOGIN') {
        await login(email, password);
      } else {
        if (!fullName.trim()) throw new Error("Vui lòng nhập họ và tên.");
        await register(email, password, fullName, selectedClassId || undefined);
        setSuccessMsg("Tài khoản đã được tạo. Vui lòng chờ Admin phê duyệt để kích hoạt.");
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi xác thực.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex font-[Roboto]">

      {/* ===== LEFT PANEL — Branding (hidden on mobile) ===== */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 relative overflow-hidden flex-col items-center justify-center p-12 text-white">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl -ml-40 -mb-40"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/5 rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-white/5 rounded-full"></div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-md space-y-8">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl mb-2">
            <img src="/logo.png" alt="Logo AI SELF STUDY" className="w-16 h-16 object-contain" />
          </div>

          <div>
            <h1 className="text-4xl font-black tracking-tight leading-tight">
              AI SELF STUDY
            </h1>
            <div className="w-16 h-1 bg-yellow-400 rounded-full mx-auto mt-4 mb-6"></div>
            <p className="text-blue-100 text-base leading-relaxed font-medium">
              Nền tảng học tập thông minh được hỗ trợ bởi trí tuệ nhân tạo. 
              Cá nhân hóa lộ trình học tập và nâng cao hiệu quả giảng dạy.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold border border-white/10">
              <i className="fas fa-robot text-yellow-400"></i>
              <span>AI Soạn thảo</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold border border-white/10">
              <i className="fas fa-book-open text-yellow-400"></i>
              <span>Học liệu thông minh</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold border border-white/10">
              <i className="fas fa-chart-line text-yellow-400"></i>
              <span>Theo dõi tiến độ</span>
            </div>
          </div>
        </div>

        {/* Bottom watermark */}
        <div className="absolute bottom-8 text-center w-full">
          <p className="text-blue-200/40 text-xs font-bold uppercase tracking-widest">Powered by BlueBee Education</p>
        </div>
      </div>

      {/* ===== RIGHT PANEL — Auth Form ===== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-6 sm:p-10 relative">
        {/* Mobile-only subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white lg:hidden"></div>

        <div className="relative z-10 w-full max-w-[420px] space-y-8">
          
          {/* Header */}
          <div className="text-center lg:text-left">
            {/* Mobile-only logo */}
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
              <img src="/logo.png" alt="Logo AI SELF STUDY" className="w-11 h-11 object-contain rounded-xl shadow-lg" />
              <span className="text-xl font-black text-slate-800 tracking-tight">AI SELF STUDY</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">
              {mode === 'LOGIN' ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {mode === 'LOGIN' ? 'Đăng nhập để tiếp tục hành trình học tập' : 'Đăng ký để bắt đầu hành trình mới'}
            </p>
          </div>

          {/* Error / Success alerts */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-start gap-3 rounded-xl">
              <i className="fas fa-exclamation-circle mt-0.5 text-red-400"></i>
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-green-50 border border-green-100 text-green-700 text-sm font-medium flex items-start gap-3 rounded-xl">
              <i className="fas fa-check-circle mt-0.5 text-green-500"></i>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-5">
            {mode === 'SIGNUP' && (
              <div className="space-y-1.5 animate-slide-up">
                <label className="text-sm font-semibold text-slate-600 ml-0.5">Họ và Tên</label>
                <input 
                  type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-600 ml-0.5">Email</label>
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@domain.edu.vn"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-600 ml-0.5">Mật khẩu</label>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
              />
              {mode === 'SIGNUP' && <p className="text-xs text-slate-400 pl-0.5">Tối thiểu 8 ký tự</p>}
            </div>

            {mode === 'SIGNUP' && (
              <div className="space-y-1.5 animate-slide-up">
                <label className="text-sm font-semibold text-slate-600 ml-0.5">Đăng ký vào Lớp học</label>
                <select 
                  title="Chọn lớp học"
                  value={selectedClassId} 
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">-- Tôi là học viên tự do (Chờ phân lớp) --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-amber-600 pl-0.5">
                  Tài khoản đăng ký mới sẽ được Admin phê duyệt trước khi kích hoạt.
                </p>
              </div>
            )}

            <button 
              type="submit" disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2.5"
            >
              {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className={`fas ${mode === 'LOGIN' ? 'fa-arrow-right' : 'fa-user-plus'}`}></i>}
              {mode === 'LOGIN' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="text-center pt-2">
            <p className="text-slate-400 text-sm">
              {mode === 'LOGIN' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
              <button 
                onClick={() => { setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN'); setError(null); setSuccessMsg(null); }}
                className="ml-1.5 text-blue-600 font-semibold hover:text-blue-700 hover:underline transition-colors"
              >
                {mode === 'LOGIN' ? 'Đăng ký ngay' : 'Đăng nhập'}
              </button>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;