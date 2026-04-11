import React, { useState, useEffect, useMemo } from 'react';
import { databaseService, fetchExamResults, updateExamResultAI_Evaluation } from '../../services/databaseService';
import client, { APPWRITE_CONFIG } from '../../lib/appwrite';
import { generateStudentPerformanceEvaluation } from '../../services/geminiService';
import { Exam } from '../../types';

interface ExamControlDashboardProps {
    exam: Exam;
    onClose: () => void;
    onConfigSave: (payload: any) => void;
    totalQuestions: number;
}

export default function ExamControlDashboard({ exam, onClose, onConfigSave, totalQuestions }: ExamControlDashboardProps) {
    const [activeMenu, setActiveMenu] = useState<'config' | 'live' | 'stats_overview' | 'stats_scores' | 'stats_wrong'>('live');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingAILoading, setGeneratingAILoading] = useState<Record<string, boolean>>({});

    // === CONFIG STATE ===
    const [startTime, setStartTime] = useState(exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '');
    const [endTime, setEndTime] = useState(exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : '');
    const [examPassword, setExamPassword] = useState(exam.exam_password || '');
    const [shuffleQ, setShuffleQ] = useState(exam.shuffle_questions !== false);
    const [shuffleO, setShuffleO] = useState(exam.shuffle_options !== false);
    const [examStatus, setExamStatus] = useState(exam.status || 'draft');
    const [targetClassId, setTargetClassId] = useState(exam.class_id || '');
    const [maxAttempts, setMaxAttempts] = useState(exam.max_attempts || 1);

    useEffect(() => {
        const loadResults = async () => {
            setLoading(true);
            try {
                const data = await fetchExamResults(exam.id);
                setResults(data);
            } catch (err) { }
            finally { setLoading(false); }
        };
        loadResults();

        const unsubscribe = client.subscribe(
            `databases.${APPWRITE_CONFIG.dbId}.collections.${APPWRITE_CONFIG.collections.examResults}.documents`,
            response => {
                if (response.events.some(e => e.includes('.documents.*.create') || e.includes('.documents.*.update'))) {
                    const payload: any = response.payload;
                    if (payload.exam_id === exam.id) {
                        setResults(prev => {
                            const idx = prev.findIndex(r => r.$id === payload.$id || r.id === payload.$id);
                            if (idx >= 0) {
                                const newR = [...prev];
                                newR[idx] = { ...payload, id: payload.$id || payload.id };
                                return newR;
                            }
                            return [{ ...payload, id: payload.$id || payload.id }, ...prev];
                        });
                    }
                }
            }
        );
        return () => unsubscribe();
    }, [exam.id]);

    const activeStudents = useMemo(() => {
        const studentMap = new Map<string, any>();
        results.forEach(r => {
            const current = studentMap.get(r.student_id);
            if (!current || new Date(r.createdAt || 0).getTime() > new Date(current.createdAt || 0).getTime()) {
                studentMap.set(r.student_id, r);
            }
        });
        return Array.from(studentMap.values()).map(r => ({ ...r, id: r.id || r.$id }));
    }, [results]);

    const validCompletedResults = results.filter((r: any) => r.status === 'submitted' || r.score > 0 || r.answers_data);

    // AI Generation Handler
    const handleGenerateAI = async (studentId: string, resultId: string) => {
        setGeneratingAILoading(prev => ({ ...prev, [resultId]: true }));
        try {
            const rs = results.find(r => r.id === resultId || r.$id === resultId);
            if (!rs) throw new Error("Result not found");
            
            let timeSpentStr = "0 phút";
            let wrongContents: string[] = [];
            
            try {
                if (rs.answers_data) {
                    const data = JSON.parse(rs.answers_data);
                    const m = Math.floor((data.time_spent || 0) / 60);
                    const s = (data.time_spent || 0) % 60;
                    timeSpentStr = `${m}p ${s}s`;
                    
                    if (data.answers_detail) {
                        wrongContents = Object.values(data.answers_detail)
                            .filter((d: any) => !d.is_correct)
                            .map((d: any) => d.question_content || 'Câu hỏi ẩn');
                    }
                }
            } catch (e) {}

            const evaluation = await generateStudentPerformanceEvaluation(
                rs.student_name || 'Học viên',
                rs.score || 0,
                timeSpentStr,
                Number(rs.redFlags) || 0,
                wrongContents.slice(0, 5) // Chỉ lấy max 5 câu sai để tránh prompt quá dài
            );

            await updateExamResultAI_Evaluation(resultId, evaluation);
            
            // Xóa loading do realtime tự update results
            setTimeout(() => {
                setGeneratingAILoading(prev => ({ ...prev, [resultId]: false }));
            }, 1000);
        } catch (error) {
            alert("Lỗi khi sinh đánh giá AI.");
            setGeneratingAILoading(prev => ({ ...prev, [resultId]: false }));
        }
    };

    // Render SideBar
    const renderSidebar = () => (
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0">
            <div className="p-5 border-b border-slate-200">
                <button onClick={onClose} className="text-slate-500 hover:text-blue-900 text-sm font-bold flex items-center gap-2 mb-4">
                    <i className="fas fa-chevron-left"></i> Quay lại
                </button>
                <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-file-alt text-yellow-500 text-xl"></i>
                    <h2 className="font-black text-slate-800 uppercase tracking-widest line-clamp-2 leading-tight">{exam.title}</h2>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-2"><i className="far fa-calendar-alt mr-1"></i> Ngày tạo: {new Date(exam.createdAt || Date.now()).toLocaleDateString('vi-VN')}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-1"><i className="far fa-user mr-1"></i> Loại bài thi: {exam.exam_type}</p>
            </div>
            <div className="flex-1 py-4 overflow-y-auto">
                <p className="px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Menu QUẢN LÝ</p>
                <div className="space-y-1">
                    <button onClick={() => setActiveMenu('config')} className={`w-full text-left px-5 py-3 text-xs font-bold transition-all border-l-4 ${activeMenu === 'config' ? 'bg-blue-50/50 border-blue-900 text-blue-900' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                        <i className="fas fa-cog w-6"></i> Cài đặt chung
                    </button>
                    <button onClick={() => setActiveMenu('live')} className={`w-full text-left px-5 py-3 text-xs font-bold transition-all border-l-4 ${activeMenu === 'live' ? 'bg-red-50/50 border-red-600 text-red-600' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                        <i className="fas fa-video w-6"></i> Giám thị Live
                    </button>
                    <button onClick={() => setActiveMenu('stats_overview')} className={`w-full text-left px-5 py-3 text-xs font-bold transition-all border-l-4 ${activeMenu === 'stats_overview' ? 'bg-amber-50/50 border-amber-600 text-amber-600' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                        <i className="fas fa-chart-line w-6"></i> Thống kê
                    </button>
                    <button onClick={() => setActiveMenu('stats_wrong')} className={`w-full text-left px-5 py-3 text-xs font-bold transition-all border-l-4 ${activeMenu === 'stats_wrong' ? 'bg-amber-50/50 border-amber-600 text-amber-600' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                        <i className="fas fa-history w-6"></i> Nhận diện câu sai
                    </button>
                    <button onClick={() => setActiveMenu('stats_scores')} className={`w-full text-left px-5 py-3 text-xs font-bold transition-all border-l-4 ${activeMenu === 'stats_scores' ? 'bg-blue-50/50 border-purple-600 text-purple-600' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                        <i className="fas fa-clipboard-list w-6"></i> Bảng điểm & Nhận xét
                    </button>
                </div>
            </div>
        </div>
    );

    // render partials...
    return (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col md:flex-row overflow-hidden">
            {/* Top Bar for Azota mockup feel */}
            <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-r from-blue-900 to-blue-800 shadow-md flex items-center justify-between px-6 z-20">
                 <div className="font-black text-white text-lg tracking-widest">
                     BLUEBEE <span className="text-yellow-400">CONTROL</span>
                 </div>
                 <div className="flex gap-4">
                     <button className="bg-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-white border border-white/20"><i className="fas fa-download mr-2"></i>Export</button>
                     <button onClick={onClose} className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"><i className="fas fa-times"></i></button>
                 </div>
            </div>
            
            <div className="flex flex-1 pt-14 h-screen">
                {renderSidebar()}
                
                <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                     {activeMenu === 'live' && (
                         <div>
                             <h2 className="text-xl font-black text-red-600 uppercase tracking-widest mb-6"><i className="fas fa-satellite-dish mr-2 animate-pulse"></i> LIVE PROCTORING</h2>
                             
                             <div className="bg-white p-6 rounded-sm shadow-sm border border-slate-200">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-100 border-b-2 border-slate-300">
                                            <tr>
                                                <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Họ và tên</th>
                                                <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">Tiến độ</th>
                                                <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">Redflag</th>
                                                <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeStudents.map(s => {
                                                const safeAns = Math.max(0, s.answeredCount || 0);
                                                const maxQ = Math.max(0, totalQuestions || 0);
                                                const percent = maxQ > 0 ? Math.round((safeAns/maxQ)*100) : 0;
                                                const rawStatus = (s.status||'').toLowerCase();
                                                
                                                let stLabel = 'Đã nộp bài';
                                                let iconClass = 'fas fa-check text-blue-500';
                                                if(rawStatus === 'in_progress') { stLabel='Đang thi'; iconClass='fas fa-circle text-green-500 animate-pulse'; }
                                                else if(rawStatus === 'disconnected') { stLabel='Mất kết nối'; iconClass='fas fa-exclamation-triangle text-red-500'; }

                                                return (
                                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 last:border-0">
                                                        <td className="p-4 font-bold text-slate-700 text-sm">{s.student_name || 'Học viên'}</td>
                                                        <td className="p-4">
                                                            <div className="w-full bg-slate-200 rounded-full h-2.5">
                                                                <div className="bg-blue-600 h-2.5 rounded-full" style={{width:`${percent}%`}}></div>
                                                            </div>
                                                            <div className="text-[10px] text-center mt-1 text-slate-500">{percent}%</div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {s.redFlags > 0 ? <span className="text-xs font-bold bg-red-600 text-white px-2 py-1 rounded-sm animate-pulse">⚠️ {s.redFlags}</span> : <span className="text-slate-400">-</span>}
                                                        </td>
                                                        <td className="p-4 text-center font-bold text-xs"><i className={iconClass + " mr-1"}></i> {stLabel}</td>
                                                    </tr>
                                                );
                                            })}
                                            {activeStudents.length === 0 && (
                                                <tr><td colSpan={4} className="text-center py-8 text-slate-400 font-mono text-sm">Phòng thi chưa có người tham gia...</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                         </div>
                     )}

                     {activeMenu === 'stats_scores' && (
                         <div>
                             <h2 className="text-xl font-black text-purple-700 uppercase tracking-widest mb-6"><i className="fas fa-clipboard-list mr-2"></i> Danh sách đã thi ({validCompletedResults.length} người)</h2>
                             <div className="overflow-x-auto bg-white rounded-sm shadow-sm border border-slate-200">
                                 <table className="w-full text-left border-collapse">
                                     <thead className="bg-slate-100 border-b border-slate-200">
                                         <tr>
                                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-12 text-center">STT</th>
                                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Họ tên & Thông tin bài</th>
                                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Điểm</th>
                                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[45%]">AI Nhận Xét & Đánh Giá</th>
                                         </tr>
                                     </thead>
                                     <tbody>
                                         {validCompletedResults.sort((a,b) => b.score - a.score).map((r, i) => {
                                             let answersData: any = {};
                                             try { if(r.answers_data) answersData = JSON.parse(r.answers_data); } catch(e){}
                                             const evalText = answersData.ai_evaluation;
                                             
                                             return (
                                                 <tr key={r.id || r.$id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                     <td className="p-4 text-center font-mono font-bold text-slate-400">{i+1}</td>
                                                     <td className="p-4">
                                                         <div className="font-bold text-slate-800 text-sm mb-1">{r.student_name || 'User'}</div>
                                                         <div className="text-[10px] text-slate-500 flex gap-3">
                                                             <span><i className="far fa-clock"></i> Thời gian: {Math.floor((answersData.time_spent||0)/60)}p {(answersData.time_spent||0)%60}s</span>
                                                             <span><i className="fas fa-exclamation-triangle text-red-400"></i> Vi phạm: {r.redFlags||0}</span>
                                                         </div>
                                                     </td>
                                                     <td className="p-4 text-center">
                                                         <span className={`inline-block min-w-[32px] px-2 py-1 rounded-sm text-sm font-black ${r.score >= 8 ? 'bg-green-100 text-green-700' : r.score >= 5 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                             {(r.score||0).toFixed(2)}
                                                         </span>
                                                     </td>
                                                     <td className="p-4">
                                                         {evalText ? (
                                                             <div className="bg-purple-50 border border-purple-100 p-3 rounded-sm text-xs text-purple-900 leading-relaxed font-medium">
                                                                 <i className="fas fa-sparkles text-purple-400 mr-2"></i>{evalText}
                                                             </div>
                                                         ) : (
                                                             generatingAILoading[r.id || r.$id] ? (
                                                                 <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                                                                     <i className="fas fa-circle-notch fa-spin"></i> Đang phân tích bài làm AI...
                                                                 </div>
                                                             ) : (
                                                                 <button onClick={() => handleGenerateAI(r.student_id, r.id || r.$id)} className="bg-white border border-purple-300 text-purple-700 hover:bg-purple-600 hover:text-white transition-all px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                                                     <i className="fas fa-robot text-sm"></i> Tổng hợp nhận xét AI
                                                                 </button>
                                                             )
                                                         )}
                                                     </td>
                                                 </tr>
                                             );
                                         })}
                                         {validCompletedResults.length === 0 && (
                                             <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Chưa có bài thi nào được nộp.</td></tr>
                                         )}
                                     </tbody>
                                 </table>
                             </div>
                         </div>
                     )}

                     {activeMenu === 'config' && (
                         <div className="max-w-2xl">
                             <h2 className="text-xl font-black text-slate-700 uppercase tracking-widest mb-6"><i className="fas fa-cog mr-2"></i> Cài đặt Bài thi</h2>
                             <div className="bg-white p-6 border border-slate-200 rounded-sm shadow-sm space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Giờ mở đề</label>
                                        <input type="datetime-local" className="w-full border p-2 text-sm focus:border-blue-900" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Giờ đóng đề</label>
                                        <input type="datetime-local" className="w-full border p-2 text-sm focus:border-blue-900" value={endTime} onChange={e => setEndTime(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu thi</label>
                                    <input type="text" placeholder="Để trống nếu tự do" className="w-full border p-2 text-sm focus:border-blue-900" value={examPassword} onChange={e => setExamPassword(e.target.value)} />
                                </div>
                                <div className="flex gap-6 border-y border-slate-100 py-4">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4 accent-blue-900" checked={shuffleQ} onChange={e => setShuffleQ(e.target.checked)}/> Đảo câu hỏi
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4 accent-blue-900" checked={shuffleO} onChange={e => setShuffleO(e.target.checked)}/> Đảo đáp án
                                    </label>
                                </div>
                                <div className="pt-2 flex justify-end gap-3">
                                    <button onClick={() => {
                                        onConfigSave({ 
                                            start_time: startTime ? new Date(startTime).toISOString() : null, 
                                            end_time: endTime ? new Date(endTime).toISOString() : null,
                                            exam_password: examPassword, shuffle_questions: shuffleQ, shuffle_options: shuffleO
                                        });
                                    }} className="bg-blue-900 text-white px-6 py-2 rounded-sm text-xs font-black uppercase tracking-wider hover:bg-blue-800 transition-all shadow-sm">
                                        Lưu cấu hình
                                    </button>
                                </div>
                             </div>
                         </div>
                     )}

                     {activeMenu === 'stats_overview' && (
                         <div className="flex items-center justify-center h-64 text-slate-400">
                             <div>
                                 <i className="fas fa-tools text-4xl mb-4 opacity-50 block text-center"></i>
                                 <p className="font-bold text-sm uppercase tracking-widest text-center">Đang phát triển Tab Tổng Quan (Beta)</p>
                                 <p className="text-center font-mono mt-1 text-xs">Vui lòng xem "Bảng điểm" trước.</p>
                             </div>
                         </div>
                     )}
                     
                     {activeMenu === 'stats_wrong' && (
                         <div className="flex items-center justify-center h-64 text-slate-400">
                             <div>
                                 <i className="fas fa-tools text-4xl mb-4 opacity-50 block text-center"></i>
                                 <p className="font-bold text-sm uppercase tracking-widest text-center">Đang phát triển Tab Nội dung (Beta)</p>
                             </div>
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
}
