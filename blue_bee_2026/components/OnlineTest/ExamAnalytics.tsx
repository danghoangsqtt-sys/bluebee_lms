import React, { useState, useEffect, useMemo } from 'react';
import { fetchExamResults } from '../../services/databaseService';

interface ExamAnalyticsProps {
    examId: string;
    examTitle: string;
    onClose: () => void;
}

export default function ExamAnalytics({ examId, examTitle, onClose }: ExamAnalyticsProps) {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'insights'>('overview');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        const loadResults = async () => {
            setLoading(true);
            try {
                const data = await fetchExamResults(examId);
                // Lọc những bài đã nộp hoặc ít nhất có answers_data (người dùng thoát giữa chừng nhưng có data)
                const validData = data.filter((r: any) => r.status === 'submitted' || r.score > 0 || r.answers_data);
                setResults(validData);
            } catch (err) {
                console.error('Lỗi tải dữ liệu phân tích:', err);
            } finally {
                setLoading(false);
            }
        };
        loadResults();
    }, [examId]);

    // === TỔNG QUAN ===
    const overviewStats = useMemo(() => {
        if (results.length === 0) return null;
        
        const scores = results.map(r => r.score || 0);
        const uniqueStudents = new Set(results.map(r => r.student_id));
        
        let avgScore = 0;
        if (scores.length > 0) {
            avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        const passRate = scores.length > 0 ? (scores.filter(s => s >= 5).length / scores.length) * 100 : 0;

        // Phổ điểm (Distribution)
        const distribution = {
            '0-4': scores.filter(s => s < 4).length,
            '4-6': scores.filter(s => s >= 4 && s < 6).length,
            '6-8': scores.filter(s => s >= 6 && s < 8).length,
            '8-10': scores.filter(s => s >= 8).length,
        };

        return {
            totalAttempts: results.length,
            uniqueStudents: uniqueStudents.size,
            avgScore: avgScore.toFixed(2),
            passRate: passRate.toFixed(1),
            distribution
        };
    }, [results]);

    // === DANH SÁCH THÍ SINH (Sortable) ===
    const studentList = useMemo(() => {
        const studentMap = new Map<string, any>();
        results.forEach(r => {
            const sid = r.student_id;
            // Lấy điểm cao nhất của từng thí sinh nếu họ thi nhiều lần
            if (!studentMap.has(sid) || (r.score || 0) > (studentMap.get(sid).score || 0)) {
                studentMap.set(sid, r);
            }
        });

        const list = Array.from(studentMap.values()).map((r, idx) => {
            let timeSpent = 0;
            try {
                if (r.answers_data) {
                    const data = JSON.parse(r.answers_data);
                    timeSpent = data.time_spent || 0;
                }
            } catch(e) {}
            
            return {
                id: r.id || r.$id,
                name: r.student_name || 'Học viên',
                score: r.score || 0,
                timeSpent: timeSpent
            };
        });

        return list.sort((a, b) => sortOrder === 'desc' ? b.score - a.score : a.score - b.score);
    }, [results, sortOrder]);

    // === THỐNG KÊ CÂU SAI (MapReduce) ===
    const topWrongQuestions = useMemo(() => {
        const wrongMap: Record<string, { content: string, wrongStudents: Set<string> }> = {};

        results.forEach(r => {
            if (r.answers_data) {
                try {
                    const data = JSON.parse(r.answers_data);
                    if (data.answers_detail) {
                        const details = data.answers_detail;
                        const sName = r.student_name || 'Ẩn danh';
                        
                        Object.keys(details).forEach(qId => {
                            if (!details[qId].is_correct) {
                                if (!wrongMap[qId]) {
                                    wrongMap[qId] = { 
                                        content: details[qId].question_content, 
                                        wrongStudents: new Set() 
                                    };
                                }
                                wrongMap[qId].wrongStudents.add(sName);
                            }
                        });
                    }
                } catch(e) { }
            }
        });

        return Object.values(wrongMap)
            .map(w => ({
                content: w.content,
                wrongCount: w.wrongStudents.size,
                students: Array.from(w.wrongStudents)
            }))
            .sort((a, b) => b.wrongCount - a.wrongCount)
            .slice(0, 5); // Tính Top 5
    }, [results]);

    const formatTime = (seconds: number) => {
        if (!seconds || seconds <= 0) return '0 phút';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}p ${s}s`;
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm shadow-2xl">
            <div className="bg-white w-full max-w-5xl rounded-sm flex flex-col max-h-[90vh] overflow-hidden border border-slate-300">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-900 to-blue-800 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-widest text-amber-500">
                            <i className="fas fa-chart-line mr-2"></i> POST-EXAM ANALYTICS
                        </h2>
                        <p className="text-blue-200 text-xs font-bold mt-1 max-w-xl truncate uppercase tracking-widest">{examTitle}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-sm bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center border border-transparent hover:border-white/30">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0">
                    {[
                        { key: 'overview', icon: 'fa-chart-pie', label: '1. Thống kê tổng quan' },
                        { key: 'students', icon: 'fa-users', label: '2. Bảng Thí sinh' },
                        { key: 'insights', icon: 'fa-lightbulb', label: '3. Critical Insights' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                                activeTab === tab.key
                                    ? 'text-blue-900 border-blue-900 bg-blue-50/50'
                                    : 'text-slate-400 border-transparent hover:text-slate-600'
                            }`}
                        >
                            <i className={`fas ${tab.icon} mr-2`}></i>{tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                            <i className="fas fa-circle-notch fa-spin text-4xl text-blue-900"></i>
                            <span className="font-mono text-xs font-bold text-slate-500 uppercase tracking-widest">Đang tải dữ liệu...</span>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <i className="fas fa-database text-5xl mb-4 opacity-50"></i>
                            <p className="font-black text-lg uppercase tracking-widest">Chưa có dữ liệu</p>
                            <p className="text-sm font-mono mt-1">Chưa có ai hoàn thành bài kiểm tra này.</p>
                        </div>
                    ) : (
                        <>
                            {/* TAB 1: TỔNG QUAN */}
                            {activeTab === 'overview' && overviewStats && (
                                <div className="space-y-8 animate-fade-in-up">
                                    {/* Top boxes */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm text-center">
                                            <i className="fas fa-star text-amber-500 text-3xl mb-3"></i>
                                            <p className="text-4xl font-black text-slate-800">{overviewStats.avgScore}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Điểm trung bình</p>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm text-center">
                                            <i className="fas fa-check-circle text-green-500 text-3xl mb-3"></i>
                                            <p className="text-4xl font-black text-slate-800">{overviewStats.passRate}%</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Tỷ lệ đạt (&gt;= 5.0)</p>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm text-center">
                                            <i className="fas fa-file-signature text-blue-500 text-3xl mb-3"></i>
                                            <p className="text-4xl font-black text-slate-800">{overviewStats.totalAttempts}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Lượt nộp bài</p>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm text-center">
                                            <i className="fas fa-users text-purple-500 text-3xl mb-3"></i>
                                            <p className="text-4xl font-black text-slate-800">{overviewStats.uniqueStudents}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Số Thí sinh</p>
                                        </div>
                                    </div>

                                    {/* Distribution Chart (Simple Bar) */}
                                    <div className="bg-white p-6 rounded-sm shadow-sm border border-slate-200">
                                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6 border-b pb-2"><i className="fas fa-chart-bar text-blue-900 mr-2"></i> Phổ điểm</h3>
                                        <div className="flex items-end gap-4 h-48 px-10">
                                            {Object.entries(overviewStats.distribution).map(([label, count]: any) => {
                                                const height = overviewStats.totalAttempts > 0 ? (count / overviewStats.totalAttempts) * 100 : 0;
                                                return (
                                                    <div key={label} className="flex-1 flex flex-col items-center justify-end h-full group">
                                                        <span className="text-sm font-bold text-blue-900 mb-2">{count}</span>
                                                        <div 
                                                            className="w-full max-w-[60px] bg-blue-500 hover:bg-blue-600 rounded-t-sm transition-all duration-500 flex items-end justify-center pb-2 cursor-crosshair"
                                                            style={{ height: `${Math.max(height, 5)}%` }}
                                                        ></div>
                                                        <span className="text-[10px] font-bold text-slate-500 mt-3 pt-2 border-t border-slate-200 w-full text-center">{label} Đ</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: DANH SÁCH THÍ SINH */}
                            {activeTab === 'students' && (
                                <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden animate-fade-in-up">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-100 border-b border-slate-200">
                                                <tr>
                                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-16 text-center">STT</th>
                                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Họ Tên Thí Sinh</th>
                                                    <th 
                                                        className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-200 transition-colors select-none text-center"
                                                        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                                                        title="Bấm để sắp xếp lại"
                                                    >
                                                        Điểm Số cao nhất <i className={`fas fa-sort-amount-${sortOrder === 'desc' ? 'down' : 'up'} ml-1 text-blue-600`}></i>
                                                    </th>
                                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Thời gian làm bài</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {studentList.map((s, idx) => (
                                                    <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30 transition-colors">
                                                        <td className="p-4 text-sm font-mono text-slate-400 text-center">{idx + 1}</td>
                                                        <td className="p-4 text-sm font-bold text-slate-800">{s.name}</td>
                                                        <td className="p-4 text-center">
                                                            <span className={`inline-block min-w-[3rem] px-2 py-1 rounded-sm text-sm font-black ${s.score >= 8 ? 'bg-green-100 text-green-700' : s.score >= 5 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                                {s.score.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-sm font-mono text-slate-600 text-center">{formatTime(s.timeSpent)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: CRITICAL INSIGHTS (CÂU SAI) */}
                            {activeTab === 'insights' && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-amber-800 text-xs font-bold flex gap-3 shadow-sm">
                                        <i className="fas fa-lightbulb text-amber-500 text-lg mt-0.5"></i>
                                        <p className="leading-relaxed font-mono">
                                            Insight tự động quét qua toàn bộ bài làm của thí sinh để lọc ra <strong>Top 5 câu hỏi bị trả lời sai nhiều nhất</strong>. <br/>
                                            Thông tin này giúp giảng viên nắm bắt được lỗ hổng kiến thức chung và điều chỉnh lại bài giảng của mình.
                                        </p>
                                    </div>

                                    {topWrongQuestions.length === 0 ? (
                                        <div className="text-center text-slate-400 py-12 bg-white rounded-sm border border-slate-200">
                                            <p className="font-bold uppercase tracking-widest">Tuyệt vời! Không có ai trả lời sai.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {topWrongQuestions.map((q, idx) => (
                                                <div key={idx} className="bg-white border-l-4 border-red-500 border-y border-r border-slate-200 p-6 rounded-r-sm shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex gap-3">
                                                            <div className="w-8 h-8 bg-red-100 text-red-700 rounded-sm flex items-center justify-center font-black shrink-0">
                                                                #{idx + 1}
                                                            </div>
                                                            <div className="text-sm font-medium text-slate-800 italic bg-slate-50 p-3 rounded-sm border border-slate-100">
                                                                "{q.content}..."
                                                            </div>
                                                        </div>
                                                        <div className="text-2xl font-black text-red-600 shrink-0 text-right ml-4">
                                                            {q.wrongCount} <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mt-1">Lượt sai</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2"><i className="fas fa-user-times mr-1"></i> Danh sách học viên trả lời sai:</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {q.students.map((sName, sIdx) => (
                                                                <span key={sIdx} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-sm text-[10px] font-bold border border-slate-200 hover:bg-red-50 hover:text-red-600 transition-colors cursor-default">
                                                                    {sName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
