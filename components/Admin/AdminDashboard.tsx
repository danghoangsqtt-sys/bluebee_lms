
import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import TeacherManager from './TeacherManager';
import ClassManager from './ClassManager';
import StudentApproval from './StudentApproval';
import OverviewTab from './OverviewTab';
import MarqueeBanner from '../Common/MarqueeBanner';
import './AdminDashboard.css';

interface AdminDashboardProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNotify }) => {
  const location = useLocation();

  const NavItem = ({ to, label, icon }: { to: string, label: string, icon: string }) => {
    const active = to === "/admin"
      ? location.pathname === "/admin" || location.pathname === "/admin/"
      : location.pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-6 py-3.5 rounded-sm font-black text-[10px] uppercase tracking-widest transition-all relative overflow-hidden group border ${
          active 
            ? 'bg-blue-900 text-white border-blue-800' 
            : 'bg-white text-slate-500 border-slate-300 hover:border-blue-900 hover:text-blue-900'
        }`}
      >
        <i className={`fas ${icon} text-sm ${active ? 'text-yellow-400' : 'text-slate-400 group-hover:text-blue-900'}`}></i>
        {label}
        {active && <div className="absolute right-0 top-0 w-1.5 h-full bg-yellow-500"></div>}
      </Link>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-4 animate-fade-in pb-24 font-[Roboto]">
      
      {/* Running Marquee Banner */}
      <MarqueeBanner allowEdit={true} onNotify={onNotify} />

      {/* Bảng điều khiển Quản trị */}
      <header className="bg-blue-900 p-8 rounded-sm border-b-4 border-yellow-500 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:20px_20px]"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-sm flex items-center justify-center shadow-lg transform -rotate-3 border-2 border-white/20">
              <i className="fas fa-shield-alt text-blue-900 text-2xl animate-pulse"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight drop-shadow-md">
                HỆ THỐNG QUẢN TRỊ <span className="text-yellow-400 underline decoration-yellow-500 underline-offset-4">TOÀN DIỆN</span>
              </h1>
              <p className="text-[10px] font-mono text-blue-200 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span> 
                ADMINISTRATION PANEL — XÁC THỰC & BẢO MẬT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-blue-800/50 backdrop-blur-md px-5 py-3 rounded-sm border border-blue-700/50 flex items-center gap-4 shadow-inner">
              <div className="text-right">
                <p className="text-[9px] font-mono text-blue-300 uppercase leading-none mb-1">Cấp độ truy cập</p>
                <p className="text-xs font-black text-yellow-400 uppercase tracking-wider">QUẢN TRỊ VIÊN</p>
              </div>
              <div className="h-8 w-px bg-blue-700/50"></div>
              <div className="text-right">
                <p className="text-[9px] font-mono text-blue-300 uppercase leading-none mb-1">Phiên làm việc</p>
                <p className="text-xs font-black text-white uppercase tracking-wider">ACTIVE</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <div className="flex flex-wrap gap-2">
          <NavItem to="/admin" label="Tổng quan Hệ thống" icon="fa-tower-observation" />
          <NavItem to="/admin/teachers" label="Quản lý Cán bộ quản lý" icon="fa-chalkboard-user" />
          <NavItem to="/admin/classes" label="Quản lý Lớp học" icon="fa-school" />
          <NavItem to="/admin/students" label="Phê duyệt Học viên" icon="fa-user-check" />
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-sm border border-slate-300 min-h-[600px] relative">
        <Routes>
          <Route path="/" element={<OverviewTab />} />
          <Route path="teachers" element={<TeacherManager onNotify={onNotify} />} />
          <Route path="classes" element={<ClassManager onNotify={onNotify} />} />
          <Route path="students" element={<StudentApproval />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;
