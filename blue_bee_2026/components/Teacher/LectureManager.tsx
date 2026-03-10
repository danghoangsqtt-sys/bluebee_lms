import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { useAuth } from '../../contexts/AuthContext';

interface CourseItem { id: string; title: string; type: 'PDF' | 'PPT' | 'VIDEO'; url: string; }
interface CourseModule { id: string; title: string; items: CourseItem[]; }
interface Course { id?: string; title: string; class_id: string; config: { modules: CourseModule[] }; createdAt?: number; }

export default function LectureManager(props: any) {
    const auth = useAuth();
    const user = props.user || auth?.user;

    const [courses, setCourses] = useState<Course[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // LIST (Danh sách) | EDIT (Cấu hình tổng) | LEARN (Live Studio / Học viên xem)
    const [viewMode, setViewMode] = useState<'LIST' | 'EDIT' | 'LEARN'>('LIST');
    const [activeCourse, setActiveCourse] = useState<Course | null>(null);
    const [activeItem, setActiveItem] = useState<CourseItem | null>(null);
    
    const [note, setNote] = useState('');

    useEffect(() => {
        const fetchInitData = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                if (user.role !== 'student' && typeof databaseService.fetchClasses === 'function') {
                    const cls = await databaseService.fetchClasses();
                    setClasses(cls || []);
                }
                const studentClassId = user.class_id || user.classId;
                const fetchedCourses = await databaseService.fetchLectures(user.id, user.role, studentClassId);
                setCourses(fetchedCourses);
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchInitData();
    }, [user]);

    useEffect(() => {
        if (activeItem?.id && activeCourse?.id && user?.id) {
            const savedNote = localStorage.getItem(`lms_note_${activeCourse.id}_${activeItem.id}_${user.id}`);
            setNote(savedNote || '');
        }
    }, [activeItem?.id, activeCourse?.id, user?.id]);

    const handleSaveNote = (text: string) => {
        setNote(text);
        if (activeItem?.id && activeCourse?.id && user?.id) {
            localStorage.setItem(`lms_note_${activeCourse.id}_${activeItem.id}_${user.id}`, text);
        }
    };

    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        
        // 1. Youtube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('/').pop();
            return `https://www.youtube.com/embed/${videoId}`;
        }
        
        // 2. Google Slides / Docs / Sheets (Tuyệt chiêu ép hiển thị tĩnh)
        if (url.includes('docs.google.com')) {
            return url.replace(/\/(edit|view).*$/, '/embed?rm=minimal');
        }

        // 3. Google Drive PPTX/PDF gốc
        if (url.includes('drive.google.com')) {
            try {
                let fileId = '';
                const parts = url.split('/');
                const dIndex = parts.indexOf('d');
                if (dIndex !== -1 && parts.length > dIndex + 1) {
                    fileId = parts[dIndex + 1];
                } else if (url.includes('?id=')) {
                    fileId = new URL(url).searchParams.get('id') || '';
                }
                if (fileId) {
                    return `https://drive.google.com/file/d/${fileId}/preview`;
                }
            } catch (error) {
                console.error("Lỗi trích xuất File ID:", error);
            }
            return url.replace(/\/view.*$/, '/preview'); 
        }
        
        return url;
    };

    // --- CÁC HÀM XỬ LÝ DỮ LIỆU CHỐNG CRASH ---
    const handleAddModule = () => {
        if (!activeCourse) return;
        const currentModules = activeCourse.config?.modules || [];
        const newModule: CourseModule = { id: Date.now().toString(), title: 'Chương mới', items: [] };
        setActiveCourse({ ...activeCourse, config: { ...activeCourse.config, modules: [...currentModules, newModule] } });
    };

    const handleAddItem = (moduleId: string) => {
        if (!activeCourse) return;
        const currentModules = activeCourse.config?.modules || [];
        const newItem: CourseItem = { id: Date.now().toString(), title: 'Tài liệu mới', type: 'VIDEO', url: '' };
        const updatedModules = currentModules.map(m => 
            m.id === moduleId ? { ...m, items: [...(m.items || []), newItem] } : m
        );
        setActiveCourse({ ...activeCourse, config: { ...activeCourse.config, modules: updatedModules } });
        setActiveItem(newItem);
    };

    const handleUpdateItem = (moduleId: string, itemId: string, field: keyof CourseItem, value: string) => {
        if (!activeCourse) return;
        const currentModules = activeCourse.config?.modules || [];
        const updatedModules = currentModules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, items: (m.items || []).map(i => i?.id === itemId ? { ...i, [field]: value } : i) };
        });
        setActiveCourse({ ...activeCourse, config: { ...activeCourse.config, modules: updatedModules } });
    };

    const handleInlineUpdateItem = (field: keyof CourseItem, value: string) => {
        if (!activeItem?.id || !activeCourse) return;
        const moduleId = activeCourse.config?.modules?.find(m => (m.items || []).some(i => i?.id === activeItem.id))?.id;
        if (!moduleId) return;
        
        setActiveItem(prev => prev ? { ...prev, [field]: value } : prev);
        handleUpdateItem(moduleId, activeItem.id, field, value);
    };

    const handleDeleteItemInline = () => {
        if (!activeItem?.id || !activeCourse) return;
        if (!window.confirm("Xóa tài liệu này?")) return;
        const moduleId = activeCourse.config?.modules?.find(m => (m.items || []).some(i => i?.id === activeItem.id))?.id;
        if (!moduleId) return;
        const updatedModules = activeCourse.config.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, items: (m.items || []).filter(i => i?.id !== activeItem.id) };
        });
        setActiveCourse({ ...activeCourse, config: { ...activeCourse.config, modules: updatedModules } });
        setActiveItem(null);
    };

    const handleSaveCourseDB = async () => {
        if (!activeCourse?.title) return alert("Vui lòng nhập tên Học liệu!");
        try {
            setLoading(true);
            const saved = await databaseService.saveCourse(activeCourse, user?.id || 'unknown');
            setCourses(prev => {
                const exists = prev.find(c => c.id === saved.id);
                return exists ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev];
            });
            alert("Đã lưu Học liệu thành công!");
        } catch (error) { alert("Lỗi khi lưu!"); }
        finally { setLoading(false); }
    };

    const handleDeleteCourse = async (courseId: string, title: string) => {
        if (!window.confirm(`⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA HỌC LIỆU:\n"${title}"\n\nHành động này sẽ xóa toàn bộ cây tài liệu và không thể hoàn tác!`)) return;
        try {
            setLoading(true);
            await databaseService.deleteCourse(courseId);
            setCourses(prev => prev.filter(c => c.id !== courseId));
            alert("Đã xóa học liệu thành công!");
        } catch (error) { alert("Lỗi khi xóa môn học!"); } 
        finally { setLoading(false); }
    };

    // --- RENDER GIAO DIỆN ---
    if (loading) return <div className="p-10 text-center"><i className="fas fa-spinner fa-spin text-3xl text-blue-900"></i></div>;

    // 1. MÀN HÌNH LIVE STUDIO (HỌC TẬP VÀ SOẠN GIẢNG TRỰC TIẾP)
    if (viewMode === 'LEARN' && activeCourse) {
        return (
            <div className="h-full flex bg-slate-50 relative">
                {/* Nút công cụ Góc phải trên */}
                <div className="absolute top-4 right-6 z-50 flex gap-2">
                    {user?.role !== 'student' && (
                        <button onClick={handleSaveCourseDB} className="bg-blue-900 text-white border border-blue-900 px-4 py-2 rounded-sm font-bold uppercase tracking-wider text-xs hover:bg-blue-800 transition-all">
                            <i className="fas fa-save mr-2"></i> Lưu Xuất Bản
                        </button>
                    )}
                    <button onClick={() => setViewMode('LIST')} className="bg-white border border-slate-300 px-4 py-2 rounded-sm font-bold uppercase tracking-wider text-xs text-slate-600 hover:text-red-500 transition-all">
                        <i className="fas fa-sign-out-alt mr-2"></i> Thoát
                    </button>
                </div>

                {/* Cột trái: Cây thư mục (CÓ THỂ CHỈNH SỬA) */}
                <div className="w-80 bg-white border-r border-slate-300 flex flex-col z-40">
                    <div className="p-5 border-b border-slate-300 bg-blue-900 text-white">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="font-bold text-lg leading-tight uppercase tracking-wider">{activeCourse.title}</h2>
                                <p className="text-[10px] opacity-80 mt-1 uppercase tracking-widest"><i className="fas fa-book-open mr-1"></i> {(activeCourse.config?.modules || []).length} Chương</p>
                            </div>
                            {user?.role !== 'student' && (
                                <button onClick={() => {
                                    const newTitle = prompt("Đổi tên Môn học:", activeCourse.title);
                                    if (newTitle) setActiveCourse({...activeCourse, title: newTitle});
                                }} className="text-white/50 hover:text-white" title="Đổi tên khóa học"><i className="fas fa-pen"></i></button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar pb-20">
                        {(activeCourse.config?.modules || []).map((mod, mIdx) => {
                            if (!mod) return null;
                            return (
                                <div key={mod.id} className="space-y-1">
                                    <div className="flex justify-between items-center bg-slate-100 px-3 py-2 border border-slate-200 mb-2">
                                        <h3 className="font-black text-xs text-blue-900 uppercase tracking-wider truncate flex-1">
                                            Chương {mIdx + 1}: {mod.title}
                                        </h3>
                                        {user?.role !== 'student' && (
                                            <div className="flex gap-2 ml-2">
                                                <button onClick={() => {
                                                    const newTitle = prompt("Đổi tên Chương:", mod.title);
                                                    if (newTitle) {
                                                        const newMods = [...activeCourse.config.modules];
                                                        newMods[mIdx].title = newTitle;
                                                        setActiveCourse({...activeCourse, config: {...activeCourse.config, modules: newMods}});
                                                    }
                                                }} className="text-slate-400 hover:text-blue-900"><i className="fas fa-edit"></i></button>
                                                <button onClick={() => {
                                                    if(!window.confirm("Xóa toàn bộ chương này?")) return;
                                                    const newMods = activeCourse.config.modules.filter(m => m.id !== mod.id);
                                                    setActiveCourse({...activeCourse, config: {...activeCourse.config, modules: newMods}});
                                                    if(activeItem && (mod.items || []).some(i => i?.id === activeItem.id)) setActiveItem(null);
                                                }} className="text-slate-400 hover:text-red-600"><i className="fas fa-trash"></i></button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pl-2 space-y-1">
                                        {(mod.items || []).map(item => {
                                            if (!item) return null;
                                            return (
                                                <div 
                                                    key={item.id} 
                                                    onClick={() => setActiveItem(item)}
                                                    className={`flex items-center gap-3 p-3 rounded-sm cursor-pointer border transition-all ${activeItem?.id === item.id ? 'bg-slate-100 text-blue-900 border-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-600 border-transparent'}`}
                                                >
                                                    <i className={`text-base ${item.type === 'VIDEO' ? 'fab fa-youtube text-red-600' : item.type === 'PDF' ? 'fas fa-file-pdf text-red-700' : 'fas fa-file-powerpoint text-orange-600'}`}></i>
                                                    <span className="text-sm truncate flex-1 uppercase tracking-tight">{item.title}</span>
                                                </div>
                                            );
                                        })}
                                        {user?.role !== 'student' && (
                                            <button onClick={() => handleAddItem(mod.id)} className="w-full text-left pl-3 py-2 mt-1 text-[10px] font-bold text-blue-900 uppercase tracking-widest hover:bg-slate-100 rounded-sm transition-colors border border-dashed border-slate-300">
                                                <i className="fas fa-plus mr-1"></i> Thêm Bài Học
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {user?.role !== 'student' && (
                            <button onClick={handleAddModule} className="w-full py-3 border border-dashed border-slate-400 text-slate-500 font-bold hover:border-blue-900 hover:text-blue-900 hover:bg-slate-50 transition-colors text-xs uppercase tracking-widest mt-4">
                                <i className="fas fa-plus-circle mr-1"></i> THÊM CHƯƠNG MỚI
                            </button>
                        )}
                    </div>
                </div>

                {/* Cột phải: Khung hiển thị, Inline Editor & Ghi chú */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    
                    {/* TOOLBAR CHỈNH SỬA NHANH CHO GIÁO VIÊN */}
                    {user?.role !== 'student' && activeItem && (
                        <div className="bg-white px-5 py-3 border-b border-slate-300 flex items-center gap-3 z-20">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap"><i className="fas fa-sliders-h mr-1"></i> Thuộc tính:</span>
                            <select 
                                value={activeItem.type} 
                                onChange={e => handleInlineUpdateItem('type', e.target.value)}
                                className="p-2 border border-slate-300 rounded-sm text-xs font-bold text-blue-900 outline-none focus:border-blue-900 bg-slate-50 uppercase tracking-wider"
                            >
                                <option value="PDF">Tệp PDF</option>
                                <option value="PPT">Slide PPT</option>
                                <option value="VIDEO">Video / Youtube</option>
                            </select>
                            <input 
                                type="text" 
                                value={activeItem.title} 
                                onChange={e => handleInlineUpdateItem('title', e.target.value)}
                                placeholder="Tên bài học..."
                                className="p-2 border border-slate-300 rounded-sm text-xs font-bold w-48 outline-none focus:border-blue-900"
                            />
                            <input 
                                type="text" 
                                value={activeItem?.url || ''} 
                                onChange={e => handleInlineUpdateItem('url', e.target.value)}
                                placeholder="Dán Link Google Drive hoặc Youtube vào đây để Preview..."
                                className="flex-1 p-2 border border-slate-300 rounded-sm text-xs text-blue-900 font-mono outline-none focus:border-blue-900"
                            />
                            <button onClick={handleDeleteItemInline} className="px-3 py-2 bg-slate-100 text-red-600 border border-slate-300 rounded-sm hover:bg-red-600 hover:text-white transition-colors" title="Xóa tài liệu này">
                                <i className="fas fa-trash"></i>
                            </button>
                        </div>
                    )}

                    {/* Phần trên: Iframe View */}
                    <div className="flex-1 bg-slate-100 p-4 relative z-10">
                        {activeItem ? (
                            <div className="w-full h-full bg-white border border-slate-300 relative overflow-hidden">
                                {activeItem?.url ? (
                                    <iframe src={getEmbedUrl(activeItem.url)} className="w-full h-full border-0" allow="autoplay" allowFullScreen></iframe>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50">
                                        <div className="w-16 h-16 border border-blue-900 text-blue-900 flex items-center justify-center mb-4"><i className="fas fa-link text-2xl"></i></div>
                                        <p className="font-bold text-sm text-blue-900 mb-1 uppercase tracking-widest">Chưa có dữ liệu liên kết</p>
                                        {user?.role !== 'student' ? (
                                            <p className="text-[10px] uppercase tracking-wider">Hãy dán Link vào ô phía trên để nội dung hiển thị ngay tại đây.</p>
                                        ) : (
                                            <p className="text-[10px] uppercase tracking-wider">Cán bộ quản lý chưa cập nhật tài liệu cho bài học này.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <i className="fas fa-hand-pointer text-5xl mb-4 opacity-50"></i>
                                <p className="text-sm font-bold uppercase tracking-widest text-blue-900">Vui lòng chọn một bài học ở danh sách bên trái</p>
                            </div>
                        )}
                    </div>

                    {/* Phần dưới: Ghi chú */}
                    <div className="h-56 bg-white border-t border-slate-300 p-4 flex flex-col z-20">
                        <div className="flex justify-between items-end mb-2">
                            <h3 className="font-bold text-blue-900 text-xs uppercase tracking-widest border-l-4 border-yellow-500 pl-2"><i className="fas fa-pen-nib mr-2"></i>Sổ tay ghi chú</h3>
                            {activeItem && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 border border-slate-200 uppercase tracking-tighter">Đang ghi chú cho: {activeItem.title}</span>}
                        </div>
                        <textarea
                            value={note}
                            onChange={(e) => handleSaveNote(e.target.value)}
                            disabled={!activeItem}
                            placeholder={activeItem ? "Gõ ghi chú của bạn vào đây. Dữ liệu sẽ tự động được lưu lại..." : "Hãy chọn một bài học để bắt đầu ghi chú..."}
                            className="flex-1 w-full bg-slate-50 border border-slate-300 rounded-sm p-4 outline-none focus:border-blue-900 focus:bg-white transition-all font-medium text-slate-700 resize-none disabled:opacity-50 text-sm"
                        />
                    </div>
                </div>
            </div>
        );
    }

    // 2. MÀN HÌNH EDIT (CHỈ DÙNG ĐỂ CẤU HÌNH TÊN VÀ LỚP HỌC)
    if (viewMode === 'EDIT' && activeCourse) {
        return (
            <div className="p-8 max-w-3xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-white p-6 border border-slate-300">
                    <div>
                        <h2 className="text-xl font-bold text-blue-900 uppercase tracking-wider">Thông Tin Học Liệu điện tử</h2>
                        <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">Cài đặt tên học liệu và phân công cho Lớp.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setViewMode('LIST')} className="px-6 py-3 bg-slate-100 border border-slate-300 text-slate-600 font-bold uppercase tracking-wider text-xs hover:bg-slate-200">Hủy</button>
                        <button onClick={handleSaveCourseDB} className="px-6 py-3 bg-blue-900 text-white border border-blue-900 font-bold uppercase tracking-wider text-xs hover:bg-blue-800"><i className="fas fa-save mr-2"></i> Lưu Cấu Hình</button>
                    </div>
                </div>

                <div className="bg-white p-6 border border-slate-300 space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tên Học Liệu điện tử</label>
                        <input type="text" value={activeCourse.title} onChange={e => setActiveCourse({...activeCourse, title: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-sm outline-none focus:border-blue-900 font-bold text-lg text-blue-900" placeholder="VD: Lập trình C++ Cơ bản" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Giao cho Lớp học</label>
                        <select value={activeCourse.class_id || ''} onChange={e => setActiveCourse({...activeCourse, class_id: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-sm outline-none focus:border-blue-900 font-bold text-blue-900">
                            <option value="">-- Chọn lớp áp dụng (Bỏ trống nếu dạy chung) --</option>
                            {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                        </select>
                    </div>
                    
                    <div className="p-4 bg-slate-100 text-blue-900 border border-blue-900 font-medium text-xs uppercase tracking-tight">
                        <i className="fas fa-info-circle mr-2 text-yellow-600"></i> 
                        Để <b>thêm chương</b> và <b>chèn Link tài liệu</b>, hãy bấm "Lưu Cấu Hình", sau đó ra ngoài danh sách và bấm nút <b>VÀO HỌC / SOẠN BÀI</b>. Bạn sẽ được phép soạn giáo trình trực tiếp tại đó!
                    </div>
                </div>
            </div>
        );
    }

    // 3. MÀN HÌNH DANH SÁCH KHÓA HỌC (LIST MODE)
    return (
        <div className="p-6 h-full flex flex-col relative bg-slate-50">
            <div className="flex justify-between items-end mb-8 border-b border-slate-300 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-widest mb-1">Học liệu điện tử</h1>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium">Nền tảng E-Learning với Live Studio chuyên nghiệp.</p>
                </div>
                {user?.role !== 'student' && (
                    <button onClick={() => {
                        setActiveCourse({ title: '', class_id: '', config: { modules: [] } });
                        setViewMode('EDIT');
                    }} className="px-6 py-3 bg-blue-900 text-white border border-blue-900 font-bold uppercase tracking-wider text-xs hover:bg-blue-800 transition-all">
                        <i className="fas fa-plus-circle mr-2"></i> Tạo Học Liệu Mới
                    </button>
                )}
            </div>

            {courses.length === 0 ? (
                <div className="flex-1 bg-white border border-slate-300 flex flex-col items-center justify-center text-center p-10">
                    <div className="w-24 h-24 border border-blue-900 text-blue-900 flex items-center justify-center mb-4"><i className="fas fa-layer-group text-4xl"></i></div>
                    <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest mb-2">Chưa có học liệu nào</h3>
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider max-w-md">Hãy tạo học liệu, sau đó bấm <b>VÀO HỌC</b> để vào Live Studio thêm Chương và tài liệu trực tiếp.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <div key={course.id} className="bg-white border border-slate-300 overflow-hidden transition-all flex flex-col group hover:border-blue-900">
                            <div className="h-32 bg-blue-900 relative p-5 flex flex-col justify-end">
                                <i className="fas fa-laptop-code absolute top-4 right-4 text-4xl text-white opacity-10"></i>
                                <span className="bg-yellow-500 text-blue-900 px-2 py-1 text-[9px] font-black w-max mb-2 border border-yellow-600 uppercase tracking-widest">
                                    {course.class_id ? `Lớp ID: ${course.class_id}` : 'Chưa giao lớp'}
                                </span>
                                <h3 className="font-bold text-white text-lg truncate uppercase tracking-wider">{course.title}</h3>
                            </div>
                            
                            <div className="p-5 flex-1 flex flex-col bg-white">
                                <div className="flex gap-4 mb-4 text-[10px] font-bold text-blue-900 uppercase tracking-widest">
                                    <div className="flex items-center gap-1"><i className="fas fa-folder text-slate-400"></i> {(course.config?.modules || []).length} Chương</div>
                                    <div className="flex items-center gap-1"><i className="fas fa-file-alt text-slate-400"></i> {(course.config?.modules || []).reduce((acc, mod) => acc + (mod?.items || []).length, 0)} Bài học</div>
                                </div>
                                
                                <div className="mt-auto flex gap-2 pt-4 border-t border-slate-200">
                                    <button onClick={() => { setActiveCourse(course); setActiveItem(null); setViewMode('LEARN'); }} className="flex-1 py-2.5 bg-yellow-500 text-blue-900 font-bold uppercase tracking-wider text-[10px] hover:bg-yellow-400 transition-colors border border-yellow-600">
                                        <i className="fas fa-play-circle mr-1"></i> VÀO HỌC / SOẠN BÀI
                                    </button>
                                    {user?.role !== 'student' && (
                                        <>
                                            <button onClick={() => { setActiveCourse(course); setViewMode('EDIT'); }} className="px-4 py-2.5 bg-slate-50 text-slate-600 border border-slate-300 hover:bg-slate-100 transition-colors" title="Cấu hình thông tin">
                                                <i className="fas fa-cog"></i>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); if (course.id) handleDeleteCourse(course.id, course.title); }} 
                                                className="px-4 py-2.5 bg-slate-50 text-red-600 border border-slate-300 hover:bg-red-600 hover:text-white transition-colors" title="Xóa môn học">
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}