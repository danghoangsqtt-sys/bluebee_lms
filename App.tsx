import React, { useState, useEffect, useCallback } from "react";
import 'katex/dist/katex.min.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Chatbot from "./components/Chatbot";
import QuestionGenerator from "./components/QuestionGenerator/index";
import Documents from "./components/Documents";
import Settings from "./components/Settings";
import ProfileSettings from "./components/ProfileSettings";
import MarqueeBanner from "./components/Common/MarqueeBanner";
import QuestionBankManager from "./components/QuestionBankManager";
import ChangelogModal from "./components/ChangelogModal";
import Login from "./components/Login";
import AdminDashboard from "./components/Admin/AdminDashboard";
import TeacherDashboard from "./components/Teacher/TeacherDashboard";
import StudentDashboard from "./components/Student/StudentDashboard";
import TeacherStudents from "./components/Teacher/TeacherStudents";
import LectureManager from "./components/Teacher/LectureManager";
import OnlineTestManager from "./components/OnlineTest";
import SelfStudyManager from "./components/SelfStudy";
import ScheduleManager from "./components/ScheduleManager";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Question, KnowledgeDocument, QuestionFolder, Exam } from "./types";
import { databaseService } from "./services/databaseService";
import pkg from "./package.json";

// --- Sidebar Link Component (Modern Rounded) ---
const SidebarLink = ({
  to,
  icon,
  label,
  onClick,
  collapsed = false,
}: {
  to: string;
  icon: string;
  label: string;
  onClick?: () => void;
  collapsed?: boolean;
}) => {
  const location = useLocation();
  const active =
    location.pathname === to ||
    (to !== "/" && location.pathname.startsWith(to));
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : ""}
      className={`group flex items-center transition-all duration-200 mb-1 mx-3 text-sm rounded-sm ${
        collapsed ? "justify-center px-0 py-3 w-10 mx-auto" : "gap-3.5 px-4 py-3"
      } ${
        active
          ? "bg-blue-50 text-blue-900 font-bold border-l-4 border-l-yellow-500"
          : "text-slate-500 hover:bg-slate-100 hover:text-blue-900 font-medium"
      }`}
    >
      <i
        className={`fas ${icon} w-5 text-center text-base ${active ? "text-blue-900" : "text-slate-400 group-hover:text-blue-700"} transition-colors`}
      ></i>
      {!collapsed && <span className="font-[Roboto] truncate">{label}</span>}
      {!collapsed && active && (
        <div className="ml-auto w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
      )}
    </Link>
  );
};

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="h-full w-full flex items-center justify-center font-[Roboto] text-sm text-blue-600 font-bold uppercase tracking-widest">
        <i className="fas fa-circle-notch fa-spin mr-3"></i> Loading System...
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to="/" replace />;
  return <>{children}</>;
};

// --- Stat Card (Military Command Center) ---
const StatCard = ({ icon, label, value, unit, color }: any) => {
  const colorMap: any = {
    blue: { icon: "text-blue-900 bg-blue-100", border: "border-l-blue-600" },
    purple: { icon: "text-purple-900 bg-purple-100", border: "border-l-purple-600" },
    orange: { icon: "text-amber-800 bg-amber-100", border: "border-l-amber-500" },
    teal: { icon: "text-teal-900 bg-teal-100", border: "border-l-teal-600" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`bg-white rounded-sm p-5 border border-slate-300 border-l-4 ${c.border} hover:shadow-sm hover:border-blue-900 transition-all duration-200 flex flex-col justify-between h-36`}>
      <div className="flex justify-between items-start">
        <div className={`w-10 h-10 rounded-sm flex items-center justify-center text-lg ${c.icon}`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm uppercase tracking-wider">{unit}</span>
      </div>
      <div className="mt-auto">
        <h3 className="text-2xl font-black text-blue-900 tracking-tight font-mono">{value}</h3>
        <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
};

// --- Dashboard Component (Learning Hub Style) ---
const Dashboard = ({ questionsCount, examsCount }: any) => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const foldersCount = JSON.parse(
    localStorage.getItem("question_folders") || "[]",
  ).length;
  // Fix M-09: Dùng đúng key 'knowledge_base' thay vì 'elearning_docs' (key không tồn tại)
  const docsCount = JSON.parse(
    localStorage.getItem("knowledge_base") || "[]",
  ).length;

  return (
    <div className="p-6 md:p-8 space-y-6 animate-slide-up max-w-[1400px] mx-auto pb-24 font-[Roboto]">
      {/* Running Marquee Banner */}
      <MarqueeBanner allowEdit={false} />

      {/* 1. Hero Banner — Navy Command Center */}
      <div className="bg-blue-900 rounded-sm p-8 md:p-10 relative overflow-hidden text-white border-b-4 border-yellow-500">
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 41px)'}}></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            {/* Status line */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-blue-800 px-3 py-1 rounded-sm border border-blue-700">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-[9px] font-mono font-bold text-green-400 uppercase tracking-[0.2em]">SYSTEM ONLINE</span>
              </div>
              <span className="text-[10px] font-mono text-blue-300">
                {currentTime.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">
              Xin chào, {user?.fullName}
            </h1>
            <p className="text-blue-200 text-sm max-w-lg leading-relaxed font-medium">
              Trung tâm Chỉ huy Học tập — Hệ thống AI sẵn sàng hỗ trợ Cán bộ quản lý.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Link
              to="/documents"
              className="bg-yellow-500 text-blue-900 px-7 py-3 rounded-sm font-black text-xs uppercase tracking-wider shadow-md hover:bg-yellow-400 transition-all flex items-center gap-2.5 w-fit border border-yellow-600"
            >
              <i className="fas fa-arrow-right"></i> Tiếp tục học tập
            </Link>
            <span className="text-[9px] font-mono text-blue-400 uppercase tracking-wider">
              {currentTime.toLocaleTimeString()} — {user?.role?.toUpperCase() || 'USER'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Stat Cards — 4 columns, Military Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="fa-database" label="Ngân hàng câu hỏi" value={questionsCount} unit="Câu" color="blue" />
        <StatCard icon="fa-file-signature" label="Đề thi đã tạo" value={examsCount} unit="Đề" color="purple" />
        <StatCard icon="fa-folder-tree" label="Chuyên đề" value={foldersCount} unit="Mục" color="orange" />
        <StatCard icon="fa-server" label="Tri thức RAG" value={docsCount} unit="Tài liệu" color="teal" />
      </div>

      {/* 3. Quick Actions — Rectangular Grid */}
      <div className="bg-white rounded-sm border border-slate-300 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
          <div className="w-9 h-9 rounded-sm bg-blue-900 flex items-center justify-center text-yellow-400">
            <i className="fas fa-bolt text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">Truy cập nhanh</h3>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Quick Access Panel</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {user?.role !== "student" ? (
            <>
              <Link to="/generate" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="w-9 h-9 rounded-sm bg-blue-100 text-blue-900 flex items-center justify-center mb-3">
                  <i className="fas fa-robot"></i>
                </div>
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">AI Soạn thảo</h4>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Tạo câu hỏi từ PDF</p>
              </Link>
              <Link to="/bank" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="w-9 h-9 rounded-sm bg-purple-100 text-purple-900 flex items-center justify-center mb-3">
                  <i className="fas fa-layer-group"></i>
                </div>
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Ngân hàng đề</h4>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Quản lý kho dữ liệu</p>
              </Link>
            </>
          ) : (
            <Link to="/lectures" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
              <div className="w-9 h-9 rounded-sm bg-blue-100 text-blue-900 flex items-center justify-center mb-3">
                <i className="fas fa-chalkboard-teacher"></i>
              </div>
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Học liệu điện tử</h4>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Xem tài liệu lớp học</p>
            </Link>
          )}
          <Link to="/documents" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-sm bg-teal-100 text-teal-900 flex items-center justify-center mb-3">
              <i className="fas fa-book-open"></i>
            </div>
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Tài liệu</h4>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Tra cứu giáo trình</p>
          </Link>
          <Link to="/settings" className="group p-5 bg-slate-50 border border-slate-300 rounded-sm hover:border-blue-900 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-sm bg-slate-200 text-slate-700 flex items-center justify-center mb-3">
              <i className="fas fa-sliders"></i>
            </div>
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Cấu hình</h4>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">API Key & Hệ thống</p>
          </Link>
        </div>
      </div>

      {/* 4. Recent Activity — Command Log */}
      <div className="bg-white rounded-sm border border-slate-300 p-6 md:p-8 min-h-[160px]">
        <div className="flex items-center gap-3 mb-5 border-b border-slate-200 pb-4">
            <div className="bg-yellow-500 p-2.5 rounded-sm flex items-center justify-center border border-yellow-600 shadow-sm shrink-0">
              <i className="fas fa-graduation-cap text-blue-900 text-base"></i>
            </div>
            <div>
              <h3 className="text-[11px] font-black text-blue-900 uppercase tracking-wider leading-none mb-1">Khu vực Cán bộ quản lý</h3>
              <p className="text-[9px] font-mono text-blue-700 font-bold uppercase tracking-widest whitespace-nowrap">MANAGEMENT STAFF HUB</p>
            </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-4 p-3 rounded-sm bg-slate-50 border border-slate-200">
            <div className="w-7 h-7 rounded-sm bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <i className="fas fa-check text-[10px]"></i>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Đăng nhập hệ thống thành công</p>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{currentTime.toLocaleTimeString()} — AUTH OK</p>
            </div>
            <span className="text-[8px] font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-sm border border-green-200 uppercase">Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [folders, setFolders] = useState<QuestionFolder[]>([
    { id: "default", name: "Mặc định", createdAt: 0 },
  ]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeDocument[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [notifications, setNotifications] = useState<
    { id: number; message: string; type: string }[]
  >([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("isSidebarCollapsed") === "true";
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("isSidebarCollapsed", String(next));
      return next;
    });
  };

  // --- MIGRATION & DATA LOADING LOGIC ---
  useEffect(() => {
    const initData = async () => {
      if (!user) {
        setQuestions([]);
        setExams([]);
        setIsDataLoaded(true);
        return;
      }

      try {
        // 1. Fetch from Supabase (Now using role-based fetching)
        // 1. Fetch from Supabase (Now using role-based fetching)
        const dbQsRes = await databaseService.fetchQuestions(user.id, user.role);
        const dbExamsRes = await databaseService.fetchExams(user.id, user.role);
        
        const dbQuestions = dbQsRes.documents || [];
        const dbExams = dbExamsRes.documents || [];

        // 2. SAFETY MIGRATION: If DB is empty but LocalStorage has data, migrate it!
        const localQuestionsStr = localStorage.getItem("questions");
        const localExamsStr = localStorage.getItem("exams");

        let finalQuestions = dbQuestions;
        let finalExams = dbExams;

        if (dbQuestions.length === 0 && localQuestionsStr) {
          const localQ = JSON.parse(localQuestionsStr);
          if (Array.isArray(localQ) && localQ.length > 0) {
            console.log("Migrating Questions to Supabase...");
            await databaseService.bulkInsertQuestions(localQ, user.id, user.role);
            const freshQs = await databaseService.fetchQuestions(user.id, user.role);
            finalQuestions = freshQs.documents;
          }
        }

        if (dbExams.length === 0 && localExamsStr) {
          const localE = JSON.parse(localExamsStr);
          if (Array.isArray(localE) && localE.length > 0) {
            console.log("Migrating Exams to Supabase...");
            await databaseService.bulkInsertExams(localE, user.id, user.role);
            const freshExams = await databaseService.fetchExams(user.id, user.role);
            finalExams = freshExams.documents;
          }
        }

        // 3. Set State
        setQuestions(finalQuestions);
        setExams(finalExams);

        // Load non-DB local data (Folders, RAG chunks still local for now)
        setFolders(
          JSON.parse(
            localStorage.getItem("question_folders") ||
              '[{"id":"default","name":"Mặc định","createdAt":0}]',
          ),
        );
        setKnowledgeBase(
          JSON.parse(localStorage.getItem("knowledge_base") || "[]"),
        );
      } catch (err) {
        console.error("Failed to initialize data:", err);
        // Fallback
        setQuestions(JSON.parse(localStorage.getItem("questions") || "[]"));
        setExams(JSON.parse(localStorage.getItem("exams") || "[]"));
      } finally {
        setIsDataLoaded(true);
      }
    };

    initData();
  }, [user]);

  // Sync only auxiliary data to local storage.
  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem("question_folders", JSON.stringify(folders));
    // Fix H-05: Thêm try-catch cho QuotaExceededError khi lưu knowledge base lớn
    try {
      // Chỉ lưu metadata (name, id), không lưu full text vào localStorage
      const kbMeta = knowledgeBase.map(doc => ({ id: doc.id, name: doc.name, size: doc.text?.length || 0 }));
      localStorage.setItem("knowledge_base_meta", JSON.stringify(kbMeta));
      
      // Mỗi document lưu riêng biệt và xử lý lỗi quota từng cái
      knowledgeBase.forEach(doc => {
        try {
          // Cắt ngắn text trước khi lưu để tránh vượt quota
          const truncatedDoc = { ...doc, text: doc.text?.substring(0, 50000) || '' };
          localStorage.setItem(`knowledge_base_${doc.id}`, JSON.stringify(truncatedDoc));
        } catch (itemErr) {
          console.warn(`[KB Storage] Không thể lưu document "${doc.name}" vào localStorage (vượt quota):`, itemErr);
        }
      });
    } catch (err) {
      console.warn('[KB Storage] QuotaExceededError - knowledge base quá lớn để lưu localStorage:', err);
    }
  }, [questions, exams, folders, knowledgeBase, isDataLoaded]);

  const showNotify = (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      4000,
    );
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  if (authLoading || !isDataLoaded)
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-blue-600 font-[Roboto]">
        <i className="fas fa-circle-notch fa-spin text-4xl mb-4"></i>
        <span className="text-sm font-bold uppercase tracking-widest">
          Đang khởi động hệ thống...
        </span>
      </div>
    );

  return (
    <div className="flex h-screen bg-slate-50 font-[Roboto] overflow-hidden relative">
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />

        <Route
          path="*"
          element={
            <ProtectedRoute>
              <div className="flex h-screen w-full overflow-hidden relative">
                {/* Mobile Hamburger Button */}
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  title="Mở menu điều hướng"
                  aria-label="Mở menu điều hướng"
                  className="lg:hidden fixed top-4 left-4 z-50 w-11 h-11 bg-white rounded-sm shadow-md flex items-center justify-center text-blue-900 border border-slate-300"
                >
                  <i
                    className={`fas ${isSidebarOpen ? "fa-times" : "fa-bars"} text-lg`}
                  ></i>
                </button>

                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                  <div
                    className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={closeSidebar}
                  ></div>
                )}

                {/* Sidebar */}
                <aside
                  className={`
                fixed lg:static inset-y-0 left-0 z-40 bg-white border-r border-slate-100 flex flex-col shrink-0 transition-all duration-300 ease-in-out shadow-xl lg:shadow-none
                ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                ${isSidebarCollapsed ? "w-20" : "w-[270px]"}
              `}
                >
                  <div className={`px-6 py-7 border-b border-slate-100 flex items-center relative transition-all duration-300 ${isSidebarCollapsed ? "justify-center" : "gap-3.5"}`}>
                    <img src="/logo.png" alt="Logo BLUEBEE" className={`w-10 h-10 object-contain rounded-sm shadow-lg transition-all duration-300 ${isSidebarCollapsed ? "scale-90" : ""}`} />
                    {!isSidebarCollapsed && (
                      <div className="animate-fade-in whitespace-nowrap overflow-hidden">
                        <h2 className="text-base font-extrabold text-blue-900 tracking-tight">
                          BLUEBEE LMS
                        </h2>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest">
                          BlueBee Education
                        </p>
                      </div>
                    )}
                    
                    {/* PC Collapse Toggle Button */}
                    <button 
                      onClick={toggleSidebarCollapse}
                      title={isSidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
                      className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 shadow-sm z-50 transition-all"
                    >
                      <i className={`fas ${isSidebarCollapsed ? "fa-chevron-right" : "fa-chevron-left"} text-[10px]`}></i>
                    </button>
                  </div>

                  <nav className="flex-1 py-5 overflow-y-auto custom-scrollbar space-y-0.5">
                    {user?.role === "admin" && (
                      <>
                        {!isSidebarCollapsed && (
                          <div className="px-7 mb-2 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-fade-in">
                            Quản trị Hệ thống
                          </div>
                        )}
                        <SidebarLink
                          to="/admin"
                          icon="fa-shield-halved"
                          label="Admin Panel"
                          onClick={closeSidebar}
                          collapsed={isSidebarCollapsed}
                        />
                      </>
                    )}

                    {user?.role === "teacher" && (
                      <>
                        {!isSidebarCollapsed && (
                          <div className="px-7 mb-2 mt-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-fade-in">
                            Khu vực Cán bộ quản lý
                          </div>
                        )}
                        <SidebarLink
                          to="/teacher/students"
                          icon="fa-users-gear"
                          label="Quản lý Học viên"
                          onClick={closeSidebar}
                          collapsed={isSidebarCollapsed}
                        />
                      </>
                    )}

                    {!isSidebarCollapsed && (
                      <div className="px-7 mb-2 mt-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-fade-in">
                        Không gian Học tập
                      </div>
                    )}
                    <SidebarLink
                      to="/"
                      icon="fa-gauge-high"
                      label="Tổng quan"
                      onClick={closeSidebar}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarLink
                      to="/lectures"
                      icon="fa-film"
                      label="Học liệu điện tử"
                      onClick={closeSidebar}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarLink
                      to="/documents"
                      icon="fa-book-open"
                      label="Tài liệu & RAG"
                      onClick={closeSidebar}
                      collapsed={isSidebarCollapsed}
                    />

                    {user?.role !== "student" && (
                      <>
                        {!isSidebarCollapsed && (
                          <div className="px-7 mb-2 mt-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-fade-in">
                            Công cụ Biên soạn
                          </div>
                        )}
                        <SidebarLink
                          to="/bank"
                          icon="fa-server"
                          label="Ngân hàng Đề"
                          onClick={closeSidebar}
                          collapsed={isSidebarCollapsed}
                        />
                        <SidebarLink
                          to="/generate"
                          icon="fa-robot"
                          label="AI Soạn thảo"
                          onClick={closeSidebar}
                          collapsed={isSidebarCollapsed}
                        />
                      </>
                    )}

                    {!isSidebarCollapsed && (
                      <div className="px-7 mb-2 mt-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-fade-in">
                        Tiện ích Mở rộng
                      </div>
                    )}
                    <SidebarLink
                      to="/online-test"
                      icon="fa-laptop-code"
                      label="Kiểm tra trực tuyến"
                      onClick={closeSidebar}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarLink
                      to="/self-study"
                      icon="fa-book-reader"
                      label="Ôn tập tự học"
                      onClick={closeSidebar}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarLink
                      to="/schedule"
                      icon="fa-calendar-days"
                      label="Lịch Công Tác"
                      onClick={closeSidebar}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarLink
                      to="/settings"
                      icon="fa-sliders"
                      label="Cấu hình"
                      onClick={closeSidebar}
                      collapsed={isSidebarCollapsed}
                    />
                  </nav>

                  <div className={`p-5 border-t border-slate-100 transition-all duration-300 ${isSidebarCollapsed ? "flex flex-col items-center" : ""}`}>
                    <Link
                      to="/profile"
                      className={`flex items-center p-3 rounded-sm bg-slate-50 hover:bg-blue-50 transition-all cursor-pointer group mb-3 ${isSidebarCollapsed ? "w-10 h-10 justify-center p-0" : "gap-3"}`}
                      title={isSidebarCollapsed ? user?.fullName : ""}
                    >
                      <div className={`bg-blue-100 rounded-sm flex items-center justify-center text-blue-900 text-sm font-bold overflow-hidden group-hover:shadow-md transition-all ${isSidebarCollapsed ? "w-8 h-8" : "w-10 h-10"}`}>
                        {user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          user?.fullName.charAt(0)
                        )}
                      </div>
                      {!isSidebarCollapsed && (
                        <div className="flex flex-col overflow-hidden animate-fade-in">
                          <span className="text-sm font-semibold text-slate-700 truncate group-hover:text-blue-700 transition-colors">
                            {user?.fullName}
                          </span>
                          <span className="text-[10px] text-blue-500 font-semibold">
                            {user?.role === "admin"
                              ? "Quản trị viên"
                              : user?.role === "teacher"
                                ? "Cán bộ quản lý"
                                : "Học viên"}
                          </span>
                        </div>
                      )}
                    </Link>
                    <button
                      onClick={signOut}
                      title={isSidebarCollapsed ? "Đăng xuất" : ""}
                      className={`py-2.5 bg-white border border-slate-300 text-slate-500 rounded-sm text-xs font-semibold hover:text-red-700 hover:border-red-300 hover:bg-red-50 transition-all flex items-center justify-center gap-2 ${isSidebarCollapsed ? "w-10" : "w-full"}`}
                    >
                      <i className="fas fa-sign-out-alt"></i> 
                      {!isSidebarCollapsed && <span className="animate-fade-in">Đăng xuất</span>}
                    </button>
                  </div>
                </aside>

                <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
                  <div className="flex-1 overflow-auto custom-scrollbar p-0">
                    <Routes>
                      <Route
                        path="/"
                        element={
                          user?.role === "admin" ? (
                            <Dashboard
                                questionsCount={questions.length}
                                examsCount={exams.length}
                            />
                          ) : user?.role === "teacher" ? (
                            <TeacherDashboard />
                          ) : (
                            <StudentDashboard />
                          )
                        }
                      />
                      <Route
                        path="/profile"
                        element={<ProfileSettings onNotify={showNotify} />}
                      />
                      <Route
                        path="/admin/*"
                        element={
                          <ProtectedRoute allowedRoles={["admin"]}>
                            <AdminDashboard onNotify={showNotify} />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/teacher/students"
                        element={
                          <ProtectedRoute allowedRoles={["teacher"]}>
                            <TeacherStudents onNotify={showNotify} />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/lectures"
                        element={<LectureManager onNotify={showNotify} />}
                      />
                      <Route
                        path="/documents"
                        element={
                          <Documents
                            onUpdateKnowledgeBase={(doc) =>
                              setKnowledgeBase((p) => [...p, doc])
                            }
                            onDeleteDocumentData={(id) =>
                              setKnowledgeBase((p) =>
                                p.filter((d) => d.id !== id),
                              )
                            }
                            onNotify={showNotify}
                          />
                        }
                      />
                      <Route
                        path="/generate"
                        element={
                          <ProtectedRoute allowedRoles={["admin", "teacher"]}>
                            <QuestionGenerator
                              folders={folders}
                              onSaveQuestions={async (newQ) => {
                                // Save to DB via service - Source of Truth
                                if (user) {
                                  await databaseService.bulkInsertQuestions(
                                    newQ,
                                    user.id,
                                    user.role
                                  );
                                  const updated =
                                    await databaseService.fetchQuestions(
                                      user.id,
                                      user.role
                                    );
                                  setQuestions(updated.documents);
                                }
                              }}
                              onNotify={showNotify}
                            />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/bank"
                        element={
                          <ProtectedRoute allowedRoles={["admin", "teacher"]}>
                            <QuestionBankManager
                              folders={folders}
                              setFolders={setFolders}
                              exams={exams}
                              setExams={setExams}
                              showNotify={showNotify}
                            />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/online-test"
                        element={<OnlineTestManager user={user} />}
                      />
                      <Route
                        path="/self-study"
                        element={<SelfStudyManager user={user} />}
                      />
                      <Route
                        path="/schedule"
                        element={<ScheduleManager />}
                      />
                      <Route
                        path="/settings"
                        element={<Settings onNotify={showNotify} />}
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </div>
                  <Chatbot
                    knowledgeBase={knowledgeBase}
                    onNotify={showNotify}
                  />
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Notifications — Modern Rounded */}
      <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`px-5 py-4 bg-white rounded-xl shadow-lg border-l-4 flex items-center gap-3.5 animate-slide-up pointer-events-auto min-w-[320px] transition-all ${
              n.type === "success"
                ? "border-blue-500"
                : n.type === "error"
                  ? "border-red-500"
                  : "border-blue-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                n.type === "success"
                  ? "bg-blue-50 text-blue-600"
                  : n.type === "error"
                    ? "bg-red-50 text-red-500"
                    : "bg-blue-50 text-blue-500"
              }`}
            >
              <i
                className={`fas ${
                  n.type === "success"
                    ? "fa-check"
                    : n.type === "error"
                      ? "fa-exclamation"
                      : "fa-info"
                } text-sm`}
              ></i>
            </div>
            <div>
              <p
                className={`text-xs font-bold ${
                  n.type === "success"
                    ? "text-blue-600"
                    : n.type === "error"
                      ? "text-red-500"
                      : "text-blue-500"
                }`}
              >
                {n.type === "success"
                  ? "Thành công"
                  : n.type === "error"
                    ? "Lỗi hệ thống"
                    : "Thông báo"}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                {n.message}
              </p>
            </div>
          </div>
        ))}
      </div>
      <ChangelogModal />
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <Router future={{ v7_relativeSplatPath: true }}>
      <AppContent />
      <SpeedInsights />
    </Router>
  </AuthProvider>
);

export default App;