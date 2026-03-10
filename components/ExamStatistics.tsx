import React, { useState, useEffect, useMemo } from 'react';
import { fetchExamResults } from '../services/databaseService';
import client, { APPWRITE_CONFIG } from '../lib/appwrite';

interface ExamStatisticsProps {
    examId: string;
    examTitle: string;
    onClose: () => void;
}

export default function ExamStatistics({ examId, examTitle, onClose }: ExamStatisticsProps) {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'questions'>('overview');

    useEffect(() => {
        const loadResults = async () => {
            setLoading(true);
            try {
                const data = await fetchExamResults(examId);
                setResults(data);
            } catch (err) {
                console.error('Lỗi tải thống kê:', err);
            } finally {
                setLoading(false);
            }
        };
        loadResults();

        // Lắng nghe realtime từ Appwrite để cập nhật bảng điểm liên tục
        const unsubscribe = client.subscribe(
            `databases.${APPWRITE_CONFIG.dbId}.collections.${APPWRITE_CONFIG.collections.examResults}.documents`,
            response => {
                if (response.events.includes('databases.*.collections.*.documents.*.create') ||
                    response.events.includes('databases.*.collections.*.documents.*.update')) {
                    const payload: any = response.payload;
                    if (payload.exam_id === examId) {
                        setResults(prev => {
                            const existingIndex = prev.findIndex(r => r.$id === payload.$id || r.id === payload.$id || r.id === payload.id);
                            if (existingIndex >= 0) {
                                const newResults = [...prev];
                                newResults[existingIndex] = { ...payload, id: payload.$id || payload.id, createdAt: payload.$createdAt || payload.createdAt };
                                return newResults;
                            } else {
                                return [{ ...payload, id: payload.$id || payload.id, createdAt: payload.$createdAt || payload.createdAt }, ...prev];
                            }
                        });
                    }
                }
            }
        );

        return () => unsubscribe();
    }, [examId]);

    // === TỔNG QUAN ===
    const overviewStats = useMemo(() => {
        if (results.length === 0) return null;
        const scores = results.map(r => r.score || 0);
        const uniqueStudents = new Set(results.map(r => r.student_id));
        const totalTime = results.reduce((sum, r) => sum + (r.time_spent || 0), 0);
        return {
            totalAttempts: results.length,
            uniqueStudents: uniqueStudents.size,
            avgScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
            maxScore: Math.max(...scores).toFixed(2),
            minScore: Math.min(...scores).toFixed(2),
            avgTime: results.length > 0 ? Math.round(totalTime / results.length / 60) : 0,
            passRate: ((scores.filter(s => s >= 5).length / scores.length) * 100).toFixed(1)
        };
    }, [results]);

    // === CHI TIẾT SINH VIÊN ===
    const studentStats = useMemo(() => {
        const studentMap = new Map<string, { name: string; attempts: any[] }>();
        results.forEach(r => {
            const sid = r.student_id;
            if (!studentMap.has(sid)) {
                studentMap.set(sid, { name: r.student_name || 'Học viên', attempts: [] });
            }
            studentMap.get(sid)!.attempts.push(r);
        });
        return Array.from(studentMap.entries()).map(([id, data]) => {
            const scores = data.attempts.map(a => a.score || 0);
            const times = data.attempts.map(a => a.time_spent || 0);
            
            // Xếp mới nhất lên đầu để lấy trạng thái
            const sortedAttempts = [...data.attempts].sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            const latestAttempt = sortedAttempts[0];

            let statusColor = 'text-blue-600';
            let statusText = 'Đã nộp bài';
            if (latestAttempt?.status === 'in_progress') {
                statusColor = 'text-green-600 font-bold animate-pulse';
                statusText = 'Đang thi...';
            } else if (latestAttempt?.status === 'disconnected') {
                statusColor = 'text-red-600 font-black';
                statusText = 'MẤT KẾT NỐI';
            }

            return {
                id,
                name: data.name,
                attemptCount: data.attempts.length,
                bestScore: Math.max(...scores).toFixed(2),
                lastScore: scores[0]?.toFixed(2) || '0',
                statusText: statusText,
                statusColor: statusColor,
                avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 60) : 0,
                lastAttempt: latestAttempt?.createdAt ? new Date(latestAttempt.createdAt).toLocaleString('vi-VN') : 'N/A'
            };
        }).sort((a, b) => parseFloat(b.bestScore) - parseFloat(a.bestScore));
    }, [results]);

    // === PHÂN TÍCH CÂU HỎI ===
    const questionStats = useMemo(() => {
        const qMap = new Map<number, { total: number; wrong: number }>();
        results.forEach(r => {
            try {
                const answersDetail = typeof r.answers_detail === 'string' ? JSON.parse(r.answers_detail) : r.answers_detail;
                if (answersDetail && Array.isArray(answersDetail)) {
                    answersDetail.forEach((detail: any, idx: number) => {
                        if (!qMap.has(idx)) qMap.set(idx, { total: 0, wrong: 0 });
                        const entry = qMap.get(idx)!;
                        entry.total++;
                        if (!detail.isCorrect) entry.wrong++;
                    });
                }
            } catch (e) { /* Bỏ qua dữ liệu lỗi */ }
        });
        return Array.from(qMap.entries())
            .map(([qIndex, data]) => ({
                questionNumber: qIndex + 1,
                totalAnswered: data.total,
                wrongCount: data.wrong,
                wrongRate: data.total > 0 ? ((data.wrong / data.total) * 100).toFixed(1) : '0'
            }))
            .sort((a, b) => parseFloat(b.wrongRate) - parseFloat(a.wrongRate));
    }, [results]);

    const formatMinutes = (mins: number) => {
        if (mins < 1) return '< 1 phút';
        if (mins < 60) return `${mins} phút`;
        return `${Math.floor(mins / 60)}h ${mins % 60}p`;
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-700 to-[#1a5c3e] text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">Thống kê bài thi</h2>
                        <p className="text-green-200 text-sm font-bold mt-1 truncate max-w-md">{examTitle}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                        <i className="fas fa-times text-white"></i>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0">
                    {[
                        { key: 'overview', icon: 'fa-chart-pie', label: 'Tổng quan' },
                        { key: 'students', icon: 'fa-users', label: 'Thí sinh' },
                        { key: 'questions', icon: 'fa-list-check', label: 'Câu hỏi' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                                activeTab === tab.key
                                    ? 'text-blue-600 border-blue-600'
                                    : 'text-slate-400 border-transparent hover:text-slate-600'
                            }`}
                        >
                            <i className={`fas ${tab.icon} mr-2`}></i>{tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <i className="fas fa-circle-notch fa-spin text-3xl text-blue-600"></i>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <i className="fas fa-chart-bar text-5xl mb-4 opacity-50"></i>
                            <p className="font-bold text-lg">Chưa có dữ liệu thống kê</p>
                            <p className="text-sm">Chưa có học viên nào làm bài thi này.</p>
                        </div>
                    ) : (
                        <>
                            {/* TAB: TỔNG QUAN */}
                            {activeTab === 'overview' && overviewStats && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <StatBox icon="fa-users" label="Số thí sinh" value={overviewStats.uniqueStudents} color="blue" />
                                        <StatBox icon="fa-pen-to-square" label="Tổng lượt thi" value={overviewStats.totalAttempts} color="purple" />
                                        <StatBox icon="fa-star" label="Điểm TB" value={overviewStats.avgScore} color="orange" />
                                        <StatBox icon="fa-check-circle" label="Tỉ lệ đạt" value={`${overviewStats.passRate}%`} color="green" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-green-50 border border-blue-200 p-4 rounded-xl text-center">
                                            <p className="text-3xl font-black text-green-700">{overviewStats.maxScore}</p>
                                            <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1">Điểm cao nhất</p>
                                        </div>
                                        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center">
                                            <p className="text-3xl font-black text-red-700">{overviewStats.minScore}</p>
                                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">Điểm thấp nhất</p>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
                                            <p className="text-3xl font-black text-blue-700">{formatMinutes(overviewStats.avgTime)}</p>
                                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Thời gian TB</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: CHI TIẾT THÍ SINH */}
                            {activeTab === 'students' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">STT</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và tên</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Số lần thi</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Điểm cao nhất</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Điểm lần gần nhất</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">TG TB</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lần thi gần nhất</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {studentStats.map((s, idx) => (
                                                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-3 text-sm font-bold text-slate-400">{idx + 1}</td>
                                                    <td className="p-3 text-sm font-bold text-slate-800">{s.name}</td>
                                                    <td className="p-3 text-sm font-bold text-center text-purple-600">{s.attemptCount}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`text-sm font-black px-2 py-1 rounded ${parseFloat(s.bestScore) >= 5 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {s.bestScore}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm font-bold text-center text-slate-600">{s.lastScore}</td>
                                                    <td className="p-3 text-sm text-center">
                                                        <span className={`text-[11px] uppercase tracking-widest ${s.statusColor}`}>{s.statusText}</span>
                                                    </td>
                                                    <td className="p-3 text-sm font-bold text-center text-blue-600">{formatMinutes(s.avgTime)}</td>
                                                    <td className="p-3 text-xs text-slate-500">{s.lastAttempt}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {studentStats.length === 0 && (
                                        <p className="text-center text-slate-400 py-8 text-sm font-bold">Chưa có dữ liệu thí sinh</p>
                                    )}
                                </div>
                            )}

                            {/* TAB: PHÂN TÍCH CÂU HỎI */}
                            {activeTab === 'questions' && (
                                <div>
                                    <p className="text-xs text-slate-500 mb-4 font-bold">Sắp xếp theo tỉ lệ sai từ cao đến thấp — giúp GV nhận diện câu hỏi khó hoặc gây nhầm lẫn.</p>
                                    {questionStats.length === 0 ? (
                                        <div className="text-center text-slate-400 py-12">
                                            <i className="fas fa-info-circle text-3xl mb-3 opacity-50"></i>
                                            <p className="font-bold">Chưa có dữ liệu chi tiết câu hỏi</p>
                                            <p className="text-xs mt-1">Dữ liệu phân tích câu hỏi sẽ có sau khi học viên làm bài.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {questionStats.map(q => (
                                                <div key={q.questionNumber} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                                                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-black text-sm text-slate-700 shrink-0">
                                                        {q.questionNumber}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex justify-between text-xs font-bold">
                                                            <span className="text-slate-600">Tổng lượt trả lời: {q.totalAnswered}</span>
                                                            <span className={`${parseFloat(q.wrongRate) > 50 ? 'text-red-600' : parseFloat(q.wrongRate) > 30 ? 'text-orange-600' : 'text-green-600'}`}>
                                                                Sai: {q.wrongCount} ({q.wrongRate}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                                            <div 
                                                                className={`h-2 rounded-full transition-all ${parseFloat(q.wrongRate) > 50 ? 'bg-red-500' : parseFloat(q.wrongRate) > 30 ? 'bg-orange-400' : 'bg-green-500'}`}
                                                                style={{ width: `${Math.min(parseFloat(q.wrongRate), 100)}%` }}
                                                            ></div>
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

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <i className="fas fa-database mr-1"></i> {results.length} kết quả
                    </p>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-300 transition-all">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

// Sub-component for overview stat boxes
function StatBox({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        purple: 'bg-purple-50 border-purple-200 text-purple-700',
        orange: 'bg-orange-50 border-orange-200 text-orange-700',
        green: 'bg-green-50 border-blue-200 text-green-700'
    };
    return (
        <div className={`p-4 rounded-xl border ${colors[color] || colors.blue} text-center`}>
            <i className={`fas ${icon} text-2xl mb-2 opacity-80`}></i>
            <p className="text-3xl font-black">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{label}</p>
        </div>
    );
}
