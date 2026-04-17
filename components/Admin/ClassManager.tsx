import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { databases, APPWRITE_CONFIG, Query, ID } from '../../lib/appwrite';
import { Class, UserProfile } from '../../types';
import { databaseService } from '../../services/databaseService';

interface ClassWithTeacher extends Class {
  teacherName?: string;
  teacherEmail?: string;
}

interface ClassManagerProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const ClassManager: React.FC<ClassManagerProps> = ({ onNotify }) => {
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignLockedClass, setAssignLockedClass] = useState(false);

  const [newClassName, setNewClassName] = useState('');
  const [assignData, setAssignData] = useState({ classId: '', teacherId: '' });

  // --- Task 3: New States for Class Details ---
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedClassDetails, setSelectedClassDetails] = useState<ClassWithTeacher | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // New states for inline editing
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes
      const classRes = await databases.listDocuments(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.classes,
        [Query.orderDesc('$createdAt'), Query.limit(500)]
      );

      // 2. Fetch Teachers
      const teacherRes = await databases.listDocuments(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        [Query.equal('role', ['teacher']), Query.limit(500)]
      );

      const teacherMap = new Map<string, any>(teacherRes.documents.map(t => [t.$id, t]));

      const mappedClasses: ClassWithTeacher[] = classRes.documents.map((c: any) => {
        const teacher = (c.teacher_id && c.teacher_id !== 'unassigned') ? teacherMap.get(c.teacher_id) : null;
        return {
            id: c.$id,
            name: c.name,
            teacherId: c.teacher_id,
            isActive: c.is_active,
            createdAt: new Date(c.$createdAt).getTime(),
            teacherName: teacher ? teacher.full_name : 'Chưa gán',
            teacherEmail: teacher ? teacher.email : ''
        };
      });

      const mappedTeachers: UserProfile[] = teacherRes.documents.map((t: any) => ({
        id: t.$id,
        fullName: t.full_name || 'Unknown',
        email: t.email,
        role: t.role,
        status: 'active'
      }));

      setClasses(mappedClasses);
      setTeachers(mappedTeachers);
    } catch (err: any) {
      console.error(err);
      onNotify(err.message || "Lỗi tải dữ liệu lớp học", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    try {
      await databases.createDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.classes,
        ID.unique(),
        { 
          name: newClassName,
          teacher_id: 'unassigned',
          is_active: true 
        }
      );
      
      onNotify("Đã tạo lớp học mới.", "success");
      setNewClassName('');
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  const handleOpenAssignModal = (classItem?: ClassWithTeacher) => {
    if (classItem) {
      setAssignData({ classId: classItem.id, teacherId: classItem.teacherId && classItem.teacherId !== 'unassigned' ? classItem.teacherId : '' });
      setAssignLockedClass(true);
    } else {
      setAssignData({ classId: '', teacherId: '' });
      setAssignLockedClass(false);
    }
    setShowAssignModal(true);
  };

  const handleAssignTeacher = async () => {
      if (!assignData.classId || !assignData.teacherId) {
          onNotify("Vui lòng chọn đầy đủ Lớp và Cán bộ quản lý", "warning");
          return;
      }

      try {
          await databases.updateDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.classes,
            assignData.classId,
            { teacher_id: assignData.teacherId }
          );

          onNotify("Phân công Cán bộ quản lý thành công!", "success");
          setShowAssignModal(false);
          setAssignData({ classId: '', teacherId: '' });
          setAssignLockedClass(false);
          fetchData();
      } catch (err: any) {
          onNotify(err.message, "error");
      }
  };

  const handleUnassignTeacher = async (classId: string, className: string) => {
    if (!window.confirm(`Xác nhận gỡ phân công cán bộ khỏi lớp "${className}"?`)) return;
    try {
      await databases.updateDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.classes,
        classId,
        { teacher_id: 'unassigned' }
      );
      onNotify("Đã gỡ phân công cán bộ khỏi lớp.", "info");
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, teacherId: 'unassigned', teacherName: 'Chưa gán', teacherEmail: '' } : c));
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  const toggleClassActive = async (id: string, current: boolean) => {
    try {
      await databases.updateDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.classes,
        id,
        { is_active: !current }
      );
      
      setClasses(prev => prev.map(c => c.id === id ? { ...c, isActive: !current } : c));
      onNotify(`Đã ${!current ? 'kích hoạt' : 'tạm dừng'} lớp học.`, "info");
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  // --- Task 3: Logic implementation ---
  const handleViewDetails = async (classItem: ClassWithTeacher) => {
      setSelectedClassDetails(classItem);
      setShowDetailsModal(true);
      setLoadingDetails(true);
      setClassStudents([]);

      try {
          const students = await databaseService.fetchStudentsByClass(classItem.id);
          setClassStudents(students);
      } catch (e) {
          onNotify("Không thể tải danh sách học viên.", "error");
      } finally {
          setLoadingDetails(false);
      }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
      if (!window.confirm(`Bạn có chắc chắn muốn gỡ học viên "${studentName}" khỏi lớp này không?`)) return;
      
      try {
          await databaseService.removeStudentFromClass(studentId);
          setClassStudents(prev => prev.filter(s => s.id !== studentId));
          onNotify(`Đã gỡ học viên ${studentName} khỏi lớp.`, "success");
      } catch (e) {
          onNotify("Lỗi khi gỡ học viên.", "error");
      }
  };

  const handleUpdateClassName = async (classId: string) => {
      if (!editingClassName.trim()) {
          setEditingClassId(null);
          return;
      }
      try {
          await databaseService.updateClass(classId, editingClassName);
          onNotify("Cập nhật tên lớp thành công!", "success");
          setClasses(prev => prev.map(c => c.id === classId ? { ...c, name: editingClassName } : c));
          setEditingClassId(null);
      } catch (err: any) {
          onNotify(err.message, "error");
      }
  };

  const handleDeleteClass = async (classId: string, className: string) => {
      if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp "${className}"? Toàn bộ học viên và cán bộ sẽ bị gỡ biên chế khỏi lớp.`)) return;
      
      try {
          setLoading(true);
          await databaseService.deleteClass(classId);
          onNotify(`Đã xóa lớp "${className}" thành công.`, "success");
          setClasses(prev => prev.filter(c => c.id !== classId));
      } catch (err: any) {
          onNotify(err.message, "error");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="p-8 animate-fade-in font-[Roboto]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-school text-blue-600"></i> Quản lý Lớp học
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Cấu trúc tổ chức đào tạo</p>
        </div>
        <div className="flex gap-3">
            <button onClick={() => handleOpenAssignModal()} title="Phân công giảng dạy" className="bg-slate-100 text-slate-600 border border-slate-200 px-6 py-3 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"><i className="fas fa-user-tag"></i> Phân công</button>
            <button onClick={() => setShowCreateModal(true)} title="Tạo lớp học mới" className="bg-blue-600 text-white px-6 py-3 rounded-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95"><i className="fas fa-plus"></i> Khởi tạo Lớp</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-slate-200">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/4">Tên Lớp / Mã</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/3">Cán bộ quản lý chủ nhiệm</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/4 text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/6 text-right">Điều khiển</th>
                </tr>
            </thead>
            <tbody className="bg-white">
                {classes.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                            {editingClassId === c.id ? (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={editingClassName} 
                                        onChange={e => setEditingClassName(e.target.value)}
                                        className="p-2 border-2 border-blue-600 rounded-sm outline-none font-bold text-sm text-slate-800 w-full"
                                        title="Tên lớp mới"
                                        placeholder="Nhập tên lớp..."
                                        autoFocus
                                    />
                                    <button onClick={() => handleUpdateClassName(c.id)} title="Lưu thay đổi" className="text-green-600 hover:text-green-700 p-2"><i className="fas fa-check"></i></button>
                                    <button onClick={() => setEditingClassId(null)} title="Hủy bỏ" className="text-red-500 hover:text-red-600 p-2"><i className="fas fa-times"></i></button>
                                </div>
                            ) : (
                                <span className="font-black text-slate-800 text-sm">{c.name}</span>
                            )}
                        </td>
                        <td className="px-6 py-4">
                            {(c.teacherId && c.teacherId !== 'unassigned') ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-sm flex items-center justify-center font-bold text-xs">{c.teacherName?.charAt(0)}</div>
                                    <div><p className="text-xs font-bold text-slate-700">{c.teacherName}</p></div>
                                </div>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-300 uppercase italic flex items-center gap-2"><i className="fas fa-exclamation-circle"></i> Chưa phân công</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-sm text-[9px] font-black uppercase tracking-widest ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.isActive ? 'Active' : 'Paused'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={() => { setEditingClassId(c.id); setEditingClassName(c.name); }} className="w-10 h-10 rounded-sm inline-flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Sửa tên lớp"><i className="fas fa-edit"></i></button>
                                {(c.teacherId && c.teacherId !== 'unassigned') ? (
                                  <button type="button" onClick={() => handleUnassignTeacher(c.id, c.name)} className="w-10 h-10 rounded-sm inline-flex items-center justify-center bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-sm" title="Gỡ phân công cán bộ"><i className="fas fa-user-slash"></i></button>
                                ) : (
                                  <button type="button" onClick={() => handleOpenAssignModal(c)} className="w-10 h-10 rounded-sm inline-flex items-center justify-center bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm" title="Phân công cán bộ quản lý"><i className="fas fa-user-tag"></i></button>
                                )}
                                <button type="button" onClick={() => handleViewDetails(c)} className="w-10 h-10 rounded-sm inline-flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all" title="Xem chi tiết lớp"><i className="fas fa-eye"></i></button>
                                <button type="button" onClick={() => toggleClassActive(c.id, c.isActive)} className={`w-10 h-10 rounded-sm inline-flex items-center justify-center transition-all ${c.isActive ? 'bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`} title={c.isActive ? "Tạm dừng" : "Kích hoạt"}><i className={`fas ${c.isActive ? 'fa-pause' : 'fa-play'}`}></i></button>
                                <button type="button" onClick={() => handleDeleteClass(c.id, c.name)} className="w-10 h-10 rounded-sm inline-flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Xóa lớp"><i className="fas fa-trash-alt"></i></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* CREATE CLASS MODAL */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-sm p-8 shadow-2xl animate-slide-up border-t-4 border-blue-600">
            <div className="mb-8"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tạo Lớp học mới</h3></div>
            <div className="space-y-5">
              <div className="space-y-1"><label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Tên Lớp</label><input required type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-sm outline-none focus:border-blue-600 focus:bg-white font-bold text-sm text-slate-800 transition-all" autoFocus placeholder="K65-DTVT-01" /></div>
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                <button onClick={handleCreateClass} className="flex-1 py-3 bg-blue-600 text-white rounded-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all">Khởi tạo</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* ASSIGN TEACHER MODAL */}
      {showAssignModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-sm p-8 shadow-2xl animate-slide-up border-t-4 border-blue-600">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Phân công Cán bộ</h3>
                {assignLockedClass && assignData.classId && (
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1 flex items-center gap-1">
                    <i className="fas fa-school"></i> {classes.find(c => c.id === assignData.classId)?.name}
                  </p>
                )}
              </div>
              <button type="button" title="Đóng" onClick={() => { setShowAssignModal(false); setAssignLockedClass(false); }} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-5">
              {!assignLockedClass && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Chọn Lớp</label>
                  <select title="Chọn lớp học" value={assignData.classId} onChange={e => setAssignData({...assignData, classId: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-sm outline-none focus:border-blue-600 focus:bg-white font-bold text-sm text-slate-800 transition-all">
                    <option value="">-- Chọn lớp --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.teacherName && c.teacherId !== 'unassigned' ? ` (${c.teacherName})` : ' — Chưa phân công'}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{assignLockedClass ? '1.' : '2.'} Chọn Cán bộ quản lý</label>
                <select title="Chọn cán bộ quản lý" value={assignData.teacherId} onChange={e => setAssignData({...assignData, teacherId: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-sm outline-none focus:border-blue-600 focus:bg-white font-bold text-sm text-slate-800 transition-all">
                  <option value="">-- Chọn Cán bộ quản lý --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName} — {t.email}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setShowAssignModal(false); setAssignLockedClass(false); }} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                <button type="button" onClick={handleAssignTeacher} className="flex-1 py-3 bg-blue-600 text-white rounded-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all">Lưu phân công</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* TASK 3: CLASS DETAILS MODAL */}
      {showDetailsModal && selectedClassDetails && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-3xl rounded-sm p-0 shadow-2xl animate-slide-up flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-8 border-b border-slate-100 bg-slate-50 rounded-sm relative">
                <button onClick={() => setShowDetailsModal(false)} className="absolute top-6 right-6 w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all"><i className="fas fa-times text-slate-500"></i></button>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Chi tiết lớp {selectedClassDetails.name}</h3>
                
                <div className="mt-4 p-4 bg-white border border-slate-200 rounded-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-sm flex items-center justify-center font-bold text-sm">
                        {selectedClassDetails.teacherName ? selectedClassDetails.teacherName.charAt(0) : '?'}
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giáo viên chủ nhiệm</p>
                        <p className="text-sm font-bold text-slate-800">{selectedClassDetails.teacherName || 'Chưa phân công'}</p>
                        <p className="text-xs text-slate-500 font-mono">{selectedClassDetails.teacherEmail || 'N/A'}</p>
                    </div>
                </div>
            </div>
            
            {/* Body */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fas fa-users text-blue-600"></i> Danh sách học viên ({classStudents.length})
                </h4>

                {loadingDetails ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <i className="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">Đang tải dữ liệu...</span>
                    </div>
                ) : classStudents.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-slate-100 rounded-sm bg-slate-50">
                        Chưa có học viên nào trong lớp
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="pb-3 pl-2 w-10">STT</th>
                                <th className="pb-3">Họ tên</th>
                                <th className="pb-3">Email</th>
                                <th className="pb-3 text-center">Trạng thái</th>
                                <th className="pb-3 text-right">Tác vụ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classStudents.map((s, idx) => (
                                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 group transition-colors">
                                    <td className="py-3 pl-2 text-xs font-bold text-slate-400">{idx + 1}</td>
                                    <td className="py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center text-xs font-black transition-colors">
                                                {s.fullName.charAt(0)}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{s.fullName}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 text-xs font-medium text-slate-500 font-mono">{s.email}</td>
                                    <td className="p-4 align-middle text-center">
                                        {['approved', 'active', 'ACTIVE', 'APPROVED'].includes(s.status) ? (
                                            <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
                                                ACTIVE
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
                                                PENDING
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 text-right">
                                        <button 
                                            onClick={() => handleRemoveStudent(s.id, s.fullName)}
                                            className="text-red-300 hover:text-red-500 p-2 transition-all"
                                            title="Gỡ khỏi lớp học"
                                        >
                                            <i className="fas fa-user-minus"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end rounded-sm">
                <button onClick={() => setShowDetailsModal(false)} className="px-8 py-3 bg-blue-600 text-white rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg">Đóng</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default ClassManager;