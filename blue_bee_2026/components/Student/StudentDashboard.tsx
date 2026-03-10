
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import CommandCenterReadOnly from '../Common/CommandCenterReadOnly';
import MarqueeBanner from '../Common/MarqueeBanner';
import { Link } from 'react-router-dom';

const StudentDashboard: React.FC = () => {
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

            {/* 1. Header — Bảng điều khiển Học tập Style */}
            <div className="bg-blue-900 rounded-sm p-8 md:p-10 relative overflow-hidden text-white border-b-4 border-yellow-500">
                <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:40px_40px]"></div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-sm flex items-center justify-center shadow-lg transform rotate-3 border-2 border-white/20">
                            <i className="fas fa-user-graduate text-blue-900 text-3xl"></i>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter leading-tight drop-shadow-md">
                                BẢNG ĐIỀU KHIỂN <span className="text-yellow-400 underline decoration-yellow-500 underline-offset-4">HỌC TẬP</span>
                            </h1>
                            <p className="text-[10px] font-mono text-blue-200 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span> 
                                STUDENT HUB — CHINH PHỤC TRI THỨC
                            </p>
                        </div>
                    </div>
    <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">
                            Học viên: {user?.fullName}
                        </h1>
                        <p className="text-blue-200 text-sm max-w-lg leading-relaxed font-medium">
                            Trung tâm Tự học — Theo dõi lịch công tác, hoàn thành nhiệm vụ và nâng cao tri thức.
                        </p>
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
                        <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">Truy cập nhanh</h3>
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Theo dõi lịch trình, hoàn thành nhiệm vụ học tập</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Link to="/lectures" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-sm bg-blue-100 text-blue-900 flex items-center justify-center mb-3">
                            <i className="fas fa-film"></i>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Học liệu điện tử</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Theo dõi bài giảng</p>
                    </Link>
                    <Link to="/documents" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-sm bg-teal-100 text-teal-900 flex items-center justify-center mb-3">
                            <i className="fas fa-book-open"></i>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Tài liệu & RAG</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Tra cứu tri thức AI</p>
                    </Link>
                    <Link to="/self-study" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-sm bg-orange-100 text-orange-900 flex items-center justify-center mb-3">
                            <i className="fas fa-book-reader"></i>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Ôn tập tự học</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Rèn luyện kỹ năng</p>
                    </Link>
                    <Link to="/online-test" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-sm bg-red-100 text-red-900 flex items-center justify-center mb-3">
                            <i className="fas fa-laptop-code"></i>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Kiểm tra</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Đánh giá năng lực</p>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
