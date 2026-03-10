import React, { useState, useEffect } from 'react';
import { Schedule } from '../../types';

interface ScheduleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Schedule>) => void;
    onDelete?: (id: string) => void;
    editingEvent: Schedule | null;
    classes: any[];
    prefillDate?: string; // YYYY-MM-DD
}

const EVENT_COLORS = [
    { value: '#3b82f6', label: 'Xanh dương' },
    { value: '#eab308', label: 'Vàng' },
    { value: '#22c55e', label: 'Xanh lá' },
    { value: '#a855f7', label: 'Tím' },
    { value: '#ef4444', label: 'Đỏ' },
    { value: '#f97316', label: 'Cam' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#ec4899', label: 'Hồng' },
];

const REMINDER_OPTIONS = [
    { value: 0, label: 'Không nhắc' },
    { value: 15, label: 'Trước 15 phút' },
    { value: 30, label: 'Trước 30 phút' },
    { value: 60, label: 'Trước 1 giờ' },
    { value: 1440, label: 'Trước 1 ngày' },
];

export default function ScheduleFormModal({ isOpen, onClose, onSave, onDelete, editingEvent, classes, prefillDate }: ScheduleFormModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isAllDay, setIsAllDay] = useState(true);
    const [color, setColor] = useState('#3b82f6');
    const [reminderMinutes, setReminderMinutes] = useState(0);
    const [classId, setClassId] = useState('all');

    useEffect(() => {
        if (editingEvent) {
            setTitle(editingEvent.title || '');
            setDescription(editingEvent.description || '');
            
            // Format for inputs: date (YYYY-MM-DD) or datetime-local (YYYY-MM-DDTHH:mm)
            const startVal = editingEvent.startDate || editingEvent.date || '';
            const endVal = editingEvent.endDate || editingEvent.startDate || editingEvent.date || '';
            const allDay = editingEvent.isAllDay ?? true;
            
            setIsAllDay(allDay);
            setStartDate(allDay ? (startVal.includes('T') ? startVal.split('T')[0] : startVal) : (startVal.includes('T') ? startVal.slice(0, 16) : startVal + 'T00:00'));
            setEndDate(allDay ? (endVal.includes('T') ? endVal.split('T')[0] : endVal) : (endVal.includes('T') ? endVal.slice(0, 16) : endVal + 'T23:59'));
            
            setColor(editingEvent.color || '#3b82f6');
            setReminderMinutes(editingEvent.reminderMinutes ?? 0);
            setClassId(editingEvent.class_id || 'all');
        } else {
            setTitle('');
            setDescription('');
            const defaultDate = prefillDate || new Date().toISOString().split('T')[0];
            setStartDate(defaultDate);
            setEndDate(defaultDate);
            setIsAllDay(true);
            setColor('#3b82f6');
            setReminderMinutes(0);
            setClassId('all');
        }
    }, [editingEvent, prefillDate, isOpen]);

    const handleSubmit = () => {
        if (!title.trim()) return alert('Vui lòng nhập tiêu đề.');
        const finalClassId = classId || 'all';

        // Prepare ISO strings for Appwrite
        let finalStartDate = '';
        let finalEndDate = '';

        try {
            if (isAllDay) {
                // For all day: set to start of day and end of day in local time, then toISOString
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                const e = new Date(endDate || startDate);
                e.setHours(23, 59, 59, 999);
                finalStartDate = s.toISOString();
                finalEndDate = e.toISOString();
            } else {
                // For timed events: use the datetime-local value directly
                finalStartDate = new Date(startDate).toISOString();
                finalEndDate = new Date(endDate || startDate).toISOString();
            }
        } catch (err) {
            return alert('Định dạng thời gian không hợp lệ.');
        }

        onSave({
            id: editingEvent?.id,
            title: title.trim(),
            description: description.trim(),
            startDate: finalStartDate,
            endDate: finalEndDate,
            isAllDay,
            color,
            reminderMinutes,
            class_id: finalClassId,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-[Roboto]" onClick={onClose}>
            <div className="bg-white rounded-sm w-full max-w-lg shadow-2xl border border-slate-300 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header: COMMAND CENTER STYLE */}
                <div className="bg-blue-900 border-b-4 border-b-yellow-500 px-6 py-5 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-white text-base uppercase tracking-widest flex items-center gap-2">
                            <i className="fas fa-terminal text-yellow-500"></i>
                            {editingEvent ? 'CẬP NHẬT LỊCH CÔNG TÁC' : 'THIẾT LẬP LỊCH MỚI'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors" title="Đóng [ESC]">
                        <i className="fas fa-times text-lg"></i>
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar bg-slate-50">
                    {/* Title */}
                    <div>
                        <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-[0.2em] mb-2">Tiêu đề sự kiện *</label>
                        <input
                            type="text" value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="NHẬP TIÊU ĐỀ..."
                            className="w-full bg-white border border-slate-300 p-4 rounded-sm outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-sm font-bold text-blue-900 transition-all placeholder:text-slate-300"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-[0.2em] mb-2">Chi tiết nội dung</label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="MÔ TẢ CHI TIẾT CÔNG VIỆC..."
                            rows={3}
                            className="w-full bg-white border border-slate-300 p-4 rounded-sm outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-sm font-bold text-blue-900 resize-none transition-all placeholder:text-slate-300"
                        />
                    </div>

                    {/* Class selector */}
                    <div>
                        <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-[0.2em] mb-2">Đơn vị / Lớp áp dụng *</label>
                        <select
                            title="Chọn lớp học"
                            value={classId} onChange={e => setClassId(e.target.value)}
                            className="w-full bg-white border border-slate-300 p-4 rounded-sm outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-sm font-bold text-blue-900 cursor-pointer"
                        >
                            <option value="all">TẤT CẢ CÁC LỚP (MẶC ĐỊNH)</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                        </select>
                    </div>

                    {/* Date inputs */}
                    <div className="grid grid-cols-2 gap-6 p-4 bg-white border border-slate-200 rounded-sm">
                        <div className="col-span-2 flex items-center gap-3 mb-2">
                             <input type="checkbox" id="isAllDay" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="w-4 h-4 accent-blue-900" />
                             <label htmlFor="isAllDay" className="text-xs font-bold text-blue-900 uppercase tracking-widest cursor-pointer">Sự kiện cả ngày</label>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                                {isAllDay ? 'BẮT ĐẦU' : 'BẮT ĐẦU (GIỜ)'}
                            </label>
                            <input
                                type={isAllDay ? 'date' : 'datetime-local'}
                                value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-sm outline-none focus:border-blue-900 text-xs font-bold text-blue-900"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                                {isAllDay ? 'KẾT THÚC' : 'KẾT THÚC (GIỜ)'}
                            </label>
                            <input
                                type={isAllDay ? 'date' : 'datetime-local'}
                                value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-sm outline-none focus:border-blue-900 text-xs font-bold text-blue-900"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Reminder */}
                        <div>
                            <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-[0.2em] mb-2 italic">Nhắc hẹn quân y</label>
                            <select
                                title="Cài đặt nhắc hẹn"
                                value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))}
                                className="w-full bg-white border border-slate-300 p-3 rounded-sm outline-none focus:border-blue-900 text-xs font-bold text-blue-900"
                            >
                                {REMINDER_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label.toUpperCase()}</option>)}
                            </select>
                        </div>
                        {/* Color picker */}
                        <div>
                            <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-[0.2em] mb-2 italic">Mã màu chỉ thị</label>
                            <div className="flex gap-2 flex-wrap pt-1">
                                {EVENT_COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        title={c.label}
                                        onClick={() => setColor(c.value)}
                                        className={`w-6 h-6 rounded-sm transition-all border-2 ${color === c.value ? 'scale-110 border-blue-900 shadow-md ring-2 ring-blue-100' : 'border-slate-200 hover:scale-105'}`}
                                        style={{ backgroundColor: c.value }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-8 py-6 bg-white border-t border-slate-200">
                    <div>
                        {editingEvent && onDelete && (
                            <button
                                onClick={() => { if (window.confirm('XÁC NHẬN XÓA LỊCH CÔNG TÁC NÀY?')) onDelete(editingEvent.id); }}
                                className="px-5 py-3 bg-red-50 text-red-700 font-bold text-[10px] uppercase tracking-widest rounded-sm border border-red-200 hover:bg-red-700 hover:text-white transition-all flex items-center gap-2"
                            >
                                <i className="fas fa-trash-alt"></i> XÓA LỊCH
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-3 bg-white font-bold text-[10px] uppercase tracking-widest rounded-sm border border-slate-300 hover:bg-slate-100 transition-all text-slate-600">
                            HỦY BỎ
                        </button>
                        <button onClick={handleSubmit} className="px-8 py-3 bg-blue-900 text-white font-bold text-[10px] uppercase tracking-widest rounded-sm hover:bg-blue-800 shadow-sm transition-all flex items-center gap-2 border border-blue-900">
                            <i className="fas fa-save text-yellow-500"></i> {editingEvent ? 'LƯU THAY ĐỔI' : 'TẠO LỊCH MỚI'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
