import React, { useState, useEffect, useMemo } from 'react';
import { fetchExamResults } from '../../services/databaseService';
import client, { APPWRITE_CONFIG } from '../../lib/appwrite';

interface LiveProctoringProps {
    examId: string;
    examTitle: string;
    totalQuestions: number;
    onClose: () => void;
}

export default function LiveProctoring({ examId, examTitle, totalQuestions, onClose }: LiveProctoringProps) {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadResults = async () => {
            setLoading(true);
            try {
                const data = await fetchExamResults(examId);
                setResults(data);
            } catch (err) {
                console.error('Loi tai du lieu phong thi:', err);
            } finally {
                setLoading(false);
            }
        };

        loadResults();

        const unsubscribe = client.subscribe(
            `databases.${APPWRITE_CONFIG.dbId}.collections.${APPWRITE_CONFIG.collections.examResults}.documents`,
            response => {
                if (
                    response.events.includes('databases.*.collections.*.documents.*.create') ||
                    response.events.includes('databases.*.collections.*.documents.*.update')
                ) {
                    const payload: any = response.payload;
                    if (payload.exam_id === examId) {
                        setResults(prev => {
                            const existingIndex = prev.findIndex(
                                r => r.$id === payload.$id || r.id === payload.$id || r.id === payload.id
                            );

                            if (existingIndex >= 0) {
                                const newResults = [...prev];
                                newResults[existingIndex] = {
                                    ...payload,
                                    id: payload.$id || payload.id,
                                    createdAt: payload.$createdAt || payload.createdAt
                                };
                                return newResults;
                            }

                            return [
                                {
                                    ...payload,
                                    id: payload.$id || payload.id,
                                    createdAt: payload.$createdAt || payload.createdAt
                                },
                                ...prev
                            ];
                        });
                    }
                }
            }
        );

        return () => unsubscribe();
    }, [examId]);

    const activeStudents = useMemo(() => {
        const studentMap = new Map<string, any>();

        results.forEach(r => {
            const sid = r.student_id;
            const currentRecord = studentMap.get(sid);

            if (!currentRecord) {
                studentMap.set(sid, r);
                return;
            }

            const currentCreatedAt = new Date(currentRecord.createdAt || 0).getTime();
            const newCreatedAt = new Date(r.createdAt || 0).getTime();

            if (newCreatedAt > currentCreatedAt) {
                studentMap.set(sid, r);
            }
        });

        return Array.from(studentMap.values())
            .map(r => {
                const rawStatus = String(r.status || '').toLowerCase();
                let statusLabel = 'Da nop bai';
                let statusBadgeClass = 'bg-blue-100 text-blue-700';
                let statusIcon = 'fa-check-circle';

                if (rawStatus === 'in_progress') {
                    statusLabel = 'Dang thi';
                    statusBadgeClass = 'bg-green-100 text-green-700';
                    statusIcon = 'fa-circle';
                } else if (rawStatus === 'disconnected' || rawStatus === 'warning_tab_switch' || rawStatus === 'warning') {
                    statusLabel = rawStatus === 'disconnected' ? 'Mat ket noi' : 'Canh bao';
                    statusBadgeClass = 'bg-red-100 text-red-700';
                    statusIcon = 'fa-exclamation-triangle';
                } else if (rawStatus === 'submitted') {
                    statusLabel = 'Da nop bai';
                    statusBadgeClass = 'bg-blue-100 text-blue-700';
                    statusIcon = 'fa-check-circle';
                }

                return {
                    id: r.id || r.$id,
                    studentId: r.student_id,
                    name: r.student_name || 'Hoc vien',
                    timeLeft: Number(r.remainingTime) || 0,
                    answeredCount: Number(r.answeredCount) || 0,
                    redFlags: Number(r.redFlags) || 0,
                    statusLabel,
                    statusBadgeClass,
                    statusIcon
                };
            })
            .sort((a, b) => b.redFlags - a.redFlags);
    }, [results]);

    const formatTime = (seconds: number) => {
        if (!seconds || seconds <= 0) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-6xl rounded-sm shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-2 border-slate-400">
                <div className="p-6 border-b-4 border-red-500 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-600 rounded-sm flex items-center justify-center animate-pulse">
                            <i className="fas fa-video text-xl text-white"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-widest text-red-500">LIVE PROCTORING</h2>
                            <p className="text-slate-300 text-xs font-mono mt-1 font-bold truncate max-w-xl">
                                GIAM THI THOI GIAN THUC - {examTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-sm bg-white/10 hover:bg-red-600 flex items-center justify-center transition-all border border-slate-700"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="bg-slate-100 border-b border-slate-300 px-6 py-3 shrink-0 flex gap-6 text-xs font-mono">
                    <span className="flex items-center gap-2 text-slate-700 font-bold">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        He thong dang theo doi {activeStudents.length} thi sinh
                    </span>
                    <span className="flex items-center gap-2 text-red-700 font-bold ml-auto">
                        <i className="fas fa-shield-alt"></i> Anti-Cheat Active
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <i className="fas fa-radar fa-spin text-3xl text-red-600"></i>
                            <span className="ml-3 font-mono font-bold text-slate-500">Dang quet phong thi...</span>
                        </div>
                    ) : activeStudents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <i className="fas fa-user-slash text-5xl mb-4 opacity-50"></i>
                            <p className="font-bold text-lg uppercase tracking-wider">Phong thi trong</p>
                            <p className="text-sm font-mono mt-1">Chua co thi sinh nao vao thi luc nay.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-sm border border-slate-300 shadow-sm bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-200 border-b-2 border-slate-300">
                                    <tr>
                                        <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Ho va ten</th>
                                        <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">Thoi gian con lai</th>
                                        <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">Tien do</th>
                                        <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">Redflag</th>
                                        <th className="p-4 text-[11px] font-black text-slate-600 uppercase tracking-widest text-center">Trang thai</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeStudents.map(s => {
                                        const safeTotalQuestions = Math.max(0, Number(totalQuestions) || 0);
                                        const safeAnsweredCount = Math.max(0, s.answeredCount);
                                        const percent =
                                            safeTotalQuestions > 0
                                                ? Math.min(100, Math.round((safeAnsweredCount / safeTotalQuestions) * 100) || 0)
                                                : 0;

                                        return (
                                            <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors align-top">
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                        <i className="fas fa-user-graduate text-slate-400"></i> {s.name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {s.studentId}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="inline-block bg-slate-800 text-white font-mono font-bold text-sm px-3 py-1.5 rounded-sm border border-slate-900 shadow-inner">
                                                        {formatTime(s.timeLeft)}
                                                    </div>
                                                </td>
                                                <td className="p-4 min-w-[260px]">
                                                    <div className="w-full">
                                                        <div className="w-full bg-slate-200 rounded-full h-2.5 mt-1">
                                                            <div
                                                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                                                style={{ width: `${percent}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-xs text-slate-500 mt-1 inline-block">
                                                            {safeAnsweredCount}/{safeTotalQuestions} cau ({percent}%)
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {s.redFlags > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold bg-red-600 text-white animate-pulse">
                                                            ⚠️ {s.redFlags}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold bg-slate-100 text-slate-500">
                                                            0
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-bold ${s.statusBadgeClass}`}
                                                    >
                                                        {(s.statusIcon === 'fa-exclamation-triangle' || s.statusLabel === 'Mat ket noi') && '⚠️'}
                                                        <i className={`fas ${s.statusIcon}`}></i>
                                                        {s.statusLabel}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
