import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';

export default function StudentApproval() {
    const [students, setStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Tách biệt 2 trạng thái để Admin dễ kiểm soát
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED'>('PENDING');

    // UI States for Student Creation
    const [showAddModal, setShowAddModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newStudent, setNewStudent] = useState({ 
        fullName: '', 
        email: '', 
        password: '', 
        classId: '' 
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const cls = await databaseService.fetchClasses();
            setClasses(cls || []);

            // Gọi trực tiếp Appwrite để đảm bảo lấy đủ 100% các cột (đặc biệt là created_by)
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.dbId, 
                APPWRITE_CONFIG.collections.profiles, 
                [Query.equal('role', 'student'), Query.orderDesc('$createdAt'), Query.limit(500)]
            );
            
            const mappedStudents = response.documents.map(doc => ({
                id: doc.$id,
                fullName: doc.full_name,
                email: doc.email,
                status: doc.status,
                classId: doc.class_id,
                avatarUrl: doc.avatar_url,
                created_by: doc.created_by // Bắt buộc lấy trường này để hiển thị Badge
            }));
            
            setStudents(mappedStudents);
        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (studentId: string, classId: string) => {
        if (!classId) return alert("Vui lòng chọn lớp cho học viên trước khi duyệt!");
        try {
            await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, studentId, {
                status: 'approved',
                class_id: classId
            });
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: 'approved', classId: classId } : s));
            alert("Đã phê duyệt thành công!");
        } catch (error) {
            alert("Lỗi khi phê duyệt!");
        }
    };

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudent.classId) return alert("Vui lòng chọn một lớp học!");
        if (newStudent.password.length < 8) return alert("Mật khẩu phải từ 8 ký tự trở lên!");

        try {
            setIsCreating(true);
            const created = await databaseService.createStudentByTeacher({
                ...newStudent,
                teacherName: 'Admin Hệ thống'
            });
            
            setStudents(prev => [{
                id: created.id,
                fullName: created.fullName,
                email: created.email,
                status: created.status,
                classId: created.classId,
                avatarUrl: created.avatarUrl,
                created_by: 'Admin Hệ thống'
            }, ...prev]);
            
            setShowAddModal(false);
            setNewStudent({ fullName: '', email: '', password: '', classId: '' });
            alert("Đã tạo và phê duyệt tài khoản Học viên thành công!");
        } catch (error: any) {
            alert(error.message || "Lỗi khi tạo tài khoản. Email có thể đã tồn tại!");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (studentId: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản này?")) return;
        try {
            await databaseService.deleteUserProfileAndAuth(studentId);
            setStudents(prev => prev.filter(s => s.id !== studentId));
        } catch (error) {
            alert("Lỗi khi xóa!");
        }
    };

    const pendingStudents = students.filter(s => s.status === 'pending');
    const approvedStudents = students.filter(s => s.status === 'approved');
    const displayList = activeTab === 'PENDING' ? pendingStudents : approvedStudents;

    if (loading) return <div className="p-10 text-center"><i className="fas fa-spinner fa-spin text-3xl text-blue-600"></i></div>;

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-blue-900 uppercase mb-1">Kiểm duyệt Học viên</h1>
                    <p className="text-slate-500 text-sm">Quản lý, phân lớp và theo dõi nguồn gốc tài khoản đăng ký.</p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-900 text-white rounded-sm px-6 py-3 font-bold uppercase text-xs transition-all hover:bg-blue-800 shadow-lg flex items-center gap-2"
                >
                    <i className="fas fa-plus"></i> THÊM HỌC VIÊN
                </button>
            </div>

            {/* THANH ĐIỀU HƯỚNG TABS */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 pb-4">
                <button 
                    onClick={() => setActiveTab('PENDING')}
                    className={`px-6 py-2.5 rounded-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'PENDING' ? 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}
                >
                    <i className="fas fa-user-clock"></i> Chờ phê duyệt ({pendingStudents.length})
                </button>
                <button 
                    onClick={() => setActiveTab('APPROVED')}
                    className={`px-6 py-2.5 rounded-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'APPROVED' ? 'bg-green-100 text-green-700 shadow-sm border border-blue-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}
                >
                    <i className="fas fa-user-check"></i> Đã phê duyệt ({approvedStudents.length})
                </button>
            </div>

            {/* BẢNG DANH SÁCH */}
            <div className="bg-white border border-slate-300 rounded-sm overflow-hidden flex-1 shadow-inner">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-blue-900 text-white">
                            <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-left w-12">STT</th>
                            <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-left w-32">Mã ID</th>
                            <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-left">Học viên & Nguồn gốc</th>
                            <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-center w-28">Trạng thái</th>
                            <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-left w-64">Phân phối Lớp học</th>
                            <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-center w-32">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayList.length === 0 ? (
                            <tr><td colSpan={6} className="p-10 text-center text-slate-400 uppercase font-black text-[10px] tracking-widest bg-slate-50">Không có học viên nào trong danh mục này.</td></tr>
                        ) : (
                            displayList.map((student, index) => (
                                <tr key={student.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-4 border border-slate-300 text-xs font-bold text-slate-500 text-center">{index + 1}</td>
                                    <td className="px-4 py-4 border border-slate-300 text-xs">
                                        <button 
                                          onClick={() => {
                                            navigator.clipboard.writeText(student.id);
                                            alert('Đã copy ID: ' + student.id);
                                          }}
                                          title="Click để copy ID"
                                          className="px-2 py-1 bg-slate-100 hover:bg-blue-900 hover:text-white text-blue-900 font-mono font-bold text-[10px] rounded-sm transition-all flex items-center gap-2 border border-slate-200"
                                        >
                                          {student.id.substring(0, 8)}... <i className="far fa-copy"></i>
                                        </button>
                                    </td>
                                    <td className="px-4 py-4 border border-slate-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-sm border border-slate-200 overflow-hidden bg-slate-100 shrink-0">
                                                <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-800 text-xs uppercase tracking-tight">{student.fullName}</div>
                                                <div className="text-[10px] text-slate-500 mb-1">{student.email}</div>
                                                
                                                {/* HUY HIỆU NGUỒN GỐC TÀI KHOẢN */}
                                                <div>
                                                    {student.created_by ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100" title={`Được cấp bởi: ${student.created_by}`}>
                                                            <i className="fas fa-chalkboard-teacher"></i> GV: {student.created_by}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                                                            <i className="fas fa-globe"></i> Tự đăng ký
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 border border-slate-300 text-center align-middle">
                                        {student.status === 'pending' ? (
                                            <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-sm text-[9px] font-black uppercase tracking-widest border border-orange-200">Chờ Duyệt</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-green-50 text-green-600 rounded-sm text-[9px] font-black uppercase tracking-widest border border-green-200">Đã Duyệt</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 border border-slate-300 align-middle">
                                        <select 
                                            title="Chọn lớp học"
                                            value={student.classId || ''} 
                                            onChange={(e) => {
                                                setStudents(prev => prev.map(s => s.id === student.id ? { ...s, classId: e.target.value } : s));
                                            }}
                                            className="w-full p-2 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 text-xs font-bold"
                                            disabled={student.status === 'approved'}
                                        >
                                            <option value="">-- CHỌN LỚP HỌC --</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-4 border border-slate-300 text-center align-middle">
                                        <div className="flex justify-center gap-2">
                                            {student.status === 'pending' && (
                                                <button onClick={() => handleApprove(student.id, student.classId)} className="w-8 h-8 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all border border-green-200 rounded-sm flex items-center justify-center" title="Phê duyệt">
                                                    <i className="fas fa-check text-xs"></i>
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(student.id)} className="w-8 h-8 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all border border-red-200 rounded-sm flex items-center justify-center" title="Xóa tài khoản">
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

            {/* MODAL TẠO HỌC VIÊN CHO ADMIN */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <form onSubmit={handleCreateStudent} className="bg-white rounded-sm p-8 max-w-md w-full shadow-2xl relative border-t-4 border-blue-900 animate-fade-in-up font-[Roboto]">
                        <button type="button" onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-600 transition-colors" aria-label="Đóng">
                            <i className="fas fa-times"></i>
                        </button>
                        
                        <div className="mb-6 text-left">
                            <h2 className="text-xl font-black text-blue-900 uppercase tracking-tight border-b-2 border-blue-100 pb-2 flex items-center gap-2">
                                <i className="fas fa-user-plus text-sm"></i> Thêm Học Viên Mới
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider text-left">Học bạ & Họ Tên</label>
                                <input required type="text" value={newStudent.fullName} onChange={e => setNewStudent({...newStudent, fullName: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 transition-all font-medium text-sm" placeholder="NGUYỄN VĂN A" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider text-left">Email Hệ thống</label>
                                <input required type="email" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 transition-all font-medium text-sm" placeholder="student@dhsystem.com" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider text-left">Mật khẩu Khởi tạo ({">= "} 8 ký tự)</label>
                                <input required type="password" minLength={8} value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 transition-all font-medium text-sm" placeholder="********" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider text-left">Phân phối Lớp học</label>
                                <select 
                                    required
                                    title="Chọn lớp học"
                                    value={newStudent.classId} 
                                    onChange={e => setNewStudent({...newStudent, classId: e.target.value})} 
                                    className="w-full p-2.5 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 transition-all font-bold text-sm"
                                >
                                    <option value="">-- CHỌN LỚP CHO HỌC VIÊN --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-2">
                            <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-sm hover:bg-slate-200 transition-colors uppercase text-[10px]">Đóng</button>
                            <button type="submit" disabled={isCreating} className="flex-[2] py-3 bg-blue-900 text-white font-black uppercase tracking-widest rounded-sm hover:bg-blue-800 shadow-md disabled:opacity-70 transition-colors text-[10px]">
                                {isCreating ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-check-circle mr-2"></i>}
                                XÁC NHẬN CẤP TÀI KHOẢN
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}