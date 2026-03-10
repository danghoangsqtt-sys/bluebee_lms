import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { databases, APPWRITE_CONFIG, account } from '../lib/appwrite';
import { databaseService } from '../services/databaseService';

interface ProfileSettingsProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onNotify }) => {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  
  // Không dùng state avatarUrl để upload nữa, chỉ hiển thị
  const [displayAvatar, setDisplayAvatar] = useState('');
  const [classNameDisplay, setClassNameDisplay] = useState('Đang tải...');

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingPass, setLoadingPass] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setDisplayAvatar(user.avatarUrl || '');
      
      // Lấy tên lớp học để hiển thị
      const getClassName = async () => {
        if (user.role === 'admin' || user.role === 'teacher') {
            setClassNameDisplay(user.role === 'admin' ? 'Quản trị viên' : 'Cán bộ quản lý');
            return;
        }
        
        const cId = user.classId || (user as any).class_id;
        if (!cId) {
            setClassNameDisplay('Chưa được biên chế lớp');
            return;
        }
        
        try {
            const classes = await databaseService.fetchClasses();
            const myClass = classes.find(c => c.id === cId);
            setClassNameDisplay(myClass ? myClass.name : `Lớp ID: ${cId}`);
        } catch (error) {
            setClassNameDisplay('Không thể tải tên lớp');
        }
      };
      
      getClassName();
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Tự động cập nhật lại link avatar theo tên mới
      const newAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`;
      
      await databases.updateDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        user.id,
        { 
            full_name: fullName,
            avatar_url: newAvatarUrl
        }
      );
      
      await refreshProfile();
      onNotify("Cập nhật thông tin thành công.", "success");
    } catch (err: any) {
      onNotify(err.message || "Lỗi cập nhật hồ sơ.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
      if (!newPassword || newPassword.length < 8) {
          onNotify("Mật khẩu mới phải có ít nhất 8 ký tự.", "warning");
          return;
      }
      if (!oldPassword) {
          onNotify("Vui lòng nhập mật khẩu hiện tại.", "warning");
          return;
      }

      setLoadingPass(true);
      try {
          await account.updatePassword(newPassword, oldPassword);
          onNotify("Đổi mật khẩu thành công!", "success");
          setOldPassword('');
          setNewPassword('');
      } catch (err: any) {
          onNotify(err.message || "Lỗi đổi mật khẩu. Kiểm tra lại mật khẩu cũ.", "error");
      } finally {
          setLoadingPass(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-[Roboto] text-slate-800 pb-20">
      {/* HEADER COMMAND BAR */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-900 flex items-center justify-center text-white">
              <i className="fas fa-user-shield"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-blue-900 uppercase tracking-[0.2em]">Hồ sơ Quân tử</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Vị trí: {classNameDisplay} / Identity Verified</p>
            </div>
          </div>
          <div className="flex gap-4">
             <button 
                onClick={handleUpdateProfile} 
                disabled={loading}
                className="px-8 py-3 bg-blue-900 text-white font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-slate-800 transition-all border border-blue-900 disabled:opacity-50"
             >
                {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                Lưu hồ sơ
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-16 space-y-24">
        
        {/* SECTION 1: MILITARY IDENTITY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
          <div className="space-y-4">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/5 border border-blue-900/10 text-blue-900 text-[10px] font-bold uppercase tracking-widest">
                <i className="fas fa-id-badge"></i> Thông tin định danh
             </div>
             <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">Hồ sơ cá nhân</h2>
             <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase tracking-tighter">
                Quản lý thông tin hiển thị và vị trí biên chế trong hệ thống AI SELF STUDY. Thông tin này sẽ xuất hiện trên các chứng chỉ và báo cáo học tập.
             </p>
          </div>

          <div className="lg:col-span-2 space-y-8">
             <div className="bg-white border border-slate-300 p-10 shadow-sm rounded-sm">
                <div className="flex flex-col md:flex-row gap-12 items-center md:items-start text-center md:text-left">
                   <div className="relative group">
                      <div className="w-40 h-40 border-4 border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden rounded-sm">
                          {displayAvatar ? (
                              <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                              <span className="text-5xl font-bold text-blue-900">{fullName?.charAt(0)}</span>
                          )}
                      </div>
                      <div className="mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-tighter text-center">
                          * Avatar định danh tự động
                      </div>
                   </div>

                   <div className="flex-1 space-y-6 w-full">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Vai trò hệ thống</label>
                            <div className="w-full p-4 bg-slate-100 border border-slate-200 font-bold text-slate-500 text-sm rounded-sm uppercase tracking-wider">
                               {user?.role}
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Vị trí / Lớp học</label>
                            <div className="w-full p-4 bg-slate-100 border border-slate-200 font-bold text-slate-500 text-sm rounded-sm uppercase tracking-wider">
                               {classNameDisplay}
                            </div>
                         </div>
                      </div>

                         <div className="space-y-2">
                            <label htmlFor="user-email" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Email chính thức</label>
                            <input 
                               id="user-email"
                               type="text" 
                               value={user?.email || ''} 
                               disabled 
                               className="w-full p-4 bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed text-sm rounded-sm" 
                            />
                         </div>

                         <div className="space-y-2">
                            <label htmlFor="user-full-name" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Họ và tên quân nhân / học viên</label>
                            <input 
                               id="user-full-name"
                               type="text" 
                               value={fullName} 
                               onChange={(e) => setFullName(e.target.value)} 
                               className="w-full p-4 bg-white border border-slate-300 font-bold text-blue-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-sm rounded-sm" 
                            />
                         </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* SECTION 2: ACCESS SECURITY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start border-t border-slate-200 pt-24">
          <div className="space-y-4">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/5 border border-blue-900/10 text-blue-900 text-[10px] font-bold uppercase tracking-widest">
                <i className="fas fa-lock"></i> Bảo mật truy cập
             </div>
             <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">An ninh Tài khoản</h2>
             <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase tracking-tighter">
                Thay đổi mật khẩu Access thường xuyên để bảo vệ dữ liệu cá nhân và quá trình học tập của bạn. Sử dụng mật khẩu phức tạp để tăng cường bảo mật.
             </p>
          </div>

          <div className="lg:col-span-2 space-y-8">
             <div className="bg-white border border-slate-300 p-10 shadow-sm rounded-sm">
                <div className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                         <label htmlFor="old-password" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Mật khẩu hiện tại</label>
                         <input 
                            id="old-password"
                            type="password" 
                            value={oldPassword} 
                            onChange={(e) => setOldPassword(e.target.value)} 
                            className="w-full p-4 bg-white border border-slate-300 font-bold text-blue-900 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 text-sm rounded-sm" 
                            placeholder="••••••••" 
                         />
                      </div>
                      <div className="space-y-2">
                         <label htmlFor="new-password" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Mật khẩu mới</label>
                         <input 
                            id="new-password"
                            type="password" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                            className="w-full p-4 bg-white border border-slate-300 font-bold text-blue-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 text-sm rounded-sm" 
                            placeholder="Tối thiểu 8 ký tự" 
                         />
                      </div>
                   </div>

                   <div className="flex justify-end pt-6 border-t border-slate-100">
                      <button 
                        onClick={handleChangePassword} 
                        disabled={loadingPass}
                        className="px-8 py-4 bg-white border border-blue-900 text-blue-900 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all rounded-sm disabled:opacity-50"
                      >
                         {loadingPass ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-key mr-2"></i>}
                         Xác nhận đổi mật khẩu
                      </button>
                   </div>
                </div>
             </div>

             <div className="bg-slate-900 p-10 rounded-sm text-white flex items-center gap-8 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>
                <div className="w-16 h-16 border border-white/20 flex items-center justify-center text-3xl text-yellow-500">
                   <i className="fas fa-exclamation-triangle"></i>
                </div>
                <div>
                   <h4 className="text-sm font-bold uppercase tracking-widest mb-1 text-yellow-500">Chính sách Bảo mật</h4>
                   <p className="text-xs text-slate-400 font-light max-w-lg leading-relaxed uppercase tracking-tighter">
                      Nếu phát hiện truy cập bất thường, vui lòng đặt lại mật khẩu ngay lập tức và liên hệ với Quản trị viên hệ thống để kiểm tra nhật ký Access.
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

export default ProfileSettings;