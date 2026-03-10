import React from 'react';
import { Schedule } from '../../types';

interface MonthViewProps {
    currentDate: Date;
    events: Schedule[];
    onDateClick: (dateStr: string) => void;
    onEventClick: (event: Schedule) => void;
}

const DAYS_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function MonthView({ currentDate, events, onDateClick, onEventClick }: MonthViewProps) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday = 0, Sunday = 6
    let startDow = firstDayOfMonth.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const totalDays = lastDayOfMonth.getDate();
    const totalCells = Math.ceil((startDow + totalDays) / 7) * 7;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cells: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
        const dayOffset = i - startDow;
        const d = new Date(year, month, dayOffset + 1);
        cells.push({
            day: d.getDate(),
            dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            isCurrentMonth: d.getMonth() === month
        });
    }

    const getEventsForDate = (dateStr: string) => {
        return events.filter(e => {
            const eDate = (e.startDate || e.date || '').split('T')[0];
            return eDate === dateStr;
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                {DAYS_VI.map(d => (
                    <div key={d} className="py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
                {cells.map((cell, idx) => {
                    const dayEvents = getEventsForDate(cell.dateStr);
                    const isToday = cell.dateStr === todayStr;
                    const isWeekend = idx % 7 >= 5;

                    return (
                        <div
                            key={idx}
                            onClick={() => cell.isCurrentMonth && onDateClick(cell.dateStr)}
                            className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 cursor-pointer transition-colors group ${
                                !cell.isCurrentMonth ? 'bg-slate-50/50' : isWeekend ? 'bg-orange-50/30' : 'bg-white hover:bg-blue-50/30'
                            }`}
                        >
                            {/* Day number */}
                            <div className="flex justify-between items-start mb-1">
                                <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded-full transition-all ${
                                    isToday
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : !cell.isCurrentMonth
                                            ? 'text-slate-300'
                                            : 'text-slate-700 group-hover:bg-blue-100'
                                }`}>
                                    {cell.day}
                                </span>
                                {dayEvents.length > 0 && (
                                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                        {dayEvents.length}
                                    </span>
                                )}
                            </div>

                            {/* Event blocks */}
                            <div className="space-y-0.5">
                                {dayEvents.slice(0, 3).map(ev => (
                                    <div
                                        key={ev.id}
                                        onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:opacity-80 transition-opacity"
                                        style={{ backgroundColor: ev.color + '20', color: ev.color, borderLeft: `3px solid ${ev.color}` }}
                                        title={ev.title}
                                    >
                                        {!ev.isAllDay && ev.startDate?.includes('T') && (
                                            <span className="opacity-70 mr-0.5">{ev.startDate.split('T')[1]?.slice(0, 5)}</span>
                                        )}
                                        {ev.title}
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-[9px] font-bold text-blue-600 pl-1.5">+{dayEvents.length - 3} mục khác</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
