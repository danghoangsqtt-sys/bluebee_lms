import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { databaseService } from '../../services/databaseService';

interface EnrolledStudent {
    id: string;
    fullName: string;
    email: string;
    status: string;
    classId: string;
    className: string; // Helper for display
    avatarUrl?: string;
}

interface TeacherClass {
    id: string;
    name: string;
}

interface TeacherStudentsProps {
    onNotify: (message: string, type: any) => void;
}

const TeacherStudents: React.FC<TeacherStudentsProps> = ({ onNotify }) => {
    const { user } = useAuth();
    
    // Data Isolation States
    const [myClasses, setMyClasses] = useState<TeacherClass[]>([]);
    const [myStudents, setMyStudents] = useState<EnrolledStudent[]>([]);
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ fullName: '', email: '', password: '' });
    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredStudents = myStudents.filter(s => {
        const matchClass = selectedClass ? s.classId === selectedClass : true;
        const matchSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           s.email.toLowerCase().includes(searchTerm.toLowerCase());
        return matchClass && matchSearch;
    });

    const handleCopyId = (id: string) => {
        navigator.clipboard.writeText(id);
        onNotify("Đã copy ID vào bộ nhớ tạm", "success");
    };

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClass) return alert("Vui lòng chọn một lớp học trước!");
        if (newStudent.password.length < 8) return alert("Mật khẩu phải từ 8 ký tự trở lên!");
        
        try {
            setIsCreating(true);
            const created = await databaseService.createStudentByTeacher({
                ...newStudent,
                classId: selectedClass,
                teacherName: user?.fullName || 'Giáo viên'
            });
            // Thêm className cho hiển thị UI
            const className = myClasses.find(c => c.id === selectedClass)?.name || '';
            setMyStudents(prev => [{ ...created, className, avatarUrl: created.avatarUrl || '' }, ...prev]);
            setShowAddModal(false);
            setNewStudent({ fullName: '', email: '', password: '' });
            onNotify("Đã tạo và phê duyệt tài khoản Học viên thành công!", "success");
        } catch (error: any) {
            alert(error.message || "Lỗi khi tạo tài khoản. Email có thể đã tồn tại!");
        } finally {
            setIsCreating(false);
        }
    };

    useEffect(() => {
        const fetchTeacherData = async () => {
            if (!user?.id) return;
            
            setLoading(true);
            setErrorMsg('');
            setMyClasses([]);
            setMyStudents([]);

            try {
                // BƯỚC 1: Lấy danh sách lớp do giáo viên này phụ trách
                // Hàm này đã được filter server-side bằng query teacher_id
                const classesRaw = await databaseService.fetchClasses(user.id);

                if (!classesRaw || classesRaw.length === 0) {
                    setErrorMsg("Bạn chưa được phân công chủ nhiệm lớp học nào. Vui lòng liên hệ Admin.");
                    setLoading(false);
                    return;
                }

                // Map sang format nhẹ hơn cho state
                const classesList: TeacherClass[] = classesRaw.map((c: any) => ({
                    id: c.$id,
                    name: c.name
                }));
                setMyClasses(classesList);

                // BƯỚC 3: Lấy danh sách học viên của từng lớp
                let allStudents: EnrolledStudent[] = [];
                
                // Dùng Promise.all để fetch song song danh sách học viên của các lớp
                const studentPromises = classesList.map(async (cls) => {
                    const studentsInClass = await databaseService.fetchStudentsByClass(cls.id);
                    // Map thêm tên lớp vào object học viên để hiển thị UI
                    return studentsInClass.map((s: any) => ({
                        id: s.id,
                        fullName: s.fullName,
                        email: s.email,
                        status: s.status,
                        classId: s.classId,
                        className: cls.name,
                        avatarUrl: s.avatarUrl
                    }));
                });

                const results = await Promise.all(studentPromises);
                // Gộp các mảng con thành 1 mảng duy nhất
                allStudents = results.flat();

                setMyStudents(allStudents);

            } catch (err: any) {
                console.error("Data Isolation Error:", err);
                setErrorMsg("Lỗi tải dữ liệu lớp học: " + err.message);
                onNotify("Không thể tải danh sách lớp chủ nhiệm.", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherData();
    }, [user, onNotify]);

    return (
        <div className="p-10 animate-fade-in space-y-10 max-w-7xl mx-auto font-[Roboto]">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-slate-200 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-blue-900 tracking-tighter uppercase mb-1">
                        QUẢN LÝ DANH SÁCH HỌC VIÊN
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">Theo dõi tiến độ, cấp tài khoản và quản lý học vụ tại đơn vị.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="bg-white px-6 py-3 rounded-sm border-2 border-slate-200 shadow-inner">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-3">Phát sinh:</span>
                        <span className="text-xl font-black text-blue-900">{myStudents.length}</span>
                    </div>
                </div>
            </header>

            {/* TOOLBAR: CLASS SELECTOR + SEARCH + ADD BUTTON */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 border border-slate-300 rounded-sm shadow-sm">
                <div className="flex flex-1 gap-2 w-full">
                    <select 
                        title="Lọc theo lớp học"
                        value={selectedClass} 
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="p-2.5 bg-slate-50 border border-slate-300 rounded-sm outline-none focus:border-blue-900 font-bold text-xs uppercase min-w-[200px]"
                    >
                        <option value="">-- TẤT CẢ LỚP HỌC --</option>
                        {myClasses.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                    </select>
                    <div className="relative flex-1">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input 
                            type="text"
                            placeholder="TÌM KIẾM HỌC VIÊN..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-sm text-xs font-bold outline-none focus:border-blue-900"
                        />
                    </div>
                </div>
                
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-900 text-white rounded-sm px-6 py-2.5 font-bold uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 hover:bg-slate-800 shadow-md whitespace-nowrap"
                >
                    <i className="fas fa-plus"></i> CẤP TÀI KHOẢN MỚI
                </button>
            </div>

            {/* ERROR STATE */}
            {errorMsg && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-orange-200 bg-orange-50/50 rounded-2xl">
                    <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center text-2xl">
                        <i className="fas fa-exclamation-triangle"></i>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Chưa có dữ liệu lớp học</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">{errorMsg}</p>
                    </div>
                </div>
            )}

            {/* DATA TABLE */}
            {!errorMsg && (
                <div className="bg-white border border-slate-300 rounded-sm overflow-hidden shadow-sm">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-blue-900 text-white">
                                <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-left w-12">STT</th>
                                <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-left w-32">Mã ID</th>
                                <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-left">Học viên & Nguồn gốc</th>
                                <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-left w-40">Lớp học</th>
                                <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-center w-32">Trạng thái</th>
                                <th className="px-4 py-3 border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-center w-40">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <i className="fas fa-circle-notch fa-spin text-2xl text-blue-900 mb-3"></i>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đang đồng bộ dữ liệu bản doanh...</p>
                                    </td>
                                </tr>
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center bg-slate-50">
                                        <i className="fas fa-users-slash text-4xl text-slate-200 mb-4"></i>
                                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Không tìm thấy học viên khả dụng</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((s, index) => (
                                    <tr key={s.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4 border border-slate-300 text-xs font-bold text-slate-500 text-center">{index + 1}</td>
                                        <td className="px-4 py-4 border border-slate-300 text-xs">
                                            <button 
                                                onClick={() => handleCopyId(s.id)}
                                                title="Click để copy ID"
                                                className="px-2 py-1 bg-slate-100 hover:bg-blue-900 hover:text-white text-blue-900 font-mono font-bold text-[10px] rounded-sm transition-all flex items-center gap-2 border border-slate-200 w-full justify-center"
                                            >
                                                {s.id.substring(0, 8)}... <i className="far fa-copy"></i>
                                            </button>
                                        </td>
                                        <td className="px-4 py-4 border border-slate-300">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-sm border border-white shadow-sm overflow-hidden bg-slate-100 shrink-0">
                                                    <img src={s.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.fullName)}`} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-black text-slate-800 text-xs uppercase tracking-tight truncate">{s.fullName}</div>
                                                    <div className="text-[10px] text-slate-500 truncate mb-1">{s.email}</div>
                                                    
                                                    {/* HUY HIỆU NGUỒN GỐC */}
                                                    <div>
                                                        {(s as any).created_by ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100" title={`Cấp bởi: ${(s as any).created_by}`}>
                                                                <i className="fas fa-id-card"></i> GV: {(s as any).created_by}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                                                                <i className="fas fa-globe"></i> Hệ thống
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 border border-slate-300">
                                            <span className="text-[10px] font-black text-white uppercase bg-blue-500 px-2.5 py-1 rounded-sm shadow-sm border border-blue-600">
                                                {s.className}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 border border-slate-300 text-center">
                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-sm border ${
                                                (s.status === 'approved' || s.status === 'active') 
                                                ? 'bg-green-50 text-green-700 border-green-200' 
                                                : 'bg-orange-50 text-orange-700 border-orange-200'
                                            }`}>
                                                {(s.status === 'approved' || s.status === 'active') ? 'ĐÃ DUYỆT' : 'CHỜ DUYỆT'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 border border-slate-300">
                                            <div className="flex justify-center gap-2">
                                                <button 
                                                    title="Xem tiến độ học tập"
                                                    className="px-2.5 py-1.5 bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-900 hover:text-white rounded-sm text-[9px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    TIẾN ĐỘ
                                                </button>
                                                <button 
                                                    title="Gỡ khỏi danh sách"
                                                    className="px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded-sm text-[9px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    XÓA
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL TẠO HỌC VIÊN CHO GIÁO VIÊN */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateStudent} className="bg-white rounded-sm p-8 max-w-md w-full shadow-2xl relative border-t-4 border-blue-900">
                        <button type="button" onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-600 transition-colors" aria-label="Đóng">
                            <i className="fas fa-times"></i>
                        </button>
                        
                        <div className="mb-6">
                            <h2 className="text-xl font-black text-blue-900 uppercase tracking-tight border-b-2 border-blue-100 pb-2">
                                Cấp Tài Khoản Học Viên
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 bg-blue-50 px-2 py-1 inline-block">
                                Chế độ: Phê duyệt tự động
                            </p>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-wider">Họ và Tên Học Viên</label>
                                <input 
                                    required 
                                    type="text" 
                                    value={newStudent.fullName} 
                                    onChange={e => setNewStudent({...newStudent, fullName: e.target.value})} 
                                    className="w-full p-3 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 transition-all font-medium text-sm" 
                                    placeholder="VÍ DỤ: NGUYỄN VĂN A" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-wider">Địa chỉ Email (Đăng nhập)</label>
                                <input 
                                    required 
                                    type="email" 
                                    value={newStudent.email} 
                                    onChange={e => setNewStudent({...newStudent, email: e.target.value})} 
                                    className="w-full p-3 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 transition-all font-medium text-sm" 
                                    placeholder="student@dhsystem.com" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-wider">Mật khẩu Hệ thống ({">= "} 8 ký tự)</label>
                                <input 
                                    required 
                                    type="password" 
                                    minLength={8} 
                                    value={newStudent.password} 
                                    onChange={e => setNewStudent({...newStudent, password: e.target.value})} 
                                    className="w-full p-3 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 transition-all font-medium text-sm" 
                                    placeholder="********" 
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex gap-2">
                            <button 
                                type="button" 
                                onClick={() => setShowAddModal(false)} 
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-sm hover:bg-slate-200 transition-colors uppercase text-xs"
                            >
                                Hủy Bỏ
                            </button>
                            <button 
                                type="submit" 
                                disabled={isCreating} 
                                className="flex-[2] py-3 bg-blue-900 text-white font-black uppercase tracking-widest rounded-sm hover:bg-blue-800 shadow-lg disabled:opacity-70 transition-colors text-xs"
                            >
                                {isCreating ? <i className="fas fa-spinner fa-spin"></i> : "Xác Nhận Cấp Quyền"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default TeacherStudents;