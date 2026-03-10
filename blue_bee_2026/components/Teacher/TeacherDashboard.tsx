
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import CommandCenterReadOnly from '../Common/CommandCenterReadOnly';
import MarqueeBanner from '../Common/MarqueeBanner';
import { Link } from 'react-router-dom';

const TeacherDashboard: React.FC = () => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="p-6 md:p-8 space-y-6 animate-slide-up max-w-[1400px] mx-auto pb-24 font-[Roboto]">
            {/* Running Marquee Banner */}
            <MarqueeBanner allowEdit={false} />

            {/* 1. Header — Command Center Style */}
            <div className="bg-blue-900 rounded-sm p-8 md:p-10 relative overflow-hidden text-white border-b-4 border-yellow-500">
                <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:40px_40px]"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-blue-800 px-3 py-1 rounded-sm border border-blue-700">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                <span className="text-[9px] font-mono font-bold text-green-400 uppercase tracking-[0.2em]">TEACHING CENTER</span>
                            </div>
                            <span className="text-[10px] font-mono text-blue-300">
                                {currentTime.toLocaleDateString("vi-VN", {
                                    weekday: "long", day: "numeric", month: "long", year: "numeric"
                                })}
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">
                            Cán bộ quản lý: {user?.fullName}
                        </h1>
                        <p className="text-blue-200 text-sm max-w-lg leading-relaxed font-medium">
                            Bảng điều khiển Giảng dạy — Quản lý học viên, bài giảng và nhiệm vụ học tập.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Command Center Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <CommandCenterReadOnly user={user} type="schedule" />
                <CommandCenterReadOnly user={user} type="task" />
            </div>

            {/* 3. Quick Actions */}
            <div className="bg-white rounded-sm border border-slate-300 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
                    <div className="w-9 h-9 rounded-sm bg-blue-900 flex items-center justify-center text-yellow-400">
                        <i className="fas fa-bolt text-sm"></i>
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">Thao tác nhanh</h3>
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Quick Command Panel</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Link to="/teacher/students" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-sm bg-blue-100 text-blue-900 flex items-center justify-center mb-3">
                            <i className="fas fa-users-gear"></i>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Quản lý học viên</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Danh sách & Điểm số</p>
                    </Link>
                    <Link to="/lectures" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-sm bg-purple-100 text-purple-900 flex items-center justify-center mb-3">
                            <i className="fas fa-chalkboard-teacher"></i>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Học liệu điện tử</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Video & PDF bài giảng</p>
                    </Link>
                    <Link to="/generate" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-sm bg-teal-100 text-teal-900 flex items-center justify-center mb-3">
                            <i className="fas fa-robot"></i>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">AI Soạn đề</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Trợ lý AI trực chiến</p>
                    </Link>
                    <Link to="/bank" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-sm bg-slate-200 text-slate-700 flex items-center justify-center mb-3">
                            <i className="fas fa-server"></i>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Ngân hàng đề</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Kho dữ liệu tập trung</p>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboard;
