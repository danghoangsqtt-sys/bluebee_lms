import React, { useMemo, useState } from 'react';

interface ExamStatsWrongAnalysisProps {
    results: any[];
    questions: any[];
}

// Helper: parse answers_data JSON safely
const parseAnswersData = (r: any): any => {
    if (!r.answers_data) return {};
    try { return JSON.parse(r.answers_data); } catch { return {}; }
};

// Helper: get latest result per student
const getLatestPerStudent = (results: any[]): any[] => {
    const map = new Map<string, any>();
    results.forEach(r => {
        const sid = r.student_id;
        const existing = map.get(sid);
        const rTime = new Date(r.createdAt || 0).getTime();
        const eTime = existing ? new Date(existing.createdAt || 0).getTime() : 0;
        if (!existing || rTime > eTime) map.set(sid, r);
    });
    return Array.from(map.values());
};

interface QuestionStat {
    qIndex: number;
    qId: string;
    totalStudents: number;
    answered: number;
    notAnswered: number;
    correct: number;
    wrong: number;
    incompletePct: string;
    correctStudents: string[];
    wrongStudents: string[];
    notAnsweredStudents: string[];
    // Question content for preview
    questionContent: string;
}

export default function ExamStatsWrongAnalysis({ results, questions }: ExamStatsWrongAnalysisProps) {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [previewQuestion, setPreviewQuestion] = useState<string | null>(null);
    const [sortColumn, setSortColumn] = useState<string>('index');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Valid results - submitted or has data
    const validResults = useMemo(() =>
        results.filter(r => r.status === 'submitted' || r.score > 0 || r.answers_data),
    [results]);

    // Latest attempt per student
    const latestResults = useMemo(() => getLatestPerStudent(validResults), [validResults]);

    // Build per-question stats
    const questionStats: QuestionStat[] = useMemo(() => {
        if (questions.length === 0) return [];

        const totalStudents = latestResults.length;

        return questions.map((q, idx) => {
            const qId = q.id || `q-${idx}`;
            const correctStudents: string[] = [];
            const wrongStudents: string[] = [];
            const notAnsweredStudents: string[] = [];

            latestResults.forEach(r => {
                const ad = parseAnswersData(r);
                const name = r.student_name || ad.student_name || 'Học viên';
                const detail = ad.answers_detail?.[qId];

                if (!detail || !detail.s) {
                    // Student didn't answer this question
                    notAnsweredStudents.push(name);
                } else if (detail.k === true) {
                    correctStudents.push(name);
                } else {
                    wrongStudents.push(name);
                }
            });

            const answered = correctStudents.length + wrongStudents.length;
            const notAnswered = notAnsweredStudents.length;
            const incompletePct = totalStudents > 0
                ? ((notAnswered / totalStudents) * 100).toFixed(0) + '%'
                : '0%';

            return {
                qIndex: idx,
                qId,
                totalStudents,
                answered,
                notAnswered,
                correct: correctStudents.length,
                wrong: wrongStudents.length,
                incompletePct,
                correctStudents,
                wrongStudents,
                notAnsweredStudents,
                questionContent: typeof q.content === 'string' ? q.content : (q.content?.content || JSON.stringify(q.content))
            };
        });
    }, [questions, latestResults]);

    // Sortable
    const sortedStats = useMemo(() => {
        const sorted = [...questionStats];
        sorted.sort((a, b) => {
            let valA: number, valB: number;
            switch (sortColumn) {
                case 'answered': valA = a.answered; valB = b.answered; break;
                case 'notAnswered': valA = a.notAnswered; valB = b.notAnswered; break;
                case 'correct': valA = a.correct; valB = b.correct; break;
                case 'wrong': valA = a.wrong; valB = b.wrong; break;
                case 'incomplete': valA = parseFloat(a.incompletePct); valB = parseFloat(b.incompletePct); break;
                default: valA = a.qIndex; valB = b.qIndex;
            }
            return sortDir === 'asc' ? valA - valB : valB - valA;
        });
        return sorted;
    }, [questionStats, sortColumn, sortDir]);

    const handleSort = (col: string) => {
        if (sortColumn === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(col);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ col }: { col: string }) => (
        <i className={`fas fa-sort${sortColumn === col ? (sortDir === 'asc' ? '-up' : '-down') : ''} ml-1 text-[8px] ${sortColumn === col ? 'text-blue-600' : 'text-slate-300'}`}></i>
    );

    if (questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <i className="fas fa-clipboard-question text-5xl mb-4 opacity-50"></i>
                <p className="font-black text-sm uppercase tracking-widest">Chưa có dữ liệu câu hỏi</p>
                <p className="text-xs font-mono mt-1">Không tải được danh sách câu hỏi gốc của đề thi.</p>
            </div>
        );
    }

    if (latestResults.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <i className="fas fa-user-slash text-5xl mb-4 opacity-50"></i>
                <p className="font-black text-sm uppercase tracking-widest">Chưa có ai nộp bài</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <h2 className="text-xl font-black text-amber-700 uppercase tracking-widest">
                <i className="fas fa-search-minus mr-2"></i> Bảng thống kê tỷ lệ đúng/sai
            </h2>

            <p className="text-xs text-slate-500 font-medium bg-amber-50 border border-amber-200 p-3 rounded-sm">
                <i className="fas fa-info-circle text-amber-500 mr-1.5"></i>
                Bảng này phân tích chi tiết từng câu hỏi: tỷ lệ đúng/sai, và danh sách học sinh cụ thể. Bấm vào hàng để xem chi tiết.
            </p>

            {/* Question preview modal */}
            {previewQuestion && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewQuestion(null)}>
                    <div className="bg-white max-w-xl w-full rounded-sm shadow-2xl border border-slate-300 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 bg-slate-900 flex items-center justify-between">
                            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Nội dung câu hỏi</span>
                            <button onClick={() => setPreviewQuestion(null)} className="text-slate-400 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-6 text-sm text-slate-700 leading-relaxed max-h-96 overflow-y-auto">
                            {previewQuestion}
                        </div>
                    </div>
                </div>
            )}

            {/* TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-300">
                                <th className="p-3 text-[10px] font-black text-slate-600 uppercase tracking-wider w-12">STT</th>
                                <th className="p-3 text-[10px] font-black text-slate-600 uppercase tracking-wider text-left w-28">ID câu hỏi</th>
                                <th className="p-3 text-[10px] font-black text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 select-none" onClick={() => handleSort('total')}>
                                    Tổng số HS dự thi
                                </th>
                                <th className="p-3 text-[10px] font-black text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 select-none" onClick={() => handleSort('answered')}>
                                    Số HS đã làm <SortIcon col="answered" />
                                </th>
                                <th className="p-3 text-[10px] font-black text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 select-none" onClick={() => handleSort('notAnswered')}>
                                    Số HS chưa làm <SortIcon col="notAnswered" />
                                </th>
                                <th className="p-3 text-[10px] font-black text-green-700 uppercase tracking-wider cursor-pointer hover:bg-slate-200 select-none" onClick={() => handleSort('correct')}>
                                    Số HS làm đúng <SortIcon col="correct" />
                                </th>
                                <th className="p-3 text-[10px] font-black text-red-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 select-none" onClick={() => handleSort('wrong')}>
                                    Số HS làm sai <SortIcon col="wrong" />
                                </th>
                                <th className="p-3 text-[10px] font-black text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 select-none" onClick={() => handleSort('incomplete')}>
                                    Tỷ lệ chưa hoàn thành <SortIcon col="incomplete" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStats.map((qs) => {
                                const isExpanded = expandedRow === qs.qIndex;
                                const correctPct = qs.totalStudents > 0 ? (qs.correct / qs.totalStudents) * 100 : 0;

                                return (
                                    <React.Fragment key={qs.qIndex}>
                                        <tr
                                            className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => setExpandedRow(isExpanded ? null : qs.qIndex)}
                                        >
                                            <td className="p-3 font-mono font-bold text-slate-400">{qs.qIndex + 1}</td>
                                            <td className="p-3 text-left">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-blue-700 text-[11px]">
                                                        Câu {qs.qId.slice(-6)}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setPreviewQuestion(qs.questionContent); }}
                                                        className="text-slate-300 hover:text-blue-600 transition-colors text-[10px]"
                                                        title="Xem nội dung câu hỏi"
                                                    >
                                                        <i className="fas fa-eye"></i>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-3 font-bold text-slate-700">{qs.totalStudents}</td>
                                            <td className="p-3 font-bold text-slate-700">{qs.answered}</td>
                                            <td className="p-3 font-bold text-amber-600">{qs.notAnswered}</td>
                                            <td className="p-3 font-black text-green-700">{qs.correct}</td>
                                            <td className="p-3 font-black text-red-600">{qs.wrong}</td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                                        <div
                                                            className="bg-green-500 h-1.5 rounded-full transition-all"
                                                            style={{ width: `${correctPct}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="font-bold text-slate-600">{qs.incompletePct}</span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded detail row */}
                                        {isExpanded && (
                                            <tr className="border-b border-slate-200">
                                                <td colSpan={8} className="p-0">
                                                    <div className="grid grid-cols-3 gap-0 bg-slate-50 border-t border-slate-200">
                                                        {/* Correct students */}
                                                        <div className="p-4 border-r border-slate-200">
                                                            <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                                <i className="fas fa-check-circle"></i>
                                                                Học sinh làm đúng ({qs.correct})
                                                            </p>
                                                            {qs.correctStudents.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {qs.correctStudents.map((name, i) => (
                                                                        <span key={i} className="bg-green-100 text-green-800 px-2 py-0.5 rounded-sm text-[10px] font-bold border border-green-200">
                                                                            {name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-[10px] text-slate-400 italic">Không có</p>
                                                            )}
                                                        </div>

                                                        {/* Wrong students */}
                                                        <div className="p-4 border-r border-slate-200">
                                                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                                <i className="fas fa-times-circle"></i>
                                                                Học sinh làm sai ({qs.wrong})
                                                            </p>
                                                            {qs.wrongStudents.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {qs.wrongStudents.map((name, i) => (
                                                                        <span key={i} className="bg-red-100 text-red-800 px-2 py-0.5 rounded-sm text-[10px] font-bold border border-red-200">
                                                                            {name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-[10px] text-slate-400 italic">Không có</p>
                                                            )}
                                                        </div>

                                                        {/* Not answered students */}
                                                        <div className="p-4">
                                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                                <i className="fas fa-minus-circle"></i>
                                                                Học sinh chưa làm ({qs.notAnswered})
                                                            </p>
                                                            {qs.notAnsweredStudents.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {qs.notAnsweredStudents.map((name, i) => (
                                                                        <span key={i} className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm text-[10px] font-bold border border-amber-200">
                                                                            {name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-[10px] text-slate-400 italic">Không có</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
