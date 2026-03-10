import React, { useState, useEffect, useMemo } from 'react';
import { databaseService, fetchStudentAttemptCount } from '../../services/databaseService';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';
import ExamRoom from '../OnlineTest/ExamRoom';
import ExamStatistics from '../ExamStatistics';
import ExamCreator from '../ExamCreator';
import { generateExamPaper } from '../../utils/examEngine';
import { Exam } from '../../types';

export default function SelfStudyManager({ user }: { user: any }) {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [selectedExam, setSelectedExam] = useState<any>(null);

    // Config Form States
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [examPassword, setExamPassword] = useState('');
    const [shuffleQ, setShuffleQ] = useState(true);
    const [shuffleO, setShuffleO] = useState(true);
    const [examStatus, setExamStatus] = useState<'draft' | 'published'>('draft');

    // Phòng thi
    const [activeExamData, setActiveExamData] = useState<any>(null);
    const [examQuestions, setExamQuestions] = useState<any[]>([]);
    const [examAnswerData, setExamAnswerData] = useState<any>(null);

    // Thống kê
    const [statsExam, setStatsExam] = useState<any>(null);

    // Editing
    const [editingExam, setEditingExam] = useState<Exam | null>(null);

    // Admin Sidebar (Bộ lọc theo người tạo)
    const [adminSelectedCreator, setAdminSelectedCreator] = useState<string>('ALL');
    const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

    const isTeacherOrAdmin = user?.role === 'admin' || user?.role === 'teacher';

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Truyền ID và Role để Backend cho phép lấy dữ liệu
                const { documents: allExams } = await databaseService.fetchExams(user.id, user.role);
                // CHỈ LẤY ĐỀ ÔN TẬP
                const studyExams = allExams.filter((e: any) => e.exam_purpose === 'self_study' || e.exam_purpose === 'both');
                
                let filteredExams = [];
                const role = user.role?.toLowerCase();
                
                if (role === 'student') {
                    filteredExams = studyExams.filter((e: any) => e.status === 'published');
                } else if (role === 'teacher') {
                    // Cán bộ quản lý: Thấy đề ôn tập mình tạo HOẶC gán cho lớp mình quản lý
                    let managedClassIds: string[] = [];
                    try {
                        const classes = await databaseService.fetchClasses(user.id);
                        managedClassIds = classes.map((c: any) => c.$id || c.id);
                    } catch (classErr) {
                        console.warn("Lỗi tải lớp quản lý của GV:", classErr);
                    }

                    filteredExams = studyExams.filter((e: any) => {
                        const isCreator = e.creatorId === user.id || e.creator_id === user.id;
                        const isAssignedToManagedClass = e.class_id && managedClassIds.includes(e.class_id);
                        return isCreator || isAssignedToManagedClass;
                    });
                } else {
                    filteredExams = studyExams;
                }
                // Fetch profiles for mapping names if admin
                if (user.role === 'admin') {
                    try {
                        const profilesRes = await databases.listDocuments(
                            APPWRITE_CONFIG.dbId,
                            APPWRITE_CONFIG.collections.profiles,
                            [Query.limit(500)]
                        );
                        const profilesMap: Record<string, string> = {};
                        profilesRes.documents.forEach(doc => {
                            profilesMap[doc.$id] = doc.full_name || doc.email || 'Người dùng ẩn';
                        });
                        setUserProfiles(profilesMap);
                    } catch (pErr) {
                        console.warn("Không tải được profiles để map tên:", pErr);
                    }
                }

                filteredExams.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setExams(filteredExams);
            } catch (err) { console.error('Lỗi tải đề ôn tập:', err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [user]);

    // Tính toán danh sách Creator (Chỉ cho Admin)
    const creatorList = useMemo(() => {
        if (user?.role !== 'admin') return [];
        const creators = new Set<string>();
        exams.forEach(exam => {
            if (exam.creatorId) creators.add(exam.creatorId);
            if (exam.creator_id) creators.add(exam.creator_id);
        });
        return Array.from(creators).map(id => ({
            id,
            name: userProfiles[id] || `ID: ${id.substring(0, 6)}...`
        }));
    }, [exams, userProfiles, user?.role]);

    // Danh sách đề thi đã được lọc theo sidebar
    const displayedExams = useMemo(() => {
        if (user?.role !== 'admin' || adminSelectedCreator === 'ALL') return exams;
        return exams.filter(e => e.creatorId === adminSelectedCreator || e.creator_id === adminSelectedCreator);
    }, [exams, adminSelectedCreator, user?.role]);

    const openConfigModal = (exam: any) => {
        setSelectedExam(exam);
        setStartTime(exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '');
        setEndTime(exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : '');
        setExamPassword(exam.exam_password || '');
        setShuffleQ(exam.shuffle_questions !== false);
        setShuffleO(exam.shuffle_options !== false);
        setExamStatus(exam.status || 'draft');
        setConfigModalOpen(true);
    };

    const handleSaveConfig = async () => {
        if (!selectedExam) return;
        try {
            const payload: any = {
                start_time: startTime ? new Date(startTime).toISOString() : null,
                end_time: endTime ? new Date(endTime).toISOString() : null,
                exam_password: examPassword,
                shuffle_questions: shuffleQ,
                shuffle_options: shuffleO,
                status: examStatus,
                class_id: null, // Ôn tập không gán lớp
                max_attempts: 9999 // Ôn tập làm vô hạn lần
            };
            await databaseService.updateExam(selectedExam.id, payload);
            setExams(prev => prev.map(e => e.id === selectedExam.id ? { ...e, ...payload } : e));
            setConfigModalOpen(false);
            alert('Đã lưu cấu hình bài Ôn tập!');
        } catch (e) { alert("Lỗi khi lưu cấu hình!"); }
    };

    const handleDeleteExam = async (examId: string, title: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa đề ôn tập "${title}"?`)) return;
        try {
            await databaseService.deleteExam(examId);
            setExams(prev => prev.filter(e => e.id !== examId));
            alert("Đã xóa đề ôn tập!");
        } catch (e) {
            alert("Lỗi khi xóa đề ôn tập!");
        }
    };

    const handleTakeExam = async (exam: any) => {
        const now = new Date();
        if (exam.start_time && now < new Date(exam.start_time)) { alert("Chưa đến giờ mở đề!"); return; }
        if (exam.end_time && now > new Date(exam.end_time)) { alert("Đã đóng đề!"); return; }
        if (exam.exam_password) {
            const pass = window.prompt("Nhập mật khẩu ôn tập:");
            if (pass !== exam.exam_password) { alert("Sai mật khẩu!"); return; }
        }

        try {
            // BỘ LỌC CÂU HỎI THÔNG MINH (Tối ưu hóa Query)
            let examQuestionsToUse: any[] = [];
            if (exam.questionIds && exam.questionIds.length > 0) {
                // Ưu tiên 1: Đề thi có danh sách câu hỏi cụ thể (Sinh ra từ ExamCreator)
                examQuestionsToUse = await databaseService.fetchQuestionsByCriteria(exam.questionIds);
            } else if (exam.folder) {
                // Ưu tiên 2: Kéo câu hỏi theo Folder (Dùng cho đề thi động)
                examQuestionsToUse = await databaseService.fetchQuestionsByCriteria(undefined, exam.folder);
            }
            
            if (examQuestionsToUse.length === 0) {
                alert("Đề thi này chưa có câu hỏi nào (Hoặc Admin chưa cấp quyền Read bảng Questions trong Appwrite).");
                return;
            }

            // Sinh đề thi (Trộn đáp án, trộn câu hỏi)
            const { examQuestions, answerData } = generateExamPaper(
                examQuestionsToUse, 
                examQuestionsToUse.length, 
                "ONLINE_TEST"
            );
            
            setExamQuestions(examQuestions);
            setExamAnswerData(answerData);
            setActiveExamData(exam);
        } catch (error) { 
            console.error("Lỗi lấy câu hỏi:", error);
            alert("Lỗi tải cấu trúc đề thi!"); 
        }
    };

    if (activeExamData) {
        return <ExamRoom exam={activeExamData} questions={examQuestions} answerData={examAnswerData} user={user} onExit={() => setActiveExamData(null)} />;
    }

    return (
        <div className="p-6 md:p-8 h-full flex flex-col relative font-[Roboto]">
            {/* Page Header — Command Center */}
            <div className="bg-blue-900 rounded-sm p-6 mb-6 border-b-4 border-yellow-500 relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-yellow-500 rounded-sm flex items-center justify-center">
                            <i className="fas fa-book-reader text-blue-900 text-sm"></i>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white uppercase tracking-wider">Ôn tập tự học</h1>
                            <p className="text-[10px] font-mono text-blue-300 uppercase tracking-wider mt-0.5">
                                {isTeacherOrAdmin
                                    ? 'PRACTICE MANAGEMENT — Quản lý & Thống kê'
                                    : 'LEARNING HUB — Ôn tập không giới hạn'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-blue-800 px-3 py-1.5 rounded-sm border border-blue-700">
                        <i className="fas fa-infinity text-yellow-400 text-xs"></i>
                        <span className="text-[9px] font-mono font-bold text-blue-300 uppercase tracking-wider">{displayedExams.length} Bài ôn tập</span>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 flex flex-col lg:flex-row gap-6">
                {/* Admin Sidebar (Chỉ hiện cho role Admin) */}
                {user?.role === 'admin' && (
                    <div className="w-full lg:w-64 shrink-0 bg-white border border-slate-300 rounded-sm p-4 flex flex-col gap-2 shadow-sm h-fit">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">
                            <i className="fas fa-filter text-blue-900 mr-2"></i> Lọc theo Cán bộ
                        </h3>
                        <button
                            onClick={() => setAdminSelectedCreator('ALL')}
                            className={`px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-wider text-left transition-all border ${
                                adminSelectedCreator === 'ALL'
                                    ? 'bg-blue-900 text-white border-blue-900 shadow-md'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-blue-900'
                            }`}
                        >
                            <i className={`fas fa-globe-asia mr-2 ${adminSelectedCreator === 'ALL' ? 'text-yellow-400' : 'text-slate-400'}`}></i> Toàn bộ Hệ Thống
                        </button>
                        {creatorList.map(creator => (
                            <button
                                key={creator.id}
                                onClick={() => setAdminSelectedCreator(creator.id)}
                                className={`px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-wider text-left transition-all border break-words ${
                                    adminSelectedCreator === creator.id
                                        ? 'bg-blue-900 text-white border-blue-900 shadow-md'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-blue-900'
                                }`}
                            >
                                <i className={`fas fa-user-tie mr-2 ${adminSelectedCreator === creator.id ? 'text-yellow-400' : 'text-slate-400'}`}></i> 
                                {creator.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Danh sách bài ôn tập */}
                <div className="flex-1">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center py-20">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-slate-50 rounded-sm flex items-center justify-center mx-auto mb-4 border border-slate-300">
                                    <i className="fas fa-spinner fa-spin text-xl text-blue-900"></i>
                                </div>
                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Loading practice exams...</p>
                            </div>
                        </div>
                    ) 
                    : displayedExams.length === 0 ? (
                        <div className="bg-white rounded-sm border border-slate-300 p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 text-blue-900 rounded-sm flex items-center justify-center text-2xl mb-4 border border-slate-300">
                                <i className="fas fa-book-reader"></i>
                            </div>
                            <h3 className="text-lg font-black text-blue-900 mb-2 uppercase tracking-wider">Chưa có bài ôn tập nào</h3>
                            <p className="text-xs font-mono text-slate-500 max-w-md">
                                {isTeacherOrAdmin
                                    ? 'Hãy tạo đề thi với mục đích "Ôn tập" trong Ngân hàng Đề để bài ôn tập xuất hiện tại đây.'
                                    : 'Khi Cán bộ quản lý xuất bản bài ôn tập, đề sẽ xuất hiện tại đây.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {displayedExams.map(exam => (
                                <div key={exam.id} className="bg-white p-0 rounded-sm border border-slate-300 flex flex-col hover:border-blue-900 hover:shadow-sm transition-all group overflow-hidden">
                                    {/* Card Top Accent */}
                                    <div className="h-1 bg-blue-900 group-hover:bg-yellow-500 transition-all"></div>
                                    
                                    <div className="p-5 flex flex-col flex-1">
                                        <h3 className="font-black text-blue-900 text-base mb-2 cursor-pointer hover:text-blue-700 transition-colors uppercase tracking-wider" onClick={() => {
                                            if (user?.role === 'student') handleTakeExam(exam);
                                        }}>{exam.title}</h3>
                                
                                <div className="space-y-1.5 mb-3 text-[10px] font-mono text-slate-600">
                                    <p className="flex items-center gap-2"><i className="fas fa-infinity text-yellow-600"></i> Làm lại không giới hạn</p>
                                    {exam.start_time && <p className="flex items-center gap-2"><i className="fas fa-clock text-green-600"></i> Mở: {new Date(exam.start_time).toLocaleString('vi-VN')}</p>}
                                    {exam.end_time && <p className="flex items-center gap-2"><i className="fas fa-hourglass-end text-amber-600"></i> Đóng: {new Date(exam.end_time).toLocaleString('vi-VN')}</p>}
                                    {exam.exam_password && <p className="flex items-center gap-2"><i className="fas fa-lock text-red-600"></i> Có mật khẩu</p>}
                                </div>
                                
                                <div className="mt-auto pt-3 border-t border-slate-200 flex justify-between items-center">
                                    <span className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-sm uppercase tracking-wider border ${exam.status === 'published' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                        {exam.status === 'published' ? '● PUBLISHED' : '○ DRAFT'}
                                    </span>
                                    {isTeacherOrAdmin && (
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => setStatsExam(exam)} 
                                                className="text-amber-700 text-[10px] font-bold uppercase tracking-wider hover:underline transition-colors"
                                                title="Xem thống kê bài ôn tập"
                                            >
                                                <i className="fas fa-chart-bar mr-1"></i> Stats
                                            </button>
                                            <button onClick={() => openConfigModal(exam)} className="text-blue-900 text-[10px] font-bold uppercase tracking-wider hover:underline transition-colors">
                                                <i className="fas fa-cog mr-1"></i> Config
                                            </button>
                                            <button onClick={() => setEditingExam(exam as Exam)} className="text-blue-600 text-[10px] font-bold uppercase tracking-wider hover:underline transition-colors" title="Sửa nội dung">
                                                <i className="fas fa-pen mr-1"></i> Edit
                                            </button>
                                            <button onClick={() => handleDeleteExam(exam.id, exam.title)} className="text-red-600 text-[10px] font-bold uppercase tracking-wider hover:underline transition-colors" title="Xóa đề">
                                                <i className="fas fa-trash-alt mr-1"></i> Del
                                            </button>
                                        </div>
                                    )}
                                    {user?.role === 'student' && (
                                        <button onClick={() => handleTakeExam(exam)} className="bg-blue-900 text-white px-5 py-2 rounded-sm text-[10px] font-black uppercase tracking-wider hover:bg-blue-800 transition-all border border-blue-900 shadow-sm">
                                            <i className="fas fa-play text-[9px] mr-1"></i> Làm bài
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
                </div>
            </div>

            {/* MODAL CẤU HÌNH ÔN TẬP */}
            {configModalOpen && selectedExam && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-lg rounded-sm border-2 border-blue-900 shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-blue-900 px-6 py-4 border-b-2 border-yellow-500">
                            <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-cog text-yellow-400"></i> Cấu hình Ôn tập
                            </h3>
                            <p className="text-[10px] font-mono text-blue-300 mt-0.5">{selectedExam.title}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Thời gian Mở đề</label>
                                    <input 
                                        type="datetime-local" 
                                        value={startTime} 
                                        onChange={e => setStartTime(e.target.value)} 
                                        title="Thời gian mở đề"
                                        placeholder="Chọn ngày giờ mở"
                                        className="w-full border border-slate-300 p-2.5 rounded-sm outline-none focus:border-blue-900 text-sm font-bold text-slate-700" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Thời gian Đóng đề</label>
                                    <input 
                                        type="datetime-local" 
                                        value={endTime} 
                                        onChange={e => setEndTime(e.target.value)} 
                                        title="Thời gian đóng đề"
                                        placeholder="Chọn ngày giờ đóng"
                                        className="w-full border border-slate-300 p-2.5 rounded-sm outline-none focus:border-blue-900 text-sm font-bold text-slate-700" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mật khẩu (Để trống nếu tự do)</label>
                                <input type="text" value={examPassword} onChange={e => setExamPassword(e.target.value)} placeholder="Nhập mật khẩu..." className="w-full border border-slate-300 p-2.5 rounded-sm outline-none focus:border-blue-900 text-sm font-bold text-slate-700" />
                            </div>

                            <div className="flex gap-6 bg-slate-50 p-3 rounded-sm border border-slate-300">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
                                    <input type="checkbox" checked={shuffleQ} onChange={e => setShuffleQ(e.target.checked)} className="w-4 h-4 text-blue-900" /> Đảo câu hỏi
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
                                    <input type="checkbox" checked={shuffleO} onChange={e => setShuffleO(e.target.checked)} className="w-4 h-4 text-blue-900" /> Đảo đáp án
                                </label>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-sm border-l-4 border-yellow-500 flex items-center gap-3">
                                <i className="fas fa-infinity text-yellow-600"></i>
                                <p className="text-[10px] font-mono font-bold text-blue-900 uppercase tracking-wider">Ôn tập: Không giới hạn lần | Không gán lớp</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Trạng thái phát hành</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2.5 rounded-sm border border-slate-300 hover:border-blue-900 transition-all">
                                        <input type="radio" name="selfStudyStatus" checked={examStatus === 'draft'} onChange={() => setExamStatus('draft')} /> <span className="text-xs font-bold text-slate-600">Lưu nháp</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-green-50 px-4 py-2.5 rounded-sm border border-green-200 hover:border-green-600 transition-all">
                                        <input type="radio" name="selfStudyStatus" checked={examStatus === 'published'} onChange={() => setExamStatus('published')} /> <span className="text-xs font-bold text-green-700">Xuất bản</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end px-6 py-4 bg-slate-50 border-t border-slate-200">
                            <button onClick={() => setConfigModalOpen(false)} className="px-5 py-2.5 bg-white font-bold text-[10px] uppercase tracking-wider rounded-sm border border-slate-300 hover:bg-slate-100 transition-all text-slate-600">Hủy</button>
                            <button onClick={handleSaveConfig} className="px-6 py-2.5 bg-blue-900 text-white font-black text-[10px] uppercase tracking-wider rounded-sm hover:bg-blue-800 border border-blue-800 transition-all flex items-center gap-2"><i className="fas fa-save"></i> Lưu Cấu Hình</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL THỐNG KÊ */}
            {statsExam && (
                <ExamStatistics 
                    examId={statsExam.id} 
                    examTitle={statsExam.title} 
                    onClose={() => setStatsExam(null)} 
                />
            )}

            {editingExam && (
                <ExamCreator 
                    editExam={editingExam} 
                    onBack={() => {
                        setEditingExam(null);
                        // Refresh data
                        const fetchData = async () => {
                            const { documents: allExams } = await databaseService.fetchExams(user.id, user.role);
                            const studyExams = allExams.filter((e: any) => e.exam_purpose === 'self_study' || e.exam_purpose === 'both');
                            setExams(studyExams.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                        };
                        fetchData();
                    }} 
                />
            )}
        </div>
    );
}
