import React, { useState, useEffect } from 'react';
import { Question, QuestionFolder } from '../../types';
import AIGeneratorTab from './AIGeneratorTab';
import ManualCreatorTab from './ManualCreatorTab';
import ReviewList from './ReviewList';
import { Link } from 'react-router-dom';
import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../../lib/appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databaseService, fetchCustomFolders } from '../../services/databaseService';

interface QuestionGeneratorProps {
  folders: QuestionFolder[];
  onSaveQuestions: (questions: Question[]) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type TabMode = 'AI' | 'MANUAL';

const QuestionGenerator: React.FC<QuestionGeneratorProps> = ({ folders, onSaveQuestions, onNotify }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabMode>('AI');
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('default');
  
  // State to hold unique folder names fetched from DB
  const [availableFolders, setAvailableFolders] = useState<string[]>(['Mặc định']);
  // State cho danh sách thư mục đề thi từ Ngân hàng câu hỏi thi
  const [examFolders, setExamFolders] = useState<string[]>([]);

  // Tải danh sách thư mục câu hỏi + thư mục đề thi từ DB
  useEffect(() => {
      const loadAllFolders = async () => {
          if (!user?.id) return;
          try {
              const [metadata, qFolders, eFolders, examsRes] = await Promise.all([
                  databaseService.fetchQuestionMetadataForMatrix().catch(() => [] as any[]),
                  fetchCustomFolders('question').catch(() => [] as string[]),
                  fetchCustomFolders('exam').catch(() => [] as string[]),
                  databases.listDocuments(
                      APPWRITE_CONFIG.dbId,
                      APPWRITE_CONFIG.collections.exams,
                      [Query.limit(500)]
                  ).catch(() => ({ documents: [] }))
              ]);

              // 1. Thư mục câu hỏi: custom question folders + từ metadata questions
              const questionFolderSet = new Set<string>(['Mặc định', ...qFolders]);
              metadata.forEach((m: any) => { if (m.folder) questionFolderSet.add(m.folder); });
              setAvailableFolders(Array.from(questionFolderSet).sort());

              // 2. Thư mục đề thi: custom exam folders + từ config các đề thi đã tồn tại
              const examFolderSet = new Set<string>(['Mặc định', ...eFolders]);
              (examsRes as any).documents.forEach((doc: any) => {
                  try {
                      const config = typeof doc.config === 'string'
                          ? JSON.parse(doc.config)
                          : (doc.config || {});
                      if (config?.folder) examFolderSet.add(config.folder);
                  } catch (_) {}
              });
              setExamFolders(Array.from(examFolderSet).sort());
          } catch (e) {
              console.warn("Failed to fetch existing folders", e);
          }
      };
      loadAllFolders();
  }, [user]);

  const handleQuestionsGenerated = (questions: Question[]) => {
    setPendingQuestions(questions);
    setIsPreviewMode(true);
  };

  const handleSingleQuestionCreated = (question: Question) => {
    setPendingQuestions(prev => [...prev, question]);
    setIsPreviewMode(true);
  };

  const handleUpdatePending = (index: number, updated: Question) => {
    const newList = [...pendingQuestions];
    newList[index] = updated;
    setPendingQuestions(newList);
  };

  const handleRemovePending = (index: number) => {
    const newList = pendingQuestions.filter((_, i) => i !== index);
    setPendingQuestions(newList);
    if (newList.length === 0) setIsPreviewMode(false);
  };

  const handleSaveFinal = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        // --- IMAGE UPLOAD LOGIC ---
        // Iterate through questions and upload images if imageFile is present
        const processedQuestions = await Promise.all(pendingQuestions.map(async (q) => {
            let finalImageUrl = q.image; // Keep existing image if no new file

            if (q.imageFile) {
                try {
                    // 1. Upload to Storage (Using 'lectures' bucket to reuse logic)
                    const uploadRes = await storage.createFile(
                        APPWRITE_CONFIG.buckets.lectures, 
                        ID.unique(), 
                        q.imageFile
                    );
                    // 2. Get Public View URL
                    const fileUrl = storage.getFileView(APPWRITE_CONFIG.buckets.lectures, uploadRes.$id);
                    finalImageUrl = fileUrl;
                } catch (error) {
                    console.error("Lỗi upload ảnh cho câu hỏi:", error);
                    onNotify(`Lỗi upload ảnh cho câu: "${q.content.substring(0, 20)}..."`, "warning");
                }
            }

            // Cleanup temp fields (imageFile, previewUrl) and update image URL
            const { imageFile, previewUrl, ...cleanQ } = q;
            return { ...cleanQ, image: finalImageUrl };
        }));

        // --- SAVE TO DB ---
        // --- CHANGED: Pass user role ---
        await databaseService.bulkInsertQuestions(processedQuestions, user.id, user.role);

        onSaveQuestions(processedQuestions);
        setPendingQuestions([]);
        setIsPreviewMode(false);
        onNotify(`Đã lưu ${processedQuestions.length} câu hỏi mới vào Ngân hàng dữ liệu Cloud.`, "success");
    } catch (err: any) {
        onNotify(`Lỗi lưu trữ: ${err.message}`, "error");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-300 max-w-[1600px] mx-auto flex h-[calc(100vh-140px)] overflow-hidden rounded-sm shadow-none">
      <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0 p-6">
        <div className="mb-8 p-4 border-b border-white/10">
            <h2 className="text-xl font-black text-white uppercase tracking-widest leading-none">Studio</h2>
            <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-[0.3em] mt-2">Command Center</p>
        </div>

        <nav className="flex-1 space-y-3">
            <button 
              onClick={() => setActiveTab('AI')} 
              className={`w-full text-left px-5 py-4 border rounded-sm font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'AI' ? 'bg-yellow-500 text-blue-900 border-yellow-500' : 'bg-transparent text-slate-400 border-white/10 hover:bg-white/5'}`}
            >
              <i className="fas fa-wand-magic-sparkles"></i> AI Tự động
            </button>
            <button 
              onClick={() => setActiveTab('MANUAL')} 
              className={`w-full text-left px-5 py-4 border rounded-sm font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'MANUAL' ? 'bg-yellow-500 text-blue-900 border-yellow-500' : 'bg-transparent text-slate-400 border-white/10 hover:bg-white/5'}`}
            >
              <i className="fas fa-keyboard"></i> Nhập thủ công
            </button>
        </nav>

        <div className="bg-white/5 p-4 border border-white/10 mt-auto rounded-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Hệ thống</p>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-tight">
                <div className={`w-2 h-2 rounded-sm ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                {isLoading ? 'Processing...' : 'Ready'}
            </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <div className="flex-1 overflow-hidden">
            {activeTab === 'AI' ? (
                <AIGeneratorTab 
                    folders={folders} 
                    availableFolders={availableFolders}
                    examFolders={examFolders}
                    onQuestionsGenerated={handleQuestionsGenerated} 
                    onNotify={onNotify} 
                    isLoading={isLoading} 
                    setIsLoading={setIsLoading} 
                    pendingQuestions={pendingQuestions}
                    onUpdateQuestion={handleUpdatePending}
                    onRemoveQuestion={handleRemovePending}
                    onApproveAll={handleSaveFinal}
                />
            ) : (
                <ManualCreatorTab 
                    folders={folders} 
                    availableFolders={availableFolders}
                    examFolders={examFolders}
                    onQuestionCreated={handleSingleQuestionCreated} 
                    onQuestionsGenerated={handleQuestionsGenerated} 
                    onNotify={onNotify} 
                    isLoading={isLoading} 
                    setIsLoading={setIsLoading} 
                    pendingQuestions={pendingQuestions}
                    onUpdateQuestion={handleUpdatePending}
                    onRemoveQuestion={handleRemovePending}
                    onApproveAll={handleSaveFinal}
                />
            )}
        </div>
      </div>
    </div>
  );
};

export default QuestionGenerator;