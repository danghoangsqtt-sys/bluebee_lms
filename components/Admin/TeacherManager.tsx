import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';
import { UserProfile } from '../../types';
import { createAuthUserAsAdmin, databaseService } from '../../services/databaseService';

interface TeacherManagerProps {
  onNotify: (message: string, type: any) => void;
}

const TeacherManager: React.FC<TeacherManagerProps> = ({ onNotify }) => {
  const [activeTab, setActiveTab] = useState<'TEACHERS' | 'CANDIDATES'>('TEACHERS');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Teacher Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState(''); // NEW Field
  const [isCreating, setIsCreating] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const response = await databases.listDocuments(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        [
            Query.equal('role', ['teacher', 'student']),
            Query.orderDesc('$createdAt')
        ]
      );

      setUsers(response.documents.map(d => ({
        id: d.$id,
        email: d.email || 'N/A', 
        fullName: d.full_name || 'Người dùng hệ thống',
        role: d.role,
        avatarUrl: d.avatar_url,
        status: d.status || 'active'
      })));
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: 'teacher' | 'student') => {
    const actionName = newRole === 'teacher' ? 'Thăng cấp Cán bộ' : 'Hủy quyền Cán bộ';
    if (!window.confirm(`Xác nhận hành động: ${actionName} cho người dùng này?`)) return;

    try {
      await databases.updateDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        userId,
        { role: newRole }
      );

      onNotify(`${actionName} thành công!`, 'success');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
      if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${userName}" không? Dữ liệu không thể khôi phục.`)) return;

      try {
          await databaseService.deleteUserProfileAndAuth(userId);
          onNotify(`Đã xóa vĩnh viễn tài khoản ${userName}.`, "success");
          setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (err: any) {
          onNotify("Lỗi xóa tài khoản: " + err.message, "error");
      }
  };

  const handleAddTeacher = async () => {
    if (!newTeacherName.trim() || !newTeacherEmail.trim() || !newTeacherPassword.trim()) {
        onNotify("Vui lòng nhập tên, email và mật khẩu.", "warning");
        return;
    }

    if (newTeacherPassword.length < 8) {
        onNotify("Mật khẩu phải có ít nhất 8 ký tự.", "warning");
        return;
    }
    
    setIsCreating(true);
    try {
        // 1. Tạo Auth User
        const authUser = await createAuthUserAsAdmin(newTeacherEmail, newTeacherPassword, newTeacherName);

        // 2. Tạo Profile Document với ID trùng khớp
        await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.profiles,
            authUser.$id, 
            {
                full_name: newTeacherName,
                email: newTeacherEmail,
                role: 'teacher',
                status: 'active', // Teachers created by admin are active by default
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(newTeacherName)}&background=random&color=fff`
            }
        );

        onNotify("Đã tạo tài khoản Cán bộ thành công.", "success");
        setShowAddModal(false);
        setNewTeacherName('');
        setNewTeacherEmail('');
        setNewTeacherPassword('');
        fetchProfiles();
    } catch (err: any) {
        onNotify(err.message, 'error');
    } finally {
        setIsCreating(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'TEACHERS') return u.role === 'teacher' && matchSearch;
    return u.role === 'student' && matchSearch; 
  });

  return (
    <div className="p-8 animate-fade-in font-[Roboto]">
      <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
         <div className="flex-1">
            <h4 className="text-sm font-black text-slate-800 uppercase mb-2 flex items-center gap-2">
                <i className="fas fa-server text-blue-600"></i> Quản trị Nhân sự
            </h4>
            <p className="text-xs text-slate-600 font-medium">
               Hệ thống cho phép tạo trực tiếp tài khoản Cán bộ với mật khẩu khởi tạo. Vui lòng bàn giao thông tin đăng nhập an toàn.
            </p>
         </div>
         <div className="flex gap-3">
            <button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg">
                <i className="fas fa-plus"></i> Thêm Cán bộ quản lý mới
            </button>
            <button onClick={fetchProfiles} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-2 shadow-sm shrink-0">
                <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i> Tải lại
            </button>
         </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-chalkboard-user text-blue-600"></i> Danh sách Tài khoản
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Phân quyền Cán bộ & Đào tạo</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setActiveTab('TEACHERS')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'TEACHERS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}><i className="fas fa-user-tie"></i> Cán bộ</button>
            <button onClick={() => setActiveTab('CANDIDATES')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'CANDIDATES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}><i className="fas fa-users"></i> Học viên</button>
        </div>
      </div>

      <div className="mb-6 relative max-w-md">
         <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
         <input type="text" placeholder={activeTab === 'TEACHERS' ? "Tìm Cán bộ quản lý (Tên, Email)..." : "Tìm học viên..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-sm text-sm font-bold text-slate-700 outline-none focus:border-blue-900 transition-all" />
      </div>

      <div className="bg-white border border-slate-300 rounded-sm overflow-hidden min-h-[400px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="px-4 py-3 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-left w-12">STT</th>
              <th className="px-4 py-3 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-left w-32">Mã ID</th>
              <th className="px-4 py-3 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-left">Họ và Tên</th>
              <th className="px-4 py-3 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-left">Email Hệ thống</th>
              <th className="px-4 py-3 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-left w-24">Vai trò</th>
              <th className="px-4 py-3 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-center w-40">Thao tác Tác chiến</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400">
                  <i className="fas fa-circle-notch fa-spin text-2xl mb-2"></i>
                  <p className="text-[10px] font-bold uppercase tracking-widest">Đang truy xuất dữ liệu...</p>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-300 uppercase font-black text-xs tracking-widest bg-slate-50">
                  Không tìm thấy dữ liệu phù hợp
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, index) => (
                <tr key={user.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 border border-slate-300 text-xs font-bold text-slate-500 text-center">{index + 1}</td>
                  <td className="px-4 py-3 border border-slate-300 text-xs">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(user.id);
                        onNotify('Đã copy ID: ' + user.id, 'success');
                      }}
                      title="Click để copy ID"
                      className="px-2 py-1 bg-slate-100 hover:bg-blue-900 hover:text-white text-blue-900 font-mono font-bold text-[10px] rounded-sm transition-all flex items-center gap-2 border border-slate-200"
                    >
                      {user.id.substring(0, 8)}... <i className="far fa-copy"></i>
                    </button>
                  </td>
                  <td className="px-4 py-3 border border-slate-300">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-user text-slate-300"></i>}
                      </div>
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{user.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border border-slate-300 text-xs font-bold text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 border border-slate-300">
                    <span className={`px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-widst border ${user.role === 'teacher' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                      {user.role === 'teacher' ? 'Cán bộ' : 'Học viên'}
                    </span>
                  </td>
                  <td className="px-4 py-3 border border-slate-300">
                    <div className="flex justify-center gap-2">
                      {activeTab === 'TEACHERS' ? (
                        <button 
                          onClick={() => handleUpdateRole(user.id, 'student')}
                          title="Hủy quyền Cán bộ"
                          className="w-8 h-8 bg-orange-100 text-orange-600 border border-orange-200 hover:bg-orange-600 hover:text-white rounded-sm transition-all flex items-center justify-center"
                        >
                          <i className="fas fa-user-minus text-xs"></i>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUpdateRole(user.id, 'teacher')}
                          title="Thăng cấp Cán bộ"
                          className="w-8 h-8 bg-blue-100 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white rounded-sm transition-all flex items-center justify-center"
                        >
                          <i className="fas fa-user-plus text-xs"></i>
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteUser(user.id, user.fullName)}
                        title="Xóa vĩnh viễn"
                        className="w-8 h-8 bg-red-100 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded-sm transition-all flex items-center justify-center"
                      >
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl animate-slide-up border-t-4 border-blue-600">
            <div className="mb-8"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thêm Cán bộ</h3></div>
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Họ và Tên</label>
                <input type="text" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white font-bold text-sm text-slate-800 transition-all" autoFocus placeholder="Ví dụ: Nguyễn Văn A" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Email Đăng nhập</label>
                <input type="email" value={newTeacherEmail} onChange={e => setNewTeacherEmail(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white font-bold text-sm text-slate-800 transition-all" placeholder="teacher@domain.edu.vn" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Mật khẩu Khởi tạo</label>
                <input type="password" value={newTeacherPassword} onChange={e => setNewTeacherPassword(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white font-bold text-sm text-slate-800 transition-all" placeholder="Tối thiểu 8 ký tự" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                <button onClick={handleAddTeacher} disabled={isCreating} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all disabled:opacity-70">{isCreating ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default TeacherManager;