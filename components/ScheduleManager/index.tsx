import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { databaseService } from '../../services/databaseService';
import { Schedule } from '../../types';
import MonthView from './MonthView';
import AgendaView from './AgendaView';
import ScheduleFormModal from './ScheduleFormModal';

type ViewMode = 'MONTH' | 'AGENDA';

const MONTH_NAMES = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

export default function ScheduleManager() {
    const { user } = useAuth();
    const [events, setEvents] = useState<Schedule[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('MONTH');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Schedule | null>(null);
    const [prefillDate, setPrefillDate] = useState<string>('');

    // Toast notification for reminders
    const [toast, setToast] = useState<{ text: string; visible: boolean }>({ text: '', visible: false });

    const isTeacherOrAdmin = user?.role === 'admin' || user?.role === 'teacher';

    // --- DATA FETCHING ---
    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const allClasses = await databaseService.fetchClasses();
            setClasses(allClasses);

            const classIdForFetch = user.role === 'student' ? (user.classId || (user as any).class_id) : undefined;
            const data = await databaseService.fetchSchedules(classIdForFetch);
            setEvents(data as Schedule[]);
        } catch (err) {
            console.error('Lỗi tải lịch:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { loadData(); }, [loadData]);

    // --- REMINDER SYSTEM ---
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            events.forEach(ev => {
                if (!ev.reminderMinutes || ev.reminderMinutes <= 0) return;
                const start = new Date(ev.startDate || ev.date);
                const diffMs = start.getTime() - now.getTime();
                const diffMin = Math.floor(diffMs / 60000);

                // Trigger if within 1 minute of the reminder time
                if (diffMin >= 0 && diffMin <= ev.reminderMinutes && diffMin >= ev.reminderMinutes - 1) {
                    showToast(`🔔 Nhắc hẹn: "${ev.title}" sẽ bắt đầu sau ${diffMin} phút`);
                    // Browser notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('Lịch Công Tác - AI SELF STUDY', { body: `"${ev.title}" sẽ bắt đầu sau ${diffMin} phút`, icon: '/logo.png' });
                    }
                }
            });
        }, 60000); // Check every 1 minute

        return () => clearInterval(interval);
    }, [events]);

    // Request notification permission on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const showToast = (text: string) => {
        setToast({ text, visible: true });
        setTimeout(() => setToast({ text: '', visible: false }), 5000);
    };

    // --- NAVIGATION ---
    const goToday = () => setCurrentDate(new Date());
    const goPrev = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() - 1);
        setCurrentDate(d);
    };
    const goNext = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() + 1);
        setCurrentDate(d);
    };

    // --- CRUD HANDLERS ---
    const handleDateClick = (dateStr: string) => {
        if (!isTeacherOrAdmin) return;
        setPrefillDate(dateStr);
        setEditingEvent(null);
        setIsModalOpen(true);
    };

    const handleEventClick = (event: Schedule) => {
        if (isTeacherOrAdmin) {
            setEditingEvent(event);
            setPrefillDate('');
            setIsModalOpen(true);
        }
    };

    const handleSave = async (data: Partial<Schedule>) => {
        if (!user) return;
        try {
            if (data.id) {
                // Update existing
                await databaseService.updateSchedule(data.id, data);
                setEvents(prev => prev.map(e => e.id === data.id ? { ...e, ...data } as Schedule : e));
            } else {
                // Create new
                const saved = await databaseService.saveSchedule({ ...data, creator_id: user.id });
                setEvents(prev => [saved as Schedule, ...prev]);
            }
            setIsModalOpen(false);
            setEditingEvent(null);
        } catch (err) {
            alert('Lỗi khi lưu sự kiện!');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await databaseService.deleteSchedule(id);
            setEvents(prev => prev.filter(e => e.id !== id));
            setIsModalOpen(false);
            setEditingEvent(null);
        } catch (err) {
            alert('Lỗi khi xóa sự kiện!');
        }
    };

    // --- RENDER ---
    return (
        <div className="p-6 h-full flex flex-col relative bg-slate-50 font-[Roboto]">
            {/* Toast notification */}
            {toast.visible && (
                <div className="fixed top-6 right-6 z-[9999] bg-blue-900 text-white px-6 py-4 border border-blue-900 shadow-2xl flex items-center gap-3 max-w-md">
                    <i className="fas fa-bell text-yellow-500"></i>
                    <span className="text-sm font-bold uppercase tracking-tight">{toast.text}</span>
                    <button onClick={() => setToast({ text: '', visible: false })} className="text-white/60 hover:text-white ml-2" title="Đóng">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            )}

            {/* Calendar Header */}
            <header className="bg-white border border-slate-300 p-6 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    {/* Left: Navigation */}
                    <div className="flex items-center gap-4">
                        <button onClick={goToday} className="px-6 py-3 bg-blue-900 text-white font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-blue-800 transition-all border border-blue-900">
                            Hôm nay
                        </button>
                        <div className="flex items-center border border-slate-300">
                            <button onClick={goPrev} className="w-12 h-12 flex items-center justify-center text-slate-600 hover:text-blue-900 hover:bg-slate-100 transition-colors border-r border-slate-300" title="Tháng trước">
                                <i className="fas fa-chevron-left text-xs"></i>
                            </button>
                            <button onClick={goNext} className="w-12 h-12 flex items-center justify-center text-slate-600 hover:text-blue-900 hover:bg-slate-100 transition-colors" title="Tháng sau">
                                <i className="fas fa-chevron-right text-xs"></i>
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-blue-900 uppercase tracking-widest ml-4">
                            {MONTH_NAMES[currentDate.getMonth()]}, {currentDate.getFullYear()}
                        </h2>
                    </div>

                    {/* Right: View mode + Create */}
                    <div className="flex items-center gap-4">
                        {/* View mode tabs */}
                        <div className="flex bg-slate-100 border border-slate-300 p-1">
                            {([
                                { key: 'MONTH' as ViewMode, icon: 'fa-calendar-days', label: 'Tháng' },
                                { key: 'AGENDA' as ViewMode, icon: 'fa-list-ul', label: 'Danh sách' },
                            ]).map(v => (
                                <button
                                    key={v.key}
                                    onClick={() => setViewMode(v.key)}
                                    className={`px-5 py-2.5 font-bold text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                                        viewMode === v.key ? 'bg-blue-900 text-white' : 'text-slate-500 hover:bg-white'
                                    }`}
                                >
                                    <i className={`fas ${v.icon}`}></i> {v.label}
                                </button>
                            ))}
                        </div>

                        {/* Event count badge */}
                        <div className="hidden sm:flex items-center gap-2 bg-slate-50 text-blue-900 px-4 py-3 border border-blue-900/20">
                            <i className="fas fa-calendar-check text-xs"></i>
                            <span className="text-[10px] font-bold uppercase tracking-widest">{events.length} Sự kiện</span>
                        </div>

                        {/* Create button */}
                        {isTeacherOrAdmin && (
                            <button
                                onClick={() => { setEditingEvent(null); setPrefillDate(''); setIsModalOpen(true); }}
                                className="bg-yellow-500 text-blue-900 px-6 py-3 font-bold text-xs uppercase tracking-widest hover:bg-yellow-400 border border-yellow-600 transition-all flex items-center gap-2"
                            >
                                <i className="fas fa-plus"></i> Tạo Lịch
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Calendar Body */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center bg-white border border-slate-300 mt-2">
                    <div className="text-center">
                        <div className="w-16 h-16 border border-blue-900 text-blue-900 flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-spinner fa-spin text-2xl"></i>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Đang tải dữ liệu lịch...</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white border border-slate-300">
                    {viewMode === 'MONTH' && (
                        <MonthView
                            currentDate={currentDate}
                            events={events}
                            onDateClick={handleDateClick}
                            onEventClick={handleEventClick}
                        />
                    )}
                    {viewMode === 'AGENDA' && (
                        <AgendaView
                            currentDate={currentDate}
                            events={events}
                            onEventClick={handleEventClick}
                        />
                    )}
                </div>
            )}

            {/* Schedule Form Modal */}
            <ScheduleFormModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
                onSave={handleSave}
                onDelete={handleDelete}
                editingEvent={editingEvent}
                classes={classes}
                prefillDate={prefillDate}
            />
        </div>
    );
}
