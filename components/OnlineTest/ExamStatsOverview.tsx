import React, { useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';

interface ExamStatsOverviewProps {
    results: any[];
    examTitle: string;
}

// Helper: parse answers_data JSON safely
const parseAnswersData = (r: any): any => {
    if (!r.answers_data) return {};
    try { return JSON.parse(r.answers_data); } catch { return {}; }
};

// Helper: get latest result per student (last attempt = final score)
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

export default function ExamStatsOverview({ results, examTitle }: ExamStatsOverviewProps) {
    const exportRef = useRef<HTMLDivElement>(null);

    // Only submitted / scored results
    const validResults = useMemo(() =>
        results.filter(r => r.status === 'submitted' || r.score > 0 || r.answers_data),
    [results]);

    // Latest attempt per student
    const latestResults = useMemo(() => getLatestPerStudent(validResults), [validResults]);

    // ===================== COMPUTED STATS =====================
    const stats = useMemo(() => {
        const scores = latestResults.map(r => r.score ?? 0);
        const total = scores.length;
        if (total === 0) return null;

        const avg = scores.reduce((a, b) => a + b, 0) / total;
        const belowOne = scores.filter(s => s < 1).length;
        const aboveFive = scores.filter(s => s >= 5).length;

        // Distribution buckets: <1, <2, <3, <4, <5, <6, <7, <8, <9, <=10
        const buckets = Array(10).fill(0);
        scores.forEach(s => {
            const idx = s >= 10 ? 9 : Math.floor(s);
            buckets[idx]++;
        });

        // Mode (most common score bucket)
        let modeIdx = 0;
        buckets.forEach((count, idx) => { if (count > buckets[modeIdx]) modeIdx = idx; });
        const modeLabel = modeIdx === 9 ? '10' : `${modeIdx + 1}`;

        return {
            totalRegistered: total,
            totalAttempts: validResults.length,
            avg: avg.toFixed(2),
            belowOne,
            belowOnePct: ((belowOne / total) * 100).toFixed(1),
            aboveFive,
            aboveFivePct: ((aboveFive / total) * 100).toFixed(1),
            modeScore: modeLabel,
            modePct: ((buckets[modeIdx] / total) * 100).toFixed(1),
            buckets,
            maxBucket: Math.max(...buckets, 1),
        };
    }, [latestResults, validResults]);

    // ===================== FREQUENCY TABLE =====================
    const freqTable = useMemo(() => {
        if (!stats) return null;
        const { buckets } = stats;
        const total = latestResults.length;
        const aboveAvg = latestResults.filter(r => (r.score ?? 0) >= 5).length;
        return {
            registered: total,
            tested: total,
            buckets: buckets.map((count: number) => ({
                count,
                pct: total > 0 ? ((count / total) * 100).toFixed(2) : '0.00'
            })),
            aboveAvg,
            aboveAvgPct: total > 0 ? ((aboveAvg / total) * 100).toFixed(2) : '0.00'
        };
    }, [stats, latestResults]);

    // ===================== EXPORT EXCEL =====================
    const handleExportExcel = () => {
        if (!stats || !freqTable) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: Phổ điểm
        const distHeaders = ['Mốc điểm', '< 1', '< 2', '< 3', '< 4', '< 5', '< 6', '< 7', '< 8', '< 9', '≤ 10'];
        const distRow = ['Số lượng', ...stats.buckets.map((b: number) => b)];
        const distPctRow = ['Tỷ lệ %', ...stats.buckets.map((b: number) => latestResults.length > 0 ? ((b / latestResults.length) * 100).toFixed(2) + '%' : '0%')];
        const distSheet = XLSX.utils.aoa_to_sheet([distHeaders, distRow, distPctRow]);
        XLSX.utils.book_append_sheet(wb, distSheet, 'Phổ điểm');

        // Sheet 2: Bảng điểm
        const scoreHeaders = ['STT', 'Họ tên', 'Điểm', 'Thời gian (phút)', 'Trạng thái'];
        const scoreRows = latestResults
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map((r, i) => {
                const ad = parseAnswersData(r);
                const mins = ad.time_spent ? Math.round(ad.time_spent / 60) : 0;
                return [i + 1, r.student_name || ad.student_name || 'Học viên', (r.score ?? 0).toFixed(2), mins, r.status || ''];
            });
        const scoreSheet = XLSX.utils.aoa_to_sheet([scoreHeaders, ...scoreRows]);
        XLSX.utils.book_append_sheet(wb, scoreSheet, 'Bảng điểm');

        // Sheet 3: Tổng quan
        const overviewSheet = XLSX.utils.aoa_to_sheet([
            ['Chỉ số', 'Giá trị'],
            ['Tên bài thi', examTitle],
            ['Tổng thí sinh', latestResults.length],
            ['Tổng lượt làm', validResults.length],
            ['Điểm trung bình', stats.avg],
            ['Số HS đạt < 1 điểm', `${stats.belowOne} (${stats.belowOnePct}%)`],
            ['Số HS đạt >= 5 điểm', `${stats.aboveFive} (${stats.aboveFivePct}%)`],
            ['Mốc điểm phổ biến nhất', `${stats.modeScore} (${stats.modePct}%)`],
        ]);
        XLSX.utils.book_append_sheet(wb, overviewSheet, 'Tổng quan');

        XLSX.writeFile(wb, `ThongKe_${examTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_').substring(0, 30)}.xlsx`);
    };

    // ===================== LABELS =====================
    const bucketLabels = ['< 1', '< 2', '< 3', '< 4', '< 5', '< 6', '< 7', '< 8', '< 9', '≤ 10'];
    const barColors = [
        'bg-red-500', 'bg-red-400', 'bg-orange-400', 'bg-orange-300',
        'bg-yellow-400', 'bg-yellow-300', 'bg-blue-400', 'bg-blue-500',
        'bg-blue-600', 'bg-blue-700'
    ];

    if (!stats) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <i className="fas fa-chart-bar text-5xl mb-4 opacity-50"></i>
                <p className="font-black text-sm uppercase tracking-widest">Chưa có dữ liệu thống kê</p>
                <p className="text-xs font-mono mt-1">Chưa có học viên nào hoàn thành bài thi này.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8" ref={exportRef}>
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-amber-700 uppercase tracking-widest">
                    <i className="fas fa-chart-line mr-2"></i> Thống kê tổng quan
                </h2>
                <button
                    onClick={handleExportExcel}
                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-sm text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
                >
                    <i className="fas fa-file-excel"></i> Xuất Excel
                </button>
            </div>

            {/* ════════════════ CHỈ SỐ CƠ BẢN ════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Exam info */}
                <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm">
                    <h3 className="font-black text-slate-800 text-lg uppercase tracking-widest mb-4 border-b border-slate-100 pb-3">{examTitle}</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                            <i className="fas fa-users text-blue-500 w-5"></i>
                            <span className="text-slate-600 font-medium">Số người dự thi</span>
                            <span className="ml-auto font-black text-slate-800 text-lg">{stats.totalRegistered}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <i className="fas fa-redo text-purple-500 w-5"></i>
                            <span className="text-slate-600 font-medium">Tổng lượt làm</span>
                            <span className="ml-auto font-black text-slate-800 text-lg">{stats.totalAttempts}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Key metrics */}
                <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm">
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-bold uppercase text-[11px] tracking-wider">Điểm trung bình</span>
                            <span className="text-3xl font-black text-blue-900">{stats.avg}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <span className="text-slate-600 font-medium">Số thí sinh đạt điểm {'<'} 1</span>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-red-600">{stats.belowOne}</span>
                                <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-sm">{stats.belowOnePct}%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <span className="text-slate-600 font-medium">Số thí sinh đạt điểm {'≥'} 5</span>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-green-600">{stats.aboveFive}</span>
                                <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-sm">{stats.aboveFivePct}%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <span className="text-slate-600 font-medium">Mốc điểm HS đạt nhiều nhất</span>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-blue-900">{stats.modeScore}</span>
                                <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-sm">{stats.modePct}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════════════ BIỂU ĐỒ PHỔ ĐIỂM ════════════════ */}
            <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">
                        <i className="fas fa-chart-bar text-blue-900 mr-2"></i> Biểu đồ phổ điểm
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                        Thống kê điểm thi — {examTitle} &nbsp;·&nbsp; <span className="text-blue-600">● Số lượng</span>
                    </p>
                </div>
                <div className="p-6 pt-8">
                    {/* Y-axis labels + bars */}
                    <div className="flex items-end gap-0 h-64 px-2 relative">
                        {/* Y-axis gridlines */}
                        {[0.25, 0.5, 0.75, 1].map(ratio => (
                            <div
                                key={ratio}
                                className="absolute left-0 right-0 border-t border-dashed border-slate-100"
                                style={{ bottom: `${ratio * 100}%` }}
                            >
                                <span className="absolute -left-1 -top-2.5 text-[9px] text-slate-300 font-mono">
                                    {Math.round(stats.maxBucket * ratio)}
                                </span>
                            </div>
                        ))}

                        {stats.buckets.map((count: number, idx: number) => {
                            const height = stats.maxBucket > 0 ? (count / stats.maxBucket) * 100 : 0;
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative px-0.5">
                                    {/* Count label */}
                                    <span className="text-xs font-black text-slate-600 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {count}
                                    </span>
                                    {count > 0 && (
                                        <span className="text-xs font-black text-slate-700 mb-1">{count}</span>
                                    )}
                                    {/* Bar */}
                                    <div
                                        className={`w-full max-w-[52px] ${barColors[idx]} rounded-t-sm transition-all duration-500 hover:opacity-80 cursor-default relative`}
                                        style={{ height: `${Math.max(height, count > 0 ? 3 : 0)}%` }}
                                        title={`${bucketLabels[idx]}: ${count} thí sinh`}
                                    ></div>
                                    {/* X label */}
                                    <span className="text-[10px] font-bold text-slate-500 mt-2 pt-2 border-t border-slate-200 w-full text-center whitespace-nowrap">
                                        {bucketLabels[idx]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ════════════════ BẢNG TẦN SỐ ════════════════ */}
            {freqTable && (
                <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">
                            <i className="fas fa-table text-blue-900 mr-2"></i> Bảng tần số
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100 border-b-2 border-slate-300">
                                    <th className="p-2.5 text-[10px] font-black text-slate-600 uppercase tracking-wider border-r border-slate-200 text-left sticky left-0 bg-slate-100 z-10" rowSpan={2}>Lớp</th>
                                    <th className="p-2.5 text-[10px] font-black text-slate-600 uppercase tracking-wider border-r border-slate-200" colSpan={2}>Số học sinh</th>
                                    {bucketLabels.map((label, i) => (
                                        <th key={i} className="p-2.5 text-[10px] font-black text-slate-600 uppercase tracking-wider border-r border-slate-200" colSpan={2}>
                                            {label}
                                        </th>
                                    ))}
                                    <th className="p-2.5 text-[10px] font-black text-green-700 uppercase tracking-wider" colSpan={2}>
                                        Trên TB (≥ 5)
                                    </th>
                                </tr>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-2 text-[9px] font-bold text-slate-400 border-r border-slate-200">ĐK</th>
                                    <th className="p-2 text-[9px] font-bold text-slate-400 border-r border-slate-200">Dự thi</th>
                                    {bucketLabels.map((_, i) => (
                                        <React.Fragment key={i}>
                                            <th className="p-2 text-[9px] font-bold text-slate-400 border-r border-slate-100">SL</th>
                                            <th className="p-2 text-[9px] font-bold text-slate-400 border-r border-slate-200">%</th>
                                        </React.Fragment>
                                    ))}
                                    <th className="p-2 text-[9px] font-bold text-slate-400 border-r border-slate-100">SL</th>
                                    <th className="p-2 text-[9px] font-bold text-slate-400">%</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-2.5 font-bold text-slate-700 text-left border-r border-slate-200 sticky left-0 bg-white z-10 whitespace-nowrap">Thí sinh tự do</td>
                                    <td className="p-2.5 font-bold text-slate-700 border-r border-slate-200">{freqTable.registered}</td>
                                    <td className="p-2.5 font-bold text-slate-700 border-r border-slate-200">{freqTable.tested}</td>
                                    {freqTable.buckets.map((b: {count: number; pct: string}, i: number) => (
                                        <React.Fragment key={i}>
                                            <td className={`p-2.5 font-bold border-r border-slate-100 ${b.count > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{b.count}</td>
                                            <td className={`p-2.5 border-r border-slate-200 ${b.count > 0 ? 'text-slate-600' : 'text-slate-300'}`}>{b.pct}</td>
                                        </React.Fragment>
                                    ))}
                                    <td className="p-2.5 font-black text-green-700 border-r border-slate-100">{freqTable.aboveAvg}</td>
                                    <td className="p-2.5 font-bold text-green-600">{freqTable.aboveAvgPct}</td>
                                </tr>
                                {/* TỔNG row */}
                                <tr className="bg-blue-50/50 border-t-2 border-blue-200 font-black">
                                    <td className="p-2.5 text-blue-900 text-left border-r border-slate-200 sticky left-0 bg-blue-50/50 z-10">TỔNG</td>
                                    <td className="p-2.5 text-blue-900 border-r border-slate-200">{freqTable.registered}</td>
                                    <td className="p-2.5 text-blue-900 border-r border-slate-200">{freqTable.tested}</td>
                                    {freqTable.buckets.map((b: {count: number; pct: string}, i: number) => (
                                        <React.Fragment key={i}>
                                            <td className={`p-2.5 border-r border-slate-100 ${b.count > 0 ? 'text-blue-900' : 'text-slate-300'}`}>{b.count}</td>
                                            <td className={`p-2.5 border-r border-slate-200 ${b.count > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{b.pct}</td>
                                        </React.Fragment>
                                    ))}
                                    <td className="p-2.5 text-green-700 border-r border-slate-100">{freqTable.aboveAvg}</td>
                                    <td className="p-2.5 text-green-600">{freqTable.aboveAvgPct}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
