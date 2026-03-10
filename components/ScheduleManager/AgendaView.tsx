import React from 'react';
import { Schedule } from '../../types';

interface AgendaViewProps {
    currentDate: Date;
    events: Schedule[];
    onEventClick: (event: Schedule) => void;
}

export default function AgendaView({ currentDate, events, onEventClick }: AgendaViewProps) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Filter events for current month and sort ascending
    const monthEvents = events
        .filter(e => {
            const d = new Date(e.startDate || e.date);
            return d.getFullYear() === year && d.getMonth() === month;
        })
        .sort((a, b) => new Date(a.startDate || a.date).getTime() - new Date(b.startDate || b.date).getTime());

    // Group by date
    const grouped: Record<string, Schedule[]> = {};
    monthEvents.forEach(e => {
        const key = (e.startDate || e.date || '').split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        return {
            dayName: dayNames[d.getDay()],
            dayNum: d.getDate(),
            monthYear: `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
        };
    };

    if (Object.keys(grouped).length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
                <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                    <i className="fas fa-calendar-check"></i>
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-1">Không có sự kiện trong tháng này</h3>
                <p className="text-sm text-slate-400">Hãy tạo lịch mới để bắt đầu quản lý công việc.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([dateStr, dayEvents]) => {
                const { dayName, dayNum } = formatDate(dateStr);
                const isToday = dateStr === todayStr;
                const isPast = new Date(dateStr) < new Date(todayStr);

                return (
                    <div key={dateStr} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isToday ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                        {/* Date header */}
                        <div className={`flex items-center gap-4 px-5 py-3 border-b ${isToday ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${isToday ? 'bg-blue-600 text-white shadow-md' : isPast ? 'bg-slate-200 text-slate-400' : 'bg-white text-slate-700 border border-slate-200'}`}>
                                <span className="text-lg font-black leading-none">{dayNum}</span>
                                <span className="text-[8px] font-bold uppercase">{dayName.slice(0, 3)}</span>
                            </div>
                            <div className="flex-1">
                                <span className={`text-sm font-black ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {dayName}
                                </span>
                                {isToday && <span className="ml-2 text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">Hôm nay</span>}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{dayEvents.length} sự kiện</span>
                        </div>

                        {/* Events */}
                        <div className="divide-y divide-slate-100">
                            {dayEvents.map(ev => (
                                <div
                                    key={ev.id}
                                    onClick={() => onEventClick(ev)}
                                    className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors group"
                                >
                                    {/* Color bar */}
                                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: ev.color }}></div>

                                    {/* Time */}
                                    <div className="w-16 shrink-0 text-center">
                                        {ev.isAllDay ? (
                                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Cả ngày</span>
                                        ) : (
                                            <div className="text-xs font-bold text-slate-600">
                                                {ev.startDate?.includes('T') ? ev.startDate.split('T')[1]?.slice(0, 5) : '--:--'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-slate-800 truncate group-hover:text-blue-600 transition-colors">{ev.title}</h4>
                                        {ev.description && <p className="text-xs text-slate-400 truncate mt-0.5">{ev.description}</p>}
                                    </div>

                                    {/* Reminder badge */}
                                    {ev.reminderMinutes > 0 && (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 shrink-0">
                                            <i className="fas fa-bell mr-0.5"></i> {ev.reminderMinutes}p
                                        </span>
                                    )}
                                    <i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-400 text-xs shrink-0 transition-colors"></i>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
