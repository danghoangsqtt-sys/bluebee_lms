import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Question, QuestionFolder, QuestionType, Exam } from '../types';
import { formatContent } from '../utils/textFormatter';
import ExamCreator from './ExamCreator';
import { databases, APPWRITE_CONFIG, Query, ID } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import { databaseService, fetchCustomFolders, createCustomFolder, deleteCustomFolder } from '../services/databaseService';

interface QuestionBankManagerProps {
  folders: QuestionFolder[];
  setFolders: React.Dispatch<React.SetStateAction<QuestionFolder[]>>;
  exams: Exam[];
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  showNotify: (message: string, type: any) => void;
}

const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({ 
  folders, 
  setFolders, 
  exams = [], 
  setExams, 
  showNotify 
}) => {
  const { user } = useAuth();
  const [managerTab, setManagerTab] = useState<'QUESTIONS' | 'EXAMS'>('QUESTIONS');
  const [activeTab, setActiveTab] = useState<QuestionType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [viewScope, setViewScope] = useState<'MINE' | 'PUBLIC'>('MINE');
  const [dbQuestions, setDbQuestions] = useState<Question[]>([]);
  const [dbExams, setDbExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);

  // --- BỘ LỌC NÂNG CAO ---
  type SortOption = 'newest' | 'oldest' | 'type' | 'bloom' | 'alpha';
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [bloomFilter, setBloomFilter] = useState<string>('ALL');

  const BLOOM_LEVELS_LIST = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];
  const BLOOM_ORDER: Record<string, number> = { 'Nhận biết': 1, 'Thông hiểu': 2, 'Vận dụng': 3, 'Phân tích': 4, 'Đánh giá': 5, 'Sáng tạo': 6 };
  const BLOOM_CONFIG: Record<string, { active: string; inactive: string; dot: string }> = {
    'Nhận biết':  { active: 'bg-blue-600 text-white border-blue-600',    inactive: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',    dot: 'bg-blue-500' },
    'Thông hiểu': { active: 'bg-teal-600 text-white border-teal-600',    inactive: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',    dot: 'bg-teal-500' },
    'Vận dụng':   { active: 'bg-green-600 text-white border-green-600',  inactive: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',  dot: 'bg-green-500' },
    'Phân tích':  { active: 'bg-amber-600 text-white border-amber-600',  inactive: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',  dot: 'bg-amber-500' },
    'Đánh giá':   { active: 'bg-orange-600 text-white border-orange-600',inactive: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',dot: 'bg-orange-500' },
    'Sáng tạo':   { active: 'bg-purple-600 text-white border-purple-600',inactive: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',dot: 'bg-purple-500' },
  };

  const [selectedFolder, setSelectedFolder] = useState<string>('ALL');
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 20;
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // --- EXAM MANAGER STATE (Task Requirement) ---
  const [examCustomFolders, setExamCustomFolders] = useState<string[]>([]);
  const [selectedExamFolder, setSelectedExamFolder] = useState<string>('ALL');
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [isDeletingExamBulk, setIsDeletingExamBulk] = useState(false);
  const [deletedExamCount, setDeletedExamCount] = useState(0);
  const [isExamMoveModalOpen, setIsExamMoveModalOpen] = useState(false);
  const [examTargetMoveFolder, setExamTargetMoveFolder] = useState('');
  const [isMovingExamBulk, setIsMovingExamBulk] = useState(false);

  // Fetch folders from Cloud (Appwrite)
  useEffect(() => {
      const loadFolders = async () => {
          const [qFolders, eFolders] = await Promise.all([
              fetchCustomFolders('question'),
              fetchCustomFolders('exam')
          ]);
          setCustomFolders(qFolders);
          setExamCustomFolders(eFolders);
      };
      loadFolders();
  }, []);

  // Debounce Search Logic
  useEffect(() => {
      const timer = setTimeout(() => {
          setDebouncedSearch(search);
          setCurrentPage(1); // Reset to first page on search
      }, 500);
      return () => clearTimeout(timer);
  }, [search]);

  // Edit State
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Selection & Delete State (Questions)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [deletedQuestionCount, setDeletedQuestionCount] = useState(0);
  const [isDeletingIndividual, setIsDeletingIndividual] = useState(false);

  // Bulk Move State (Questions)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveFolder, setTargetMoveFolder] = useState('');
  const [isMovingBulk, setIsMovingBulk] = useState(false);

  // Assign Exam to Class State
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [examToAssign, setExamToAssign] = useState<any>(null);
  const [selectedClassToAssign, setSelectedClassToAssign] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
      const loadClasses = async () => {
          try {
              const cls = await databaseService.fetchClasses();
              setAvailableClasses(cls);
          } catch (err) { console.error('Lỗi tải danh sách lớp:', err); }
      };
      loadClasses();
  }, []);

  const openAssignModal = (exam: any) => {
      setExamToAssign(exam);
      setSelectedClassToAssign(exam.class_id || exam.sharedWithClassId || '');
      setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async () => {
      if (!examToAssign) return;
      setIsAssigning(true);
      try {
          await databaseService.updateExam(examToAssign.id, { class_id: selectedClassToAssign || null });
          setDbExams(prev => prev.map(e => e.id === examToAssign.id ? { ...e, class_id: selectedClassToAssign || null, sharedWithClassId: selectedClassToAssign || null } : e));
          setIsAssignModalOpen(false);
          setExamToAssign(null);
          showNotify('Đã cập nhật trạng thái giao đề thành công!', 'success');
      } catch (error: any) {
          console.error('Lỗi khi giao đề:', error);
          showNotify('Có lỗi xảy ra khi cập nhật lớp: ' + error.message, 'error');
      } finally {
          setIsAssigning(false);
      }
  };

  const fetchDbQuestions = async () => {
    if (!user) return;
    setLoading(true);
    setSelectedQuestionIds([]); 
    try {
        const { documents, total } = await databaseService.fetchQuestions(user.id, user.role, {
            limit: ITEMS_PER_PAGE,
            offset: (currentPage - 1) * ITEMS_PER_PAGE,
            search: debouncedSearch,
            folder: selectedFolder,
            type: activeTab
        });
        setDbQuestions(documents);
        setTotalItems(total);
    } catch (err: any) {
        showNotify("Lỗi tải câu hỏi: " + err.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const fetchDbExams = async () => {
      if (!user) return;
      setLoading(true);
      setSelectedExamIds([]);
      try {
          const { documents, total } = await databaseService.fetchExams(user.id, user.role, {
              limit: ITEMS_PER_PAGE,
              offset: (currentPage - 1) * ITEMS_PER_PAGE,
              search: debouncedSearch,
              folder: selectedExamFolder
          });
          setDbExams(documents);
          setTotalItems(total);
      } catch (err: any) {
          showNotify("Lỗi tải đề thi: " + err.message, 'error');
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    if (user?.id) {
        if (managerTab === 'QUESTIONS') fetchDbQuestions();
        else fetchDbExams();
    }
  }, [viewScope, user, managerTab, currentPage, debouncedSearch, activeTab, selectedFolder, selectedExamFolder]);

  // Reset page when switching tabs or folders
  useEffect(() => {
      setCurrentPage(1);
  }, [managerTab, activeTab, selectedFolder, selectedExamFolder]);

  const deleteQuestion = async (id: string) => {
      if (!window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
      setIsDeletingIndividual(true);
      try {
          await databaseService.deleteQuestion(id);
          setDbQuestions(prev => prev.filter(q => q.id !== id));
          setSelectedQuestionIds(prev => prev.filter(selId => selId !== id));
          showNotify("Đã xóa câu hỏi.", "info");
      } catch (err: any) {
          showNotify("Lỗi xóa: " + err.message, "error");
      } finally {
          setIsDeletingIndividual(false);
      }
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingQuestion || !user) return;
      setIsSaving(true);
      try {
          const updated = await databaseService.saveQuestion(editingQuestion, user.id, user.role);
          setDbQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
          showNotify("Cập nhật câu hỏi thành công!", "success");
          setEditingQuestion(null);
      } catch (err: any) {
          showNotify("Lỗi cập nhật: " + err.message, "error");
      } finally {
          setIsSaving(false);
      }
  };

  // --- Question Folder Logic ---
  const uniqueFolders = useMemo(() => {
      const dbFolders = new Set(dbQuestions.map(q => q.folder || 'Mặc định'));
      const allFolders = new Set([...Array.from(dbFolders), ...customFolders, 'Mặc định']);
      return ['ALL', ...Array.from(allFolders).sort()];
  }, [dbQuestions, customFolders]);

  const displayQuestions = useMemo(() => {
    const getContent = (q: Question) => typeof q.content === 'string' ? q.content : (q.content as any)?.content || '';
    const filtered = dbQuestions.filter(q =>
        bloomFilter === 'ALL' || q.bloomLevel === bloomFilter
    );
    return [...filtered].sort((a, b) => {
        switch (sortBy) {
            case 'oldest': return (a.createdAt || 0) - (b.createdAt || 0);
            case 'newest': return (b.createdAt || 0) - (a.createdAt || 0);
            case 'type':   return (a.type || '').localeCompare(b.type || '');
            case 'bloom':  return (BLOOM_ORDER[a.bloomLevel || ''] || 99) - (BLOOM_ORDER[b.bloomLevel || ''] || 99);
            case 'alpha':  return getContent(a).localeCompare(getContent(b), 'vi');
            default:       return 0;
        }
    });
  }, [dbQuestions, bloomFilter, sortBy]);

  // --- Exam Folder Logic ---
  const uniqueExamFolders = useMemo(() => {
      const dbFolders = new Set(dbExams.map(e => e.folder || 'Mặc định'));
      const allFolders = new Set([...Array.from(dbFolders), ...examCustomFolders, 'Mặc định']);
      return ['ALL', ...Array.from(allFolders).sort()];
  }, [dbExams, examCustomFolders]);

  const displayExams = dbExams;

  // --- Permission Helpers ---
  const canModify = (creatorId?: string) => {
      if (!user) return false;
      return user.role === 'admin' || creatorId === user.id;
  };

  // --- Handlers: Questions Bulk ---
  const handleToggleSelect = (id: string) => setSelectedQuestionIds(prev => prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]);
  const handleToggleSelectAll = (filteredList: Question[]) => {
      // Only select items user can modify
      const modifiableList = filteredList.filter(q => canModify(q.creatorId));
      
      const isAllSelected = modifiableList.length > 0 && modifiableList.every(q => selectedQuestionIds.includes(q.id));
      if (isAllSelected) {
          const idsToDeselect = modifiableList.map(q => q.id);
          setSelectedQuestionIds(prev => prev.filter(id => !idsToDeselect.includes(id)));
      } else {
          const newIds = modifiableList.map(q => q.id);
          setSelectedQuestionIds(prev => Array.from(new Set([...prev, ...newIds])));
      }
  };

  const handleBulkDelete = async () => {
      if (selectedQuestionIds.length === 0 || !window.confirm(`Xóa vĩnh viễn ${selectedQuestionIds.length} câu hỏi?`)) return;
      setIsDeletingBulk(true);
      setDeletedQuestionCount(0);
      try {
          for (const id of selectedQuestionIds) {
              await databaseService.deleteQuestion(id);
              setDeletedQuestionCount(prev => prev + 1);
              await new Promise(resolve => setTimeout(resolve, 300));
          }
          setDbQuestions(prev => prev.filter(q => !selectedQuestionIds.includes(q.id)));
          setSelectedQuestionIds([]);
          showNotify(`Đã xóa ${selectedQuestionIds.length} câu hỏi.`, "success");
      } catch (error: any) { showNotify("Lỗi xóa: " + error.message, "error"); } finally { setIsDeletingBulk(false); setDeletedQuestionCount(0); }
  };

  const handleBulkMove = async () => {
    if (!targetMoveFolder.trim()) return;
    setIsMovingBulk(true);
    try {
        // AUTONOMOUS PATCH: Sequential Throttling to prevent 429
        for (const id of selectedQuestionIds) {
            await databaseService.updateQuestion(id, { folder: targetMoveFolder.trim() });
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        setDbQuestions(prev => prev.map(q => selectedQuestionIds.includes(q.id) ? { ...q, folder: targetMoveFolder.trim(), folderId: targetMoveFolder.trim() } : q));
        if (!customFolders.includes(targetMoveFolder.trim())) setCustomFolders(prev => [...prev, targetMoveFolder.trim()]);
        setSelectedQuestionIds([]); setIsMoveModalOpen(false); setTargetMoveFolder('');
        showNotify("Đã di chuyển thành công.", "success");
    } catch (error: any) { showNotify("Lỗi di chuyển: " + error.message, "error"); } finally { setIsMovingBulk(false); }
  };

  // --- Handlers: Exams Bulk ---
  const handleToggleExamSelect = (id: string) => setSelectedExamIds(prev => prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]);
  const handleToggleExamSelectAll = (filteredList: Exam[]) => {
      const modifiableList = filteredList.filter(e => canModify(e.creatorId));
      
      const isAllSelected = modifiableList.length > 0 && modifiableList.every(e => selectedExamIds.includes(e.id));
      if (isAllSelected) {
          const idsToDeselect = modifiableList.map(e => e.id);
          setSelectedExamIds(prev => prev.filter(id => !idsToDeselect.includes(id)));
      } else {
          const newIds = modifiableList.map(e => e.id);
          setSelectedExamIds(prev => Array.from(new Set([...prev, ...newIds])));
      }
  };

  const handleExamBulkDelete = async () => {
      if (selectedExamIds.length === 0 || !window.confirm(`Xóa vĩnh viễn ${selectedExamIds.length} đề thi?`)) return;
      setIsDeletingExamBulk(true);
      setDeletedExamCount(0);
      try {
          for (const id of selectedExamIds) {
              await databaseService.deleteExam(id);
              setDeletedExamCount(prev => prev + 1);
              await new Promise(resolve => setTimeout(resolve, 300));
          }
          setDbExams(prev => prev.filter(e => !selectedExamIds.includes(e.id)));
          setSelectedExamIds([]);
          showNotify(`Đã xóa ${selectedExamIds.length} đề thi.`, "success");
      } catch (error: any) { showNotify("Lỗi xóa: " + error.message, "error"); } finally { setIsDeletingExamBulk(false); setDeletedExamCount(0); }
  };

  const handleExamBulkMove = async () => {
      if (!examTargetMoveFolder.trim()) return;
      setIsMovingExamBulk(true);
      try {
          // AUTONOMOUS PATCH: Sequential Throttling to prevent 429
          for (const id of selectedExamIds) {
              await databaseService.updateExam(id, { folder: examTargetMoveFolder.trim() });
              await new Promise(resolve => setTimeout(resolve, 300));
          }
          setDbExams(prev => prev.map(e => selectedExamIds.includes(e.id) ? { ...e, folder: examTargetMoveFolder.trim() } : e));
          if (!examCustomFolders.includes(examTargetMoveFolder.trim())) setExamCustomFolders(prev => [...prev, examTargetMoveFolder.trim()]);
          setSelectedExamIds([]); setIsExamMoveModalOpen(false); setExamTargetMoveFolder('');
          showNotify("Đã di chuyển đề thi thành công.", "success");
      } catch (error: any) { showNotify("Lỗi di chuyển: " + error.message, "error"); } finally { setIsMovingExamBulk(false); }
  };

  const handleCreateFolder = async () => {
      const folderName = window.prompt('Nhập tên thư mục mới:');
      if (folderName && folderName.trim() !== '') {
          const newName = folderName.trim();
          const moduleName = managerTab === 'QUESTIONS' ? 'question' : 'exam';
          const currentList = managerTab === 'QUESTIONS' ? customFolders : examCustomFolders;
          if (!currentList.includes(newName)) {
              try {
                  await createCustomFolder(newName, moduleName as 'question' | 'exam');
                  if (managerTab === 'QUESTIONS') {
                      setCustomFolders([...customFolders, newName]);
                      setSelectedFolder(newName);
                  } else {
                      setExamCustomFolders([...examCustomFolders, newName]);
                      setSelectedExamFolder(newName);
                  }
                  showNotify(`Đã tạo thư mục "${newName}"`, "success");
              } catch(e) { alert("Lỗi mạng, không thể tạo thư mục."); }
          } else {
              if (managerTab === 'QUESTIONS') setSelectedFolder(newName);
              else setSelectedExamFolder(newName);
          }
      }
  };

  const handleRenameFolder = async (oldName: string) => {
      if (oldName === 'ALL' || oldName === 'Mặc định') return;
      const newName = window.prompt('Nhập tên mới cho thư mục:', oldName);
      if (!newName || newName.trim() === '' || newName === oldName) return;

      const trimmedNewName = newName.trim();
      const moduleName = managerTab === 'QUESTIONS' ? 'question' : 'exam';

      try {
          // Xóa folder cũ + tạo folder mới trên Cloud
          await deleteCustomFolder(oldName, moduleName as 'question' | 'exam');
          await createCustomFolder(trimmedNewName, moduleName as 'question' | 'exam');

          // Cập nhật state
          if (managerTab === 'QUESTIONS') {
              setCustomFolders(prev => prev.map(f => f === oldName ? trimmedNewName : f));
          } else {
              setExamCustomFolders(prev => prev.map(f => f === oldName ? trimmedNewName : f));
          }

          // Cập nhật database items trong folder
          const itemsInFolder = managerTab === 'QUESTIONS'
              ? dbQuestions.filter(q => q.folder === oldName)
              : dbExams.filter(e => e.folder === oldName);

          if (itemsInFolder.length > 0) {
              setLoading(true);
              try {
                  const chunkSize = 10;
                  if (managerTab === 'QUESTIONS') {
                      for (const q of itemsInFolder) {
                          await databaseService.updateQuestion(q.id, { folder: trimmedNewName });
                          await new Promise(resolve => setTimeout(resolve, 300));
                      }
                      setDbQuestions(prev => prev.map(q => q.folder === oldName ? { ...q, folder: trimmedNewName } : q));
                  } else {
                      for (const e of itemsInFolder) {
                          await databaseService.updateExam(e.id, { folder: trimmedNewName });
                          await new Promise(resolve => setTimeout(resolve, 300));
                      }
                      setDbExams(prev => prev.map(e => e.folder === oldName ? { ...e, folder: trimmedNewName } : e));
                  }
                  showNotify(`Đã đổi tên thư mục thành "${trimmedNewName}" cho ${itemsInFolder.length} mục.`, 'success');
              } catch (err: any) {
                  showNotify('Lỗi khi cập nhật items: ' + err.message, 'error');
              } finally {
                  setLoading(false);
              }
          }
      } catch (error: any) {
          showNotify('Lỗi khi đổi tên: ' + error.message, 'error');
      }

      if (managerTab === 'QUESTIONS' && selectedFolder === oldName) setSelectedFolder(trimmedNewName);
      if (managerTab === 'EXAMS' && selectedExamFolder === oldName) setSelectedExamFolder(trimmedNewName);
  };

  const handleDeleteFolder = async (folderName: string) => {
      if (folderName === 'ALL' || folderName === 'Mặc định') return;
      const itemsInFolder = managerTab === 'QUESTIONS'
          ? dbQuestions.filter(q => q.folder === folderName)
          : dbExams.filter(e => e.folder === folderName);

      if (itemsInFolder.length > 0) {
          showNotify(`Thư mục đang chứa ${itemsInFolder.length} mục. Vui lòng di chuyển hoặc xóa trước.`, 'warning');
          return;
      }
      if (window.confirm(`Bạn có chắc muốn xóa thư mục "${folderName}" rỗng này không?`)) {
          const moduleName = managerTab === 'QUESTIONS' ? 'question' : 'exam';
          try {
              await deleteCustomFolder(folderName, moduleName as 'question' | 'exam');
              if (managerTab === 'QUESTIONS') {
                  setCustomFolders(prev => prev.filter(f => f !== folderName));
                  if (selectedFolder === folderName) setSelectedFolder('ALL');
              } else {
                  setExamCustomFolders(prev => prev.filter(f => f !== folderName));
                  if (selectedExamFolder === folderName) setSelectedExamFolder('ALL');
              }
              showNotify(`Đã xóa thư mục "${folderName}"`, 'info');
          } catch(e) { alert("Lỗi khi xóa thư mục."); }
      }
  };

  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [viewingExam, setViewingExam] = useState<Exam | null>(null);

  const handleSaveExamToDb = async (exam: Exam) => {
      try {
          // Use folder from ExamCreator's targetExamFolder (already set on exam.folder)
          if (!exam.folder) exam.folder = 'Mặc định';
          await databaseService.saveExam(exam, user?.id || '', user?.role);
          showNotify("Đã lưu đề thi thành công.", "success");
          setIsCreatingExam(false);
          fetchDbExams();
      } catch (err: any) {
          showNotify(`Lỗi lưu đề thi: ${err.message}`, "error");
      }
  };

  if (isCreatingExam || viewingExam) {
    const isReadOnly = viewingExam ? !canModify(viewingExam.creatorId) : false;
    return <ExamCreator 
      viewExam={viewingExam || undefined}
      onBack={() => { setIsCreatingExam(false); setViewingExam(null); }} 
      onSaveExam={handleSaveExamToDb}
      readOnly={isReadOnly}
    />;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 font-[Roboto] overflow-hidden">
      {/* 1. Global Header */}
      <header className="bg-blue-900 border-b-4 border-yellow-500 px-6 py-4 shrink-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-yellow-500 text-blue-900 rounded-sm flex items-center justify-center text-lg">
                <i className={`fas ${managerTab === 'QUESTIONS' ? 'fa-database' : 'fa-file-signature'}`}></i>
            </div>
            <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                    {managerTab === 'QUESTIONS' ? 'Ngân hàng câu hỏi' : 'Quản lý Đề thi'}
                </h2>
                <p className="text-[9px] font-mono font-bold text-blue-300 uppercase tracking-widest">
                    Tổng số: <span className="text-yellow-400">{managerTab === 'QUESTIONS' ? displayQuestions.length : displayExams.length}</span> mục
                </p>
            </div>
        </div>
        <div className="flex bg-blue-800 p-0.5 rounded-sm border border-blue-700">
            <button onClick={() => setManagerTab('QUESTIONS')} className={`px-5 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${managerTab === 'QUESTIONS' ? 'bg-yellow-500 text-blue-900' : 'text-blue-300 hover:bg-blue-700 hover:text-white'}`}>Kho câu hỏi</button>
            <button onClick={() => setManagerTab('EXAMS')} className={`px-5 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${managerTab === 'EXAMS' ? 'bg-yellow-500 text-blue-900' : 'text-blue-300 hover:bg-blue-700 hover:text-white'}`}>Đề thi</button>
        </div>
      </header>

      {/* 2. Main Layout Body (2 Columns) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50">
          
          {/* LEFT SIDEBAR: FOLDERS TREE */}
          <aside className="w-full md:w-72 flex flex-col gap-4 border-r-2 border-blue-900 bg-white pr-0 shrink-0 z-10 h-full">
                <div className="p-5 pb-2">
                    <h3 className="font-black text-blue-900 uppercase text-[10px] tracking-widest mb-4">
                        {managerTab === 'QUESTIONS' ? 'Danh mục Câu hỏi' : 'Danh mục Đề thi'}
                    </h3>
                    <button 
                        onClick={handleCreateFolder} 
                        className="w-full py-3 border-2 border-dashed border-blue-900/30 text-blue-900 font-bold text-xs hover:bg-blue-50 rounded-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-folder-plus"></i> Tạo thư mục mới
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-1 pb-4">
                    {(managerTab === 'QUESTIONS' ? uniqueFolders : uniqueExamFolders).map(folder => {
                        const isAll = folder === 'ALL';
                        const isDefault = folder === 'Mặc định';
                        const isSelected = (managerTab === 'QUESTIONS' ? selectedFolder : selectedExamFolder) === folder;
                        const canEditFolder = !isAll && !isDefault;
                        
                        return (
                            <div
                                key={folder}
                                className={`group flex items-center justify-between px-4 py-3 rounded-sm text-xs font-bold transition-all ${
                                    isSelected
                                        ? 'bg-blue-900 text-white border-l-4 border-l-yellow-500'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <button
                                    onClick={() => managerTab === 'QUESTIONS' ? setSelectedFolder(folder) : setSelectedExamFolder(folder)}
                                    className="flex-1 text-left truncate"
                                >
                                    {isAll ? (managerTab === 'QUESTIONS' ? 'Tất cả câu hỏi' : 'Tất cả đề thi') : folder}
                                </button>
                                {canEditFolder && (
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }} 
                                            className={`w-6 h-6 flex items-center justify-center rounded-sm transition-all ${isSelected ? 'hover:bg-white/20 text-white/70 hover:text-yellow-300' : 'hover:bg-yellow-100 text-slate-400 hover:text-yellow-600'}`}
                                            title="Đổi tên"
                                        >
                                            <i className="fas fa-edit text-[10px]"></i>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} 
                                            className={`w-6 h-6 flex items-center justify-center rounded-sm transition-all ${isSelected ? 'hover:bg-white/20 text-white/70 hover:text-red-300' : 'hover:bg-red-100 text-slate-400 hover:text-red-500'}`}
                                            title="Xóa thư mục"
                                        >
                                            <i className="fas fa-trash-alt text-[10px]"></i>
                                        </button>
                                    </div>
                                )}
                                {!canEditFolder && isSelected && <i className="fas fa-chevron-right text-[10px]"></i>}
                            </div>
                        );
                    })}
                </div>
                
                <div className="mt-auto px-4 pt-6 pb-4 border-t border-slate-100">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Scope: {user?.role === 'student' ? 'Học viên' : 'Cán bộ/Admin'}</span>
                        <i className="fas fa-database"></i>
                    </div>
                </div>
          </aside>

          {/* RIGHT CONTENT: LIST & TOOLS */}
          <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 p-6 overflow-hidden">
             
             {/* Toolbar Section */}
             <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 shrink-0">
                <div className="relative flex-1 max-w-lg w-full">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                    <input 
                        type="text" 
                        placeholder={`Tìm kiếm trong: ${managerTab === 'QUESTIONS' ? selectedFolder : selectedExamFolder}...`} 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-sm text-xs font-bold text-slate-700 outline-none focus:border-blue-900 shadow-sm" 
                    />
                </div>

                {/* BULK ACTIONS */}
                {(managerTab === 'QUESTIONS' ? selectedQuestionIds.length > 0 : selectedExamIds.length > 0) ? (
                    <div className="flex gap-2 animate-fade-in">
                        <button 
                            onClick={() => managerTab === 'QUESTIONS' ? setIsMoveModalOpen(true) : setIsExamMoveModalOpen(true)} 
                            className="bg-blue-900 text-white px-5 py-3 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-blue-800 transition-all border border-blue-800"
                        >
                            Di chuyển ({managerTab === 'QUESTIONS' ? selectedQuestionIds.length : selectedExamIds.length})
                        </button>
                        <button 
                            onClick={() => managerTab === 'QUESTIONS' ? handleBulkDelete() : handleExamBulkDelete()} 
                            disabled={isDeletingBulk || isDeletingExamBulk} 
                            className="bg-red-700 text-white px-5 py-3 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-red-800 transition-all border border-red-800 disabled:opacity-75 disabled:cursor-not-allowed"
                        >
                            {isDeletingBulk || isDeletingExamBulk 
                                ? `Đang xóa ${managerTab === 'QUESTIONS' ? deletedQuestionCount : deletedExamCount}/${managerTab === 'QUESTIONS' ? selectedQuestionIds.length : selectedExamIds.length}...`
                                : `Xóa (${managerTab === 'QUESTIONS' ? selectedQuestionIds.length : selectedExamIds.length})`}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                        {managerTab === 'QUESTIONS' && (
                            <>
                            {/* Lọc theo loại câu hỏi */}
                            <div className="flex gap-1 bg-white p-0.5 rounded-sm border border-slate-300">
                                {(['ALL', QuestionType.MULTIPLE_CHOICE, QuestionType.ESSAY] as const).map(type => (
                                    <button key={type} onClick={() => setActiveTab(type as any)} className={`px-4 py-2 rounded-sm text-[9px] font-black uppercase transition-all ${activeTab === type ? 'bg-blue-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                                        {type === 'ALL' ? 'Tất cả' : type === QuestionType.MULTIPLE_CHOICE ? 'TN' : 'TL'}
                                    </button>
                                ))}
                            </div>

                            {/* Lọc theo mức độ Bloom */}
                            <div className="flex gap-1 bg-white p-0.5 rounded-sm border border-slate-300">
                                <button
                                    onClick={() => setBloomFilter('ALL')}
                                    className={`px-3 py-2 rounded-sm text-[9px] font-black uppercase transition-all border ${bloomFilter === 'ALL' ? 'bg-blue-900 text-white border-blue-900' : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'}`}
                                >Mọi mức</button>
                                {BLOOM_LEVELS_LIST.map(level => {
                                    const cfg = BLOOM_CONFIG[level];
                                    const isActive = bloomFilter === level;
                                    return (
                                        <button key={level} onClick={() => setBloomFilter(level)}
                                            className={`px-2.5 py-2 rounded-sm text-[9px] font-black uppercase transition-all flex items-center gap-1 border ${isActive ? cfg.active : cfg.inactive}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : cfg.dot}`}></span>
                                            {level}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Sắp xếp */}
                            <div className="relative flex items-center gap-1 bg-white p-0.5 pl-3 rounded-sm border border-slate-300">
                                <i className="fas fa-sort text-slate-400 text-[10px]"></i>
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value as SortOption)}
                                    title="Sắp xếp câu hỏi"
                                    className="appearance-none bg-transparent pr-6 pl-1 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
                                >
                                    <option value="newest">Mới nhất</option>
                                    <option value="oldest">Cũ nhất</option>
                                    <option value="type">Theo loại</option>
                                    <option value="bloom">Theo Bloom</option>
                                    <option value="alpha">A → Z</option>
                                </select>
                                <i className="fas fa-chevron-down text-[8px] text-slate-400 absolute right-2 pointer-events-none"></i>
                            </div>
                            </>
                        )}
                        {managerTab === 'EXAMS' && (
                            <button onClick={() => setIsCreatingExam(true)} className="bg-yellow-500 text-blue-900 px-6 py-3 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-yellow-400 transition-all border border-yellow-600 flex items-center gap-2">
                                <i className="fas fa-plus"></i> Tạo đề mới
                            </button>
                        )}
                    </div>
                )}
             </div>

             {/* Content Grid */}
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-blue-900">
                        <i className="fas fa-cog fa-spin text-4xl"></i>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Loading data...</span>
                    </div>
                ) : managerTab === 'QUESTIONS' ? (
                    <div className="w-full bg-white rounded-sm border border-slate-300 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-blue-900 border-b-2 border-yellow-500">
                                <tr>
                                    <th className="p-4 w-12 text-center"><input type="checkbox" onChange={() => handleToggleSelectAll(displayQuestions)} checked={displayQuestions.length > 0 && displayQuestions.every(q => selectedQuestionIds.includes(q.id))} className="w-4 h-4 accent-yellow-500 cursor-pointer" /></th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-blue-200 uppercase tracking-widest">Nội dung câu hỏi</th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-blue-200 uppercase tracking-widest w-32">Loại</th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-blue-200 uppercase tracking-widest w-32">Mức độ</th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-blue-200 uppercase tracking-widest w-32">Thư mục</th>
                                    <th className="p-4 text-[10px] font-mono font-bold text-blue-200 uppercase tracking-widest w-24 text-right">Tác vụ</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {displayQuestions.length === 0 ? (
                                    <tr><td colSpan={6} className="p-10 text-center text-slate-400 text-xs font-bold uppercase">Không tìm thấy dữ liệu</td></tr>
                                ) : (
                                    displayQuestions.map(q => {
                                        const allowed = canModify(q.creatorId);
                                        return (
                                        <tr key={q.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors group ${selectedQuestionIds.includes(q.id) ? 'bg-blue-50/40' : ''}`}>
                                            <td className="p-4 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedQuestionIds.includes(q.id)} 
                                                    onChange={() => handleToggleSelect(q.id)} 
                                                    disabled={!allowed}
                                                    className="w-4 h-4 accent-blue-600 cursor-pointer rounded disabled:opacity-30" 
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div className="text-sm font-medium text-slate-700 line-clamp-2 max-w-2xl leading-relaxed" title={typeof q.content === 'string' ? q.content : ''}>
                                                    {formatContent(typeof q.content === 'string' ? q.content : (q.content as any).content)}
                                                    {q.isPublicBank && <span className="inline-block ml-2 bg-blue-900 text-yellow-400 text-[8px] font-mono font-bold px-2 py-0.5 rounded-sm border border-blue-700 uppercase tracking-wider">GLOBAL</span>}
                                                </div>
                                                {/* Hiển thị hình ảnh minh họa nếu câu hỏi có */}
                                                {((q as any).imageUrl || (q as any).image_url || q.image) && (
                                                    <div className="mt-3 mb-2">
                                                        <img 
                                                            src={(q as any).imageUrl || (q as any).image_url || q.image} 
                                                            alt="Hình minh họa câu hỏi" 
                                                            className="max-h-32 max-w-full object-contain rounded-sm border border-slate-300 shadow-sm"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4"><span className={`text-[9px] font-mono font-bold px-2 py-1 rounded-sm uppercase border ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-green-50 text-green-700 border-green-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>{q.type === QuestionType.MULTIPLE_CHOICE ? 'TN' : 'TL'}</span></td>
                                            <td className="p-4 text-xs font-bold text-slate-500">{q.bloomLevel}</td>
                                            <td className="p-4"><div className="flex items-center gap-1 text-[10px] font-mono font-bold text-blue-900 bg-slate-50 px-2 py-1 rounded-sm border border-slate-300 w-fit"><i className="fas fa-folder-open text-[10px]"></i> {q.folder || 'Mặc định'}</div></td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {allowed && (
                                                        <>
                                                            <button onClick={() => setEditingQuestion(q)} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-blue-900 hover:text-white transition-all rounded-sm border border-slate-200"><i className="fas fa-pencil-alt text-xs"></i></button>
                                                            <button 
                                                                onClick={() => deleteQuestion(q.id)} 
                                                                disabled={isDeletingIndividual}
                                                                className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-red-700 hover:text-white transition-all rounded-sm border border-slate-200 disabled:opacity-50"
                                                            >
                                                                {isDeletingIndividual ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-trash-alt text-xs"></i>}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // EXAM LIST VIEW
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {displayExams.length === 0 ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-300 rounded-sm">
                                <i className="fas fa-file-signature text-4xl opacity-50"></i>
                                <p className="font-mono font-bold uppercase tracking-wider text-[10px]">Chưa có đề thi nào trong thư mục này</p>
                            </div>
                        ) : (
                            displayExams.map(exam => {
                                const allowed = canModify(exam.creatorId);
                                const isGlobal = exam.creatorId !== user?.id && user?.role !== 'admin';
                                return (
                                <div key={exam.id} className={`bg-white p-5 rounded-sm border border-slate-300 hover:border-blue-900 transition-all cursor-pointer group flex flex-col h-64 justify-between relative ${selectedExamIds.includes(exam.id) ? 'ring-2 ring-blue-900 bg-blue-50/20' : ''}`}>
                                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedExamIds.includes(exam.id)} 
                                            onChange={() => handleToggleExamSelect(exam.id)} 
                                            disabled={!allowed}
                                            className="w-5 h-5 accent-blue-600 cursor-pointer disabled:opacity-30" 
                                        />
                                    </div>
                                    <div onClick={() => setViewingExam({ ...exam, questionIds: exam.questionIds, config: exam.config, creatorId: exam.creatorId })}>
                                        <div className="flex justify-between mb-4">
                                            <div className={`w-10 h-10 rounded-sm flex items-center justify-center font-bold border ${isGlobal ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-slate-50 text-blue-900 border-slate-300'}`}>
                                                <i className={`fas ${isGlobal ? 'fa-globe' : 'fa-file-alt'}`}></i>
                                            </div>
                                            <span className="text-[8px] font-mono font-bold bg-slate-50 px-2 py-1 rounded-sm text-slate-500 mr-6 border border-slate-200">{exam.questionIds?.length || 0} CÂU</span>
                                        </div>
                                        <h4 className="font-bold text-blue-900 text-sm leading-snug uppercase tracking-wider line-clamp-2 group-hover:text-blue-700 transition-colors">
                                            {exam.title}
                                            {isGlobal && <span className="inline-block ml-1 text-[8px] bg-blue-900 text-yellow-400 font-mono font-bold px-1.5 rounded-sm border border-blue-700 align-middle">GLOBAL</span>}
                                            {!exam.sharedWithClassId && !exam.class_id && <span className="inline-block ml-1 text-[8px] bg-slate-100 text-slate-500 font-mono font-bold px-1.5 py-0.5 rounded-sm border border-slate-300 uppercase align-middle">DRAFT</span>}
                                        </h4>
                                        <div className="mt-2 text-[10px] font-mono font-bold text-blue-900 bg-slate-50 px-2 py-1 inline-block rounded-sm border border-slate-200"><i className="fas fa-folder-open mr-1"></i> {exam.folder || 'Mặc định'}</div>
                                    </div>
                                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                                        <p className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                            {exam.sharedWithClassId ? <i className="fas fa-users text-green-500"></i> : <i className="fas fa-pencil-alt text-orange-400"></i>}
                                            {exam.sharedWithClassId ? 'Đã giao' : 'Bản nháp'}
                                            {!allowed && <span className="ml-auto text-xs text-slate-300"><i className="fas fa-lock"></i></span>}
                                        </p>
                                        {allowed && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openAssignModal(exam); }} 
                                                className="text-blue-900 hover:text-blue-700 transition-colors text-xs opacity-0 group-hover:opacity-100"
                                                title={exam.sharedWithClassId || exam.class_id ? 'Đổi lớp áp dụng' : 'Giao đề cho lớp (Bản nháp)'}
                                            >
                                                <i className="fas fa-chalkboard-user"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )})
                        )}
                    </div>
                )}

                {/* Pagination Controls */}
                <div className="mt-6 flex justify-between items-center bg-white p-4 border border-slate-300 rounded-sm shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Hiển thị {Math.min(ITEMS_PER_PAGE, displayQuestions.length)} / {totalItems} mục
                    </span>
                    <div className="flex gap-2">
                        <button 
                            disabled={currentPage === 1 || loading} 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="w-10 h-10 flex items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-blue-900 hover:bg-blue-900 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <div className="flex items-center px-4 font-black text-blue-900 text-xs">
                            Trang {currentPage} / {Math.ceil(totalItems / ITEMS_PER_PAGE) || 1}
                        </div>
                        <button 
                            disabled={currentPage >= Math.ceil(totalItems / ITEMS_PER_PAGE) || loading} 
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="w-10 h-10 flex items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-blue-900 hover:bg-blue-900 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
             </div>
          </main>
      </div>

      {/* EDIT MODAL (Questions) */}
      {editingQuestion && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-3xl rounded-sm border-2 border-blue-900 p-0 shadow-2xl flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 border-b-2 border-yellow-500 flex justify-between items-center bg-blue-900">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2"><i className="fas fa-edit text-yellow-400"></i> Chỉnh sửa câu hỏi</h3>
                    <button onClick={() => setEditingQuestion(null)} className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-blue-800 text-white"><i className="fas fa-times"></i></button>
                </div>
                
                <form onSubmit={handleUpdateQuestion} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Thư mục / Chủ đề</label>
                        <input list="editFolderList" value={editingQuestion.folder || ''} onChange={e => setEditingQuestion({...editingQuestion, folder: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-sm font-bold text-sm text-slate-700 focus:bg-white focus:border-blue-900 outline-none" placeholder="Chọn hoặc nhập tên thư mục mới..." />
                        <datalist id="editFolderList">{uniqueFolders.filter(f => f !== 'ALL').map(f => <option key={f} value={f} />)}</datalist>
                    </div>
                    {/* Content & Options editing fields... (Kept same as before) */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Nội dung câu hỏi</label>
                        <textarea value={typeof editingQuestion.content === 'string' ? editingQuestion.content : JSON.stringify(editingQuestion.content)} onChange={e => setEditingQuestion({...editingQuestion, content: e.target.value})} className="w-full h-32 p-4 bg-slate-50 border border-slate-300 rounded-sm font-medium text-slate-700 focus:bg-white focus:border-blue-900 outline-none resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Loại câu hỏi</label><select value={editingQuestion.type} onChange={e => setEditingQuestion({...editingQuestion, type: e.target.value as QuestionType})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-sm font-bold text-sm"><option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm</option><option value={QuestionType.ESSAY}>Tự luận</option></select></div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Mức độ Bloom</label><select value={editingQuestion.bloomLevel} onChange={e => setEditingQuestion({...editingQuestion, bloomLevel: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-sm font-bold text-sm">{['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'].map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                    </div>
                    {editingQuestion.type === QuestionType.MULTIPLE_CHOICE ? (
                        <div className="space-y-2 bg-slate-50 p-6 rounded-sm border border-slate-300">
                            <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest block mb-4">Các phương án trả lời (Chọn đáp án đúng)</label>
                            {editingQuestion.options?.map((opt, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 border border-slate-200 bg-white rounded-sm mb-2">
                                    <input 
                                        type="radio" 
                                        name="edit-correct-ans"
                                        checked={editingQuestion.correctAnswer === opt}
                                        onChange={() => setEditingQuestion({...editingQuestion, correctAnswer: opt})}
                                        className="w-4 h-4 text-blue-900 focus:ring-blue-900"
                                        title="Chọn làm đáp án đúng"
                                    />
                                    <input 
                                        type="text" 
                                        value={opt} 
                                        onChange={e => { 
                                            const newOpts = [...(editingQuestion.options || [])]; 
                                            newOpts[i] = e.target.value; 
                                            setEditingQuestion({
                                                ...editingQuestion, 
                                                options: newOpts, 
                                                correctAnswer: editingQuestion.correctAnswer === opt ? e.target.value : editingQuestion.correctAnswer
                                            }); 
                                        }} 
                                        className="w-full border border-slate-300 rounded-sm px-3 py-2 focus:border-blue-900 focus:ring-1 focus:ring-blue-900 outline-none text-sm font-bold text-slate-700" 
                                        placeholder={`Phương án ${String.fromCharCode(65+i)}`} 
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2 bg-purple-50/50 p-6 rounded-sm border border-purple-200">
                            <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Đáp án chuẩn / Gợi ý</label>
                            <textarea value={editingQuestion.correctAnswer} onChange={e => setEditingQuestion({...editingQuestion, correctAnswer: e.target.value})} className="w-full h-24 p-4 bg-white border border-purple-200 rounded-sm font-medium text-slate-700 outline-none focus:border-purple-500" />
                        </div>
                    )}
                </form>

                <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setEditingQuestion(null)} className="px-6 py-3 bg-white border border-slate-300 text-slate-600 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-100">Hủy</button>
                    <button onClick={handleUpdateQuestion} disabled={isSaving} className="px-8 py-3 bg-blue-900 text-white rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-blue-800 border border-blue-800 disabled:opacity-70">{isSaving ? 'Đang lưu...' : 'Cập nhật'}</button>
                </div>
            </div>
        </div>, document.body
      )}

      {/* MOVE MODAL (Questions) */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white p-0 rounded-sm w-[400px] border-2 border-blue-900 overflow-hidden">
                <div className="bg-blue-900 px-5 py-3 border-b-2 border-yellow-500"><h3 className="font-black text-white text-sm uppercase tracking-wider">Chuyển {selectedQuestionIds.length} câu hỏi tới:</h3></div>
                <div className="p-5">
                <input list="folder-options" value={targetMoveFolder} onChange={(e) => setTargetMoveFolder(e.target.value)} placeholder="Chọn hoặc nhập thư mục mới..." className="w-full border border-slate-300 p-3 rounded-sm mb-4 outline-none focus:border-blue-900" />
                <datalist id="folder-options">{uniqueFolders.filter(f => f !== 'ALL').map(f => <option key={f} value={f} />)}</datalist>
                <div className="flex gap-2 justify-end">
                    <button onClick={() => setIsMoveModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 font-bold text-[10px] uppercase tracking-wider rounded-sm">Hủy</button>
                    <button onClick={handleBulkMove} disabled={isMovingBulk} className="px-4 py-2 bg-blue-900 text-white font-bold text-[10px] uppercase tracking-wider rounded-sm">Xác nhận</button>
                </div>
            </div>
            </div>
        </div>
      )}

      {/* MOVE MODAL (Exams) */}
      {isExamMoveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white p-0 rounded-sm w-[400px] border-2 border-blue-900 overflow-hidden">
                <div className="bg-blue-900 px-5 py-3 border-b-2 border-yellow-500"><h3 className="font-black text-white text-sm uppercase tracking-wider">Chuyển {selectedExamIds.length} đề thi tới:</h3></div>
                <div className="p-5">
                <input list="exam-folder-options" value={examTargetMoveFolder} onChange={(e) => setExamTargetMoveFolder(e.target.value)} placeholder="Chọn hoặc nhập thư mục mới..." className="w-full border border-slate-300 p-3 rounded-sm mb-4 outline-none focus:border-blue-900" />
                <datalist id="exam-folder-options">{uniqueExamFolders.filter(f => f !== 'ALL').map(f => <option key={f} value={f} />)}</datalist>
                <div className="flex gap-2 justify-end">
                    <button onClick={() => setIsExamMoveModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 font-bold text-[10px] uppercase tracking-wider rounded-sm">Hủy</button>
                    <button onClick={handleExamBulkMove} disabled={isMovingExamBulk} className="px-4 py-2 bg-blue-900 text-white font-bold text-[10px] uppercase tracking-wider rounded-sm">Xác nhận</button>
                </div>
            </div>
            </div>
        </div>
      )}

      {/* ASSIGN EXAM TO CLASS MODAL */}
      {isAssignModalOpen && examToAssign && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-sm w-[400px] border-2 border-blue-900 overflow-hidden">
                  <div className="bg-blue-900 px-5 py-3 border-b-2 border-yellow-500">
                      <h3 className="font-black text-white text-sm uppercase tracking-wider">Giao Đề Thi Cho Lớp</h3>
                      <p className="text-[10px] font-mono text-blue-300 truncate mt-0.5">{examToAssign.title}</p>
                  </div>
                  <div className="p-5">
                  <div className="mb-5">
                      <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-2">Chọn lớp áp dụng</label>
                      <select 
                          value={selectedClassToAssign} 
                          onChange={(e) => setSelectedClassToAssign(e.target.value)}
                          className="w-full border border-slate-300 p-3 rounded-sm outline-none focus:border-blue-900 font-medium text-slate-700"
                      >
                          <option value="">-- Thu hồi về Bản nháp --</option>
                          {availableClasses.map((cls: any) => (
                              <option key={`assign-cls-${cls.id}`} value={cls.id}>
                                  {cls.name}
                              </option>
                          ))}
                      </select>
                  </div>

                  <div className="flex gap-2 justify-end">
                      <button onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-sm">Hủy</button>
                      <button onClick={handleAssignSubmit} disabled={isAssigning} className="px-4 py-2 bg-blue-900 text-white font-bold text-[10px] uppercase tracking-wider rounded-sm flex items-center gap-2">
                          {isAssigning ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                          Xác nhận
                      </button>
                  </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default QuestionBankManager;