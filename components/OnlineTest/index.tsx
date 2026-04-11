import React, { useState, useEffect, useMemo } from 'react';
import { databaseService, fetchStudentAttemptCount, fetchLatestExamAttempt } from '../../services/databaseService';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';
import ExamRoom from './ExamRoom';
import LiveProctoring from './LiveProctoring';
import ExamAnalytics from './ExamAnalytics';
import ExamCreator from '../ExamCreator';
import { generateExamPaper } from '../../utils/examEngine';
import { Exam } from '../../types';

export default function OnlineTestManager({ user }: { user: any }) {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [selectedExam, setSelectedExam] = useState<any>(null);

    // Form States
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [examPassword, setExamPassword] = useState('');
    const [shuffleQ, setShuffleQ] = useState(true);
    const [shuffleO, setShuffleO] = useState(true);
    const [examStatus, setExamStatus] = useState<'draft' | 'published'>('draft');
    const [maxAttempts, setMaxAttempts] = useState<number>(1);

    // Phòng thi
    const [activeExamData, setActiveExamData] = useState<any>(null);
    const [examQuestions, setExamQuestions] = useState<any[]>([]);
    const [examAnswerData, setExamAnswerData] = useState<any>(null);

    // Giao lớp
    const [availableClasses, setAvailableClasses] = useState<any[]>([]);
    const [targetClassId, setTargetClassId] = useState<string>('');

    // Thống kê
    const [statsExam, setStatsExam] = useState<any>(null);

    // Editing
    const [editingExam, setEditingExam] = useState<Exam | null>(null);

    // Admin Sidebar (Bộ lọc theo người tạo)
    const [adminSelectedCreator, setAdminSelectedCreator] = useState<string>('ALL');
    const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // 1. Tải danh sách lớp AN TOÀN (Không sập nếu chưa có API fetchClasses)
                if (user.role !== 'student') {
                    try {
                        if (typeof databaseService.fetchClasses === 'function') {
                            const classes = await databaseService.fetchClasses();
                            setAvailableClasses(classes || []);
                        }
                    } catch (classErr) {
                        console.warn("Chưa có API Class hoặc Lỗi tải Lớp học:", classErr);
                    }
                }

                // 2. Tải toàn bộ Đề thi
                // Truyền ID và Role để Backend cho phép lấy dữ liệu
                const { documents: allExams } = await databaseService.fetchExams(user.id, user.role);
                
                // 3. Lọc đề thi (Chỉ lấy đề có mục đích Kiểm Tra hoặc Cả hai)
                const onlineExams = allExams.filter((e: any) => e.exam_purpose === 'online_test' || e.exam_purpose === 'both');
                
                let filteredExams = [];
                const role = user.role?.toLowerCase();
                const studentClassId = user.class_id || user.classId || '';

                if (role === 'student') {
                    if (!studentClassId) {
                        filteredExams = [];
                        console.warn("HỌC VIÊN NÀY CHƯA CÓ CLASS_ID TRONG TÀI KHOẢN!");
                    } else {
                        filteredExams = onlineExams.filter((e: any) => {
                            const isPublished = e.status === 'published';
                            const isSameClass = e.class_id === studentClassId;
                            
                            // Log X-Quang để kiểm tra sự cố
                            if (!isPublished || !isSameClass) {
                                console.log(`🚫 Đề "${e.title}" BỊ ẨN. Lý do:`, 
                                    !isPublished ? 'Chưa xuất bản.' : `Lệch Lớp (Đề gán Lớp ID: "${e.class_id}" KHÁC VỚI Học viên Lớp ID: "${studentClassId}")`
                                );
                            }
                            return isPublished && isSameClass;
                        });
                    }
                } else if (role === 'teacher') {
                    // Cán bộ quản lý: Thấy đề do mình tạo HOẶC đề gán cho lớp mình quản lý
                    let managedClassIds: string[] = [];
                    try {
                        const classes = await databaseService.fetchClasses(user.id);
                        managedClassIds = classes.map((c: any) => c.$id || c.id);
                    } catch (classErr) {
                        console.warn("Lỗi tải lớp quản lý của GV:", classErr);
                    }

                    filteredExams = onlineExams.filter((e: any) => {
                        const isCreator = e.creatorId === user.id || e.creator_id === user.id;
                        const isAssignedToManagedClass = e.class_id && managedClassIds.includes(e.class_id);
                        return isCreator || isAssignedToManagedClass;
                    });
                } else {
                    // Admin: Thấy toàn bộ đề kiểm tra
                    filteredExams = onlineExams;
                }
                // Fetch user profiles for mapping if admin
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

                // Sắp xếp đề mới nhất lên đầu
                filteredExams.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setExams(filteredExams);
            } catch (err) { 
                console.error('Lỗi tải đề thi Online Test:', err); 
            } finally { 
                setLoading(false); 
            }
        };
        fetchData();
    }, [user]);

    const isTeacherOrAdmin = user?.role === 'admin' || user?.role === 'teacher';

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

    const getExamTotalQuestions = (exam: any): number => {
        if (!exam) return 0;

        if (Array.isArray(exam.questions)) {
            return exam.questions.length;
        }

        const rawQuestionIds = exam.questionIds ?? exam.question_ids;
        if (Array.isArray(rawQuestionIds)) {
            return rawQuestionIds.length;
        }

        if (typeof rawQuestionIds === 'string' && rawQuestionIds.trim()) {
            try {
                const parsed = JSON.parse(rawQuestionIds);
                if (Array.isArray(parsed)) return parsed.length;
            } catch {
                const ids = rawQuestionIds
                    .split(',')
                    .map((id: string) => id.trim())
                    .filter(Boolean);
                return ids.length;
            }
        }

        return 0;
    };

    const openConfigModal = (exam: any) => {
        setSelectedExam(exam);
        setStartTime(exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '');
        setEndTime(exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : '');
        setExamPassword(exam.exam_password || '');
        setShuffleQ(exam.shuffle_questions !== false);
        setShuffleO(exam.shuffle_options !== false);
        setExamStatus(exam.status || 'draft');
        setTargetClassId(exam.class_id || '');
        setMaxAttempts(exam.max_attempts || 1);
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
                class_id: targetClassId || null,
                max_attempts: maxAttempts
            };
            await databaseService.updateExam(selectedExam.id, payload);
            setExams(prev => prev.map(e => e.id === selectedExam.id ? { ...e, ...payload } : e));
            setConfigModalOpen(false);
            alert('Đã lưu cấu hình bài thi Kiểm tra!');
        } catch (e) { alert("Lỗi khi lưu cấu hình!"); }
    };

    const handleDeleteExam = async (examId: string, title: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa đề thi "${title}"?`)) return;
        try {
            await databaseService.deleteExam(examId);
            setExams(prev => prev.filter(e => e.id !== examId));
            alert("Đã xóa đề thi!");
        } catch (e) {
            alert("Lỗi khi xóa đề thi!");
        }
    };

    const handleTakeExam = async (exam: any) => {
        // 1. Kiểm tra thời gian
        const now = new Date();
        if (exam.start_time && now < new Date(exam.start_time)) {
            alert("Chưa đến giờ làm bài!"); return;
        }
        if (exam.end_time && now > new Date(exam.end_time)) {
            alert("Đã hết thời gian làm bài!"); return;
        }

        // 2. Kiểm tra mật khẩu
        if (exam.exam_password) {
            const pass = window.prompt("Bài thi này có mật khẩu. Vui lòng nhập mật khẩu:");
            if (pass !== exam.exam_password) {
                alert("Mật khẩu không chính xác!"); return;
            }
        }

        // 3. Kiểm tra số lần thi
        if (user?.id && exam.max_attempts && exam.max_attempts < 9999) {
             try {
                // Kiểm tra xem có bài thi dở dang không (chưa nộp)
                const latestAttempt = await fetchLatestExamAttempt(exam.id, user.id);
                const hasIncomplete = latestAttempt && (latestAttempt.status === 'in_progress' || latestAttempt.status === 'disconnected');
                
                if (!hasIncomplete) {
                    const attemptCount = await fetchStudentAttemptCount(exam.id, user.id);
                    if (attemptCount >= exam.max_attempts) {
                        alert(`Bạn đã hết số lần thi cho phép (${exam.max_attempts} lần). Không thể thi thêm.`);
                        return;
                    }
                }
            } catch (err) {
                console.warn('Lỗi kiểm tra số lần thi:', err);
            }
        }

        try {
            // BỘ LỌC CÂU HỎI THÔNG MINH
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
                "ONLINE_TEST",
                exam.shuffle_questions !== false,
                exam.shuffle_options !== false
            );
            
            setExamQuestions(examQuestions);
            setExamAnswerData(answerData);
            setActiveExamData(exam);
        } catch (error) { 
            console.error("Lỗi lấy câu hỏi:", error);
            alert("Lỗi tải cấu trúc đề thi!"); 
        }
    };

    // Nếu đang thi, ẩn danh sách đi và hiện ExamRoom
    if (activeExamData) {
        return (
            <ExamRoom 
                exam={activeExamData} 
                questions={examQuestions} 
                answerData={examAnswerData} 
                user={user} 
                onExit={() => setActiveExamData(null)} 
            />
        );
    }

    return (
        <div className="p-6 md:p-8 h-full flex flex-col font-[Roboto]">
            {/* Page Header — Command Center */}
            <div className="bg-blue-900 rounded-sm p-6 mb-6 border-b-4 border-yellow-500 relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-yellow-500 rounded-sm flex items-center justify-center">
                            <i className="fas fa-file-signature text-blue-900 text-sm"></i>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white uppercase tracking-wider">Kiểm tra trực tuyến</h1>
                            <p className="text-[10px] font-mono text-blue-300 uppercase tracking-wider mt-0.5">
                                {isTeacherOrAdmin
                                    ? 'EXAM MANAGEMENT — Configure & Deploy'
                                    : 'EXAM CENTER — Assigned Tests'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-blue-800 px-3 py-1.5 rounded-sm border border-blue-700">
                        <i className="fas fa-layer-group text-yellow-400 text-xs"></i>
                        <span className="text-[9px] font-mono font-bold text-blue-300 uppercase tracking-wider">{displayedExams.length} Bài thi</span>
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

                {/* Danh sách đề thi */}
                <div className="flex-1">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center py-20">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-slate-50 rounded-sm flex items-center justify-center mx-auto mb-4 border border-slate-300">
                                    <i className="fas fa-spinner fa-spin text-xl text-blue-900"></i>
                                </div>
                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Loading testing modules...</p>
                            </div>
                        </div>
                    ) : displayedExams.length === 0 ? (
                        <div className="bg-white rounded-sm border border-slate-300 p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 text-blue-900 rounded-sm flex items-center justify-center text-2xl mb-4 border border-slate-300">
                                <i className="fas fa-file-signature"></i>
                            </div>
                            <h3 className="text-lg font-black text-blue-900 mb-2 uppercase tracking-wider">Chưa có bài kiểm tra</h3>
                            <p className="text-xs font-mono text-slate-500 max-w-md">
                                {isTeacherOrAdmin
                                    ? 'Hãy sử dụng tab "Ngân hàng Đề" và tạo một đề thi mới với mục đích "Kiểm tra".'
                                    : 'Giáo viên chưa phân công bài kiểm tra nào cho lớp của bạn.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {displayedExams.map(exam => (
                                <div key={exam.id} className="bg-white p-0 rounded-sm border border-slate-300 flex flex-col hover:border-blue-900 hover:shadow-sm transition-all group overflow-hidden">
                                    {/* Card top accent */}
                                    <div className="h-1 bg-blue-900"></div>
                                    <div className="p-5 flex flex-col flex-1">
                                        <h3 className="font-black text-blue-900 text-base mb-2 cursor-pointer hover:text-blue-700 transition-colors uppercase tracking-wider" onClick={() => {
                                            if (user?.role === 'student') handleTakeExam(exam);
                                            else openConfigModal(exam);
                                        }}>{exam.title}</h3>
                                        
                                        <div className="space-y-1.5 mb-3 text-[10px] font-mono text-slate-600">
                                            <p className="flex items-center gap-2"><i className="fas fa-clock text-green-600"></i> Mở: {exam.start_time ? new Date(exam.start_time).toLocaleString('vi-VN') : 'Tự do'}</p>
                                            <p className="flex items-center gap-2"><i className="fas fa-hourglass-end text-amber-600"></i> Đóng: {exam.end_time ? new Date(exam.end_time).toLocaleString('vi-VN') : 'Tự do'}</p>
                                            {exam.max_attempts && exam.max_attempts < 9999 && (
                                                <p className="flex items-center gap-2"><i className="fas fa-redo text-purple-600"></i> Số lần thi: {exam.max_attempts}</p>
                                            )}
                                            {exam.exam_password && <p className="flex items-center gap-2"><i className="fas fa-lock text-red-600"></i> Có mật khẩu</p>}
                                        </div>

                                        <div className="mt-auto pt-3 border-t border-slate-200 flex justify-between items-center">
                                            <span className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-sm uppercase tracking-wider border ${exam.status === 'published' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                {exam.status === 'published' ? '● PUBLISHED' : '○ DRAFT'}
                                            </span>
                                            {isTeacherOrAdmin && (
                                                <div className="flex gap-3">
                                                    {exam.status === 'published' && (
                                                        <button onClick={() => setStatsExam(exam)} className="text-green-700 text-[10px] font-bold uppercase tracking-wider hover:underline transition-colors" title="Trực tuyến/Giám thị">
                                                            <i className="fas fa-video mr-1"></i> Live
                                                        </button>
                                                    )}
                                                    <button onClick={() => setStatsExam(exam)} className="text-amber-700 text-[10px] font-bold uppercase tracking-wider hover:underline transition-colors" title="Thống kê">
                                                        <i className="fas fa-chart-pie mr-1"></i> Stats
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
                                                    <i className="fas fa-play text-[9px] mr-1"></i> Vào thi
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

            {/* MODAL CẤU HÌNH BÀI THI */}
            {configModalOpen && selectedExam && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-lg rounded-sm border-2 border-blue-900 shadow-2xl overflow-hidden">
                        <div className="bg-blue-900 px-6 py-4 border-b-2 border-yellow-500">
                            <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-cog text-yellow-400"></i> Cấu hình Bài Thi
                            </h3>
                            <p className="text-[10px] font-mono text-blue-300 mt-0.5">{selectedExam.title}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Thời gian Mở đề</label>
                                    <input type="datetime-local" title="Thời gian Mở đề" placeholder="Ngày giờ bắt đầu" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-sm outline-none focus:border-blue-900 text-sm font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Thời gian Đóng đề</label>
                                    <input type="datetime-local" title="Thời gian Đóng đề" placeholder="Ngày giờ kết thúc" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-sm outline-none focus:border-blue-900 text-sm font-bold text-slate-700" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mật khẩu (Để trống nếu thi tự do)</label>
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

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Giao cho Lớp</label>
                                <select 
                                    value={targetClassId} 
                                    onChange={e => setTargetClassId(e.target.value)}
                                    title="Chọn lớp để giao đề thi"
                                    className="w-full border border-slate-300 p-2.5 rounded-sm outline-none focus:border-blue-900 font-bold text-sm"
                                >
                                    <option value="">-- Chưa giao lớp --</option>
                                    {availableClasses.map((cls: any) => (
                                        <option key={cls.$id || cls.id} value={cls.$id || cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Số lần thi tối đa</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    title="Số lần thi tối đa"
                                    placeholder="Ví dụ: 1"
                                    value={maxAttempts} 
                                    onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
                                    className="w-full border border-slate-300 p-2.5 rounded-sm outline-none focus:border-blue-900 text-sm font-bold" 
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Trạng thái phát hành</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2.5 rounded-sm border border-slate-300 hover:border-blue-900 transition-all">
                                        <input type="radio" name="status" checked={examStatus === 'draft'} onChange={() => setExamStatus('draft')} /> <span className="text-xs font-bold text-slate-600">Lưu nháp</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-green-50 px-4 py-2.5 rounded-sm border border-green-200 hover:border-green-600 transition-all">
                                        <input type="radio" name="status" checked={examStatus === 'published'} onChange={() => setExamStatus('published')} /> <span className="text-xs font-bold text-green-700">Xuất bản</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end px-6 py-4 bg-slate-50 border-t border-slate-200">
                            <button onClick={() => setConfigModalOpen(false)} className="px-5 py-2.5 bg-white font-bold text-[10px] uppercase tracking-wider rounded-sm border border-slate-300 hover:bg-slate-100 text-slate-600">Hủy</button>
                            <button onClick={handleSaveConfig} className="px-6 py-2.5 bg-blue-900 text-white font-black text-[10px] uppercase tracking-wider rounded-sm hover:bg-blue-800 border border-blue-800 transition-all">Lưu Cấu Hình</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DASHBOARDS THỐNG KÊ & GIÁM THỊ */}
            {statsExam && (() => {
                const isEnded = statsExam.end_time && new Date(statsExam.end_time).getTime() < Date.now();
                if (isEnded) {
                    return (
                        <ExamAnalytics 
                            examId={statsExam.id} 
                            examTitle={statsExam.title} 
                            onClose={() => setStatsExam(null)} 
                        />
                    );
                } else {
                    return (
                        <LiveProctoring 
                            examId={statsExam.id} 
                            examTitle={statsExam.title} 
                            totalQuestions={getExamTotalQuestions(statsExam)}
                            onClose={() => setStatsExam(null)} 
                        />
                    );
                }
            })()}

            {editingExam && (
                <ExamCreator 
                    editExam={editingExam} 
                    onBack={() => {
                        setEditingExam(null);
                        // Refresh data after edit
                        const fetchData = async () => {
                            const { documents: allExams } = await databaseService.fetchExams(user.id, user.role);
                            const onlineExams = allExams.filter((e: any) => e.exam_purpose === 'online_test' || e.exam_purpose === 'both');
                            // Re-apply filters if needed, but for simplicity just update the whole list
                            setExams(onlineExams.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                        };
                        fetchData();
                    }} 
                />
            )}
        </div>
    );
}
