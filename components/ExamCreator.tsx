
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Question, QuestionType, Exam } from '../types';
import { formatContent } from '../utils/textFormatter';
import { databases, APPWRITE_CONFIG, Query } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import { exportExamToPdf } from '../services/pdfExportService';
import { generateExamPaper, shuffleArray, AnswerEntry } from '../utils/examEngine';
import { databaseService, fetchCustomFolders } from '../services/databaseService';

interface ExamConfig {
  organizationName: string; 
  schoolName: string;       
  school: string;
  department: string;
  subject: string;          
  moduleTerm: string;       
  examName: string;
  examCode: string;
  time: string;
  semester: string;
  year: string;
  organizer: string;
  assignedClassId?: string; 
}

interface ExamCreatorProps {
  viewExam?: Exam; 
  editExam?: Exam;
  onBack: () => void;
  onSaveExam?: (exam: Exam) => void;
  readOnly?: boolean; 
}

const BLOOM_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];

const normalizeBloomLevel = (level: string): string => {
    if (!level) return 'Nhận biết';
    const l = level.trim().toLowerCase().normalize('NFC');
    
    // Mapping English to Vietnamese
    if (l.includes('remember') || l.includes('knowledge') || l === 'nhận biết') return 'Nhận biết';
    if (l.includes('understand') || l.includes('comprehension') || l === 'thông hiểu') return 'Thông hiểu';
    if (l.includes('apply') || l.includes('application') || l === 'vận dụng') return 'Vận dụng';
    if (l.includes('analy') || l.includes('phân tích')) return 'Phân tích';
    if (l.includes('evaluat') || l.includes('đánh giá')) return 'Đánh giá';
    if (l.includes('creat') || l.includes('synthesis') || l === 'sáng tạo') return 'Sáng tạo';
    
    return level; // Fallback
};

const ExamCreator: React.FC<ExamCreatorProps> = ({ viewExam, editExam, onBack, onSaveExam, readOnly = false }) => {
  const currentExam = useMemo(() => editExam || viewExam, [editExam, viewExam]);
  const isEditMode = !!editExam;

  const { user } = useAuth();
  const [step, setStep] = useState<'MATRIX' | 'PREVIEW'>(currentExam ? 'PREVIEW' : 'MATRIX');
  const [matrixCounts, setMatrixCounts] = useState<Record<string, number>>({
    'Nhận biết': 0, 'Thông hiểu': 0, 'Vận dụng': 0, 'Phân tích': 0, 'Đánh giá': 0, 'Sáng tạo': 0
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  // Metadata nhẹ chỉ chứa ID và mức độ Bloom
  const [metadataQuestions, setMetadataQuestions] = useState<any[]>([]);
  // Dữ liệu đầy đủ cho Preview
  const [selectedQuestionsFullData, setSelectedQuestionsFullData] = useState<Question[]>([]);

  const [classes, setClasses] = useState<any[]>([]);
  const [examType, setExamType] = useState<'Trắc nghiệm' | 'Tự luận' | 'Hỗn hợp'>('Trắc nghiệm');
  const [sourceQuestionFolder, setSourceQuestionFolder] = useState<string>('Tất cả');
  
  // Use state for dynamic subject/module to avoid hardcoding
  const [subjectName, setSubjectName] = useState<string>(currentExam?.subject_name || 'ĐIỆN TỬ SỐ VÀ KỸ THUẬT VI XỬ LÝ');
  const [moduleName, setModuleName] = useState<string>(currentExam?.module_name || '');
  const [targetExamFolder, setTargetExamFolder] = useState<string>(currentExam?.folder || 'Mặc định');
  const [examFolders, setExamFolders] = useState<string[]>([]);
  const [examPurpose, setExamPurpose] = useState<'online_test' | 'self_study' | 'both'>((currentExam?.exam_purpose as any) || 'both');
  const [duration, setDuration] = useState<number>(currentExam?.duration || 15);

  const [customFolders, setCustomFolders] = useState<string[]>([]);

  useEffect(() => {
      const loadAllFolders = async () => {
          try {
              const [qFolders, eFolders] = await Promise.all([
                  fetchCustomFolders('question'),
                  fetchCustomFolders('exam')
              ]);
              setCustomFolders(qFolders);
              setExamFolders(eFolders);
          } catch (err) {
              console.error("Lỗi tải danh sách thư mục:", err);
          }
      };
      loadAllFolders();
  }, []);

  // Fetch Metadata cho matrix
  useEffect(() => {
    const loadMetadata = async () => {
        setIsMatrixLoading(true);
        try {
            const data = await databaseService.fetchQuestionMetadataForMatrix(sourceQuestionFolder);
            setMetadataQuestions(data);
        } catch (err) {
            console.error("Lỗi tải metadata:", err);
        } finally {
            setIsMatrixLoading(false);
        }
    };
    loadMetadata();
  }, [sourceQuestionFolder]);

  // Tự động trích xuất thư mục từ dữ liệu metadata đã tải
  const questionFolders = useMemo(() => {
    // Lấy thư mục từ câu hỏi thật
    const fromQuestions = metadataQuestions.map(q => q.folder || 'Mặc định');
    // Gộp với danh sách thư mục tùy chỉnh
    const combined = new Set([...fromQuestions, ...customFolders, 'Mặc định']);
    return Array.from(combined).sort();
  }, [metadataQuestions, customFolders]);

  const filteredMetadata = useMemo(() => {
    return metadataQuestions; 
  }, [metadataQuestions]);

  useEffect(() => {
    if (user?.role === 'teacher' || user?.role === 'admin') {
        const fetchClasses = async () => {
            try {
                const classQueries = user?.role === 'admin' ? [] : [Query.equal('teacher_id', [user.id])];
                classQueries.push(Query.limit(500));
                const response = await databases.listDocuments(
                    APPWRITE_CONFIG.dbId,
                    APPWRITE_CONFIG.collections.classes,
                    classQueries
                );
                setClasses(response.documents.map((d: any) => ({ id: d.$id, name: d.name })));
            } catch (err) {
                console.error("Error fetching classes:", err);
            }
        };
        fetchClasses();
    }
  }, [user]);

    const initialExamCode = useMemo(() => Math.floor(100 + Math.random() * 900).toString(), []);

    const [examConfig, setExamConfig] = useState<ExamConfig>(currentExam?.config || {
    organizationName: 'TRƯỜNG SĨ QUAN THÔNG TIN',
    schoolName: 'TIỂU ĐOÀN 30',
    school: 'TIỂU ĐOÀN 30',
    department: 'ĐƠN VỊ..',
    subject: '',          
    moduleTerm: '',       
    examName: 'BÀI KIỂM TRA ĐỊNH KỲ',
    examCode: initialExamCode,
    time: '60',
    semester: 'Học kỳ II',
    year: '2025 - 2026',
    organizer: 'TRƯỜNG SĨ QUAN THÔNG TIN',
    assignedClassId: ''
    });

  const [currentQuestionIds, setCurrentQuestionIds] = useState<string[]>(currentExam?.questionIds || []);
  const [answerData, setAnswerData] = useState<Record<number, AnswerEntry>>({});
  const [previewTab, setPreviewTab] = useState<'EXAM' | 'ANSWERS'>('EXAM');

  // Load full data for existing exam
  useEffect(() => {
    if (viewExam && viewExam.questionIds?.length > 0) {
        const loadFull = async () => {
             const full = await databaseService.fetchQuestionsByCriteria(viewExam.questionIds);
             setSelectedQuestionsFullData(full);
        };
        loadFull();
    }
  }, [viewExam]);

  const selectedQuestions = selectedQuestionsFullData;

  const handleGenerateExam = async () => {
    if (isGenerating) return; // Bảo vệ chống double-click

    const newSelectedIds: string[] = [];
    const errors: string[] = [];

    BLOOM_LEVELS.forEach(level => {
      const countRequested = matrixCounts[level];
      if (countRequested <= 0) return;

      const availableInLevel = filteredMetadata.filter(q => {
        const matchFolder = sourceQuestionFolder === 'Tất cả' || 
                           q.folder === sourceQuestionFolder || 
                           q.folder?.$id === sourceQuestionFolder || 
                           q.folderId === sourceQuestionFolder;
        
        const matchBloom = normalizeBloomLevel(q.bloomLevel) === normalizeBloomLevel(level);
        
        return matchFolder && matchBloom;
      });
      if (availableInLevel.length < countRequested) {
        errors.push(`Mức độ "${level}" chỉ có ${availableInLevel.length} câu trong kho (yêu cầu ${countRequested})`);
      } else {
        const shuffled = shuffleArray(availableInLevel);
        newSelectedIds.push(...shuffled.slice(0, countRequested).map(q => q.id));
      }
    });

    if (errors.length > 0) {
      alert("Không đủ câu hỏi trong kho:\n" + errors.join("\n"));
      return;
    }

    if (newSelectedIds.length === 0) {
      alert("Vui lòng nhập số lượng câu hỏi vào ma trận.");
      return;
    }

    setIsGenerating(true);
    try {
        const finalIds = shuffleArray(newSelectedIds);
        setCurrentQuestionIds(finalIds); 

        // FETCH FULL DATA CHUYÊN BIỆT TẠI ĐÂY
        const fullData = await databaseService.fetchQuestionsByCriteria(finalIds);
        // Deep copy tuyệt đối để tách biệt khỏi state/cache gốc
        const deepCopiedData = fullData.map(q => JSON.parse(JSON.stringify(q)));
        setSelectedQuestionsFullData(deepCopiedData);

        const { answerData: data } = generateExamPaper(deepCopiedData, deepCopiedData.length, examConfig.examCode);
        setAnswerData(data);
        setStep('PREVIEW');
    } catch (err) {
        alert("Lỗi khi tải dữ liệu câu hỏi chi tiết.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handlePrint = () => {
      // 1. Generate Exam Paper Structure (Randomize Options, Create Key)
      const { examQuestions, answerData: printData } = generateExamPaper(
          selectedQuestions, 
          selectedQuestions.length, 
          examConfig.examCode
      );

      // 2. Prepare Info Object
      const info = {
          organizationName: examConfig.organizationName,
          schoolName: examConfig.schoolName,
          examName: examConfig.examName,
          examCode: examConfig.examCode,
          time: examConfig.time,
          subjectName: subjectName || examConfig.subject || "Môn học",
          moduleName: moduleName || examConfig.moduleTerm || "",
      };

      // 3. Clean options for PDF Service (Remove A. B. C. as service adds them)
      const cleanQuestionsForPdf = examQuestions.map(q => ({
          ...q,
          options: q.options?.map(opt => opt.replace(/^[A-Z][\.\:\)]\s*/, ''))
      }));

      // 4. Convert answerData to simple answerKey for PDF service
      const answerKeyForPdf: Record<number, string> = {};
      Object.entries(printData).forEach(([k, v]) => { answerKeyForPdf[Number(k)] = v.correctLetter; });

      // 5. Call Service
      exportExamToPdf(info, cleanQuestionsForPdf, answerKeyForPdf, examConfig.examCode);
  };

  const handleSave = async () => {
    const examDataToSave: any = {
      title: examConfig.examName,
      question_ids: currentQuestionIds,
      duration: duration,
      exam_purpose: examPurpose,
      folder: targetExamFolder,
      subject_name: subjectName.trim(),
      module_name: moduleName.trim(),
      config: {
          ...examConfig,
          subject: subjectName.trim(), 
          moduleTerm: moduleName.trim(),
          exam_purpose: examPurpose,
          class_id: examConfig.assignedClassId || null,
          max_attempts: isEditMode ? (currentExam?.config?.max_attempts || 1) : 1
      },
      class_id: examConfig.assignedClassId || null,
    };

    try {
      if (isEditMode && editExam?.id) {
          await databaseService.updateExam(editExam.id, examDataToSave);
          alert("Cập nhật đề thi thành công!");
          onBack(); 
      } else {
          if (!onSaveExam) return;
          const newExam: Exam = {
            id: Date.now().toString(),
            title: examConfig.examName,
            type: 'REGULAR',
            questionIds: currentQuestionIds,
            createdAt: Date.now(),
            config: {
                ...examDataToSave.config,
                status: 'draft',
            },
            sharedWithClassId: examConfig.assignedClassId,
            exam_type: examType,
            duration: duration,
            class_id: examConfig.assignedClassId || null,
            subject_name: subjectName.trim(),
            module_name: moduleName.trim(),
            folder: targetExamFolder,
            exam_purpose: examPurpose,
          } as Exam;
          onSaveExam(newExam);
      }
    } catch (err: any) {
        alert("Lỗi khi lưu đề thi: " + err.message);
    }
  };

  const handleRepairLabels = async () => {
    if (!window.confirm("Hệ thống sẽ quét toàn bộ câu hỏi và tự động chuyển các nhãn tiếng Anh (Applying, Remembering...) sang tiếng Việt. Bạn có muốn tiếp tục?")) return;
    
    setIsRepairing(true);
    try {
        const count = await databaseService.repairBloomLevels();
        alert(`Đã sửa thành công ${count} câu hỏi! Hệ thống sẽ tải lại dữ liệu.`);
        // Reload metadata to reflect changes
        const data = await databaseService.fetchQuestionMetadataForMatrix(sourceQuestionFolder);
        setMetadataQuestions(data);
    } catch (err: any) {
        alert("Lỗi khi sửa nhãn: " + err.message);
    } finally {
        setIsRepairing(false);
    }
  };

  const totalQuestionsRequested = Object.values(matrixCounts).reduce((a, b) => a + b, 0);

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-50 flex flex-col font-inter animate-fade-in overflow-hidden">
      <header className="h-20 bg-white border-b border-slate-200 px-10 flex items-center justify-between shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-sm bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95"
          >
            <i className="fas fa-times"></i>
          </button>
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <div>
            <h2 className="font-black text-slate-900 tracking-tight leading-none">
                {readOnly ? 'Xem chi tiết đề thi (Chỉ đọc)' : (viewExam ? 'Chi tiết đề thi' : 'Công cụ soạn thảo đề thi')}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {step === 'MATRIX' ? 'Thiết lập ma trận câu hỏi' : 'Trình xem trước & Xuất bản A4'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {step === 'MATRIX' ? (
            <button 
                onClick={handleGenerateExam}
                disabled={isGenerating || isMatrixLoading}
                className="px-8 py-3 bg-blue-900 text-white rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
            >
                {isGenerating ? 'Đang chuẩn bị...' : 'Sinh đề ngẫu nhiên'} <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} ml-2`}></i>
            </button>
          ) : (
            <>
              {!viewExam && !readOnly && (
                <button 
                    onClick={() => setStep('MATRIX')}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-300"
                >
                    Đổi ma trận
                </button>
              )}
              <button 
                onClick={handlePrint}
                className="px-6 py-3 bg-slate-900 text-white rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-blue-900 transition-all"
              >
                In Đề Thi (A4)
              </button>
              {!viewExam && !readOnly && (
                <button 
                    onClick={handleSave}
                    className="px-8 py-3 bg-blue-900 text-white rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                    Lưu vào Ngân hàng <i className="fas fa-save ml-2"></i>
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-50">
        {step === 'MATRIX' ? (
          <div className="max-w-4xl mx-auto space-y-10 animate-fade-in-up">
            <div className="bg-white p-12 rounded-sm border border-slate-300 space-y-10">
                <div className="space-y-6">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter border-b border-slate-200 pb-4">1. Thông tin đơn vị & Định danh đề thi</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên cơ quan/Bộ chủ quản</label>
                            <input type="text" disabled={readOnly} value={examConfig.organizationName} onChange={e => setExamConfig({...examConfig, organizationName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500" placeholder="Ví dụ: BỘ GIÁO DỤC VÀ ĐÀO TẠO"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên trường/Đơn vị</label>
                            <input type="text" disabled={readOnly} value={examConfig.schoolName} onChange={e => setExamConfig({...examConfig, schoolName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500" placeholder="Ví dụ: TRƯỜNG ĐẠI HỌC KINH TẾ"/>
                        </div>
                    </div>
                    
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên bài thi</label>
                            <input type="text" disabled={readOnly} value={examConfig.examName} onChange={e => setExamConfig({...examConfig, examName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã đề</label>
                            <input type="text" disabled={readOnly} value={examConfig.examCode} onChange={e => setExamConfig({...examConfig, examCode: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TG Làm bài (P)</label>
                            <input type="number" disabled={readOnly} value={examConfig.time} onChange={e => setExamConfig({...examConfig, time: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-blue-600 uppercase mb-2">Tên môn học</label>
                            <input 
                                type="text"
                                disabled={readOnly}
                                value={subjectName} 
                                onChange={(e) => setSubjectName(e.target.value)}
                                placeholder="VD: Nghiệp vụ viễn thông..."
                                className="w-full border border-slate-300 p-3 rounded-sm outline-none focus:border-blue-900 font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-600 uppercase mb-2">Học phần</label>
                            <input 
                                type="text"
                                disabled={readOnly}
                                value={moduleName} 
                                onChange={(e) => setModuleName(e.target.value)}
                                placeholder="VD: Lý thuyết cơ sở..."
                                className="w-full border border-slate-300 p-3 rounded-sm outline-none focus:border-blue-900 font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-600 uppercase mb-2">Thời gian làm bài (Phút)</label>
                            <input 
                                type="number"
                                disabled={readOnly}
                                min={1}
                                value={duration} 
                                onChange={(e) => setDuration(Number(e.target.value))}
                                className="w-full border border-slate-300 px-3 py-2 rounded-sm outline-none focus:border-blue-900 font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500"
                            />
                        </div>
                    </div>

                    <div className="p-8 bg-slate-50 rounded-sm border border-slate-300 space-y-6">
                        <div className="flex items-center gap-3">
                            <i className="fas fa-cogs text-blue-900"></i>
                            <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em]">Cấu hình nâng cao</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Loại đề thi</label>
                                <select 
                                    disabled={readOnly}
                                    value={examType} 
                                    onChange={e => setExamType(e.target.value as any)}
                                    className="w-full p-4 bg-white border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                    <option value="Trắc nghiệm">Trắc nghiệm</option>
                                    <option value="Tự luận">Tự luận</option>
                                    <option value="Hỗn hợp">Hỗn hợp</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lấy câu hỏi từ thư mục</label>
                                <select 
                                    disabled={readOnly}
                                    value={sourceQuestionFolder} 
                                    onChange={e => setSourceQuestionFolder(e.target.value)}
                                    className="w-full p-4 bg-white border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                    <option value="Tất cả">Tất cả thư mục</option>
                                    {questionFolders.filter(f => f !== 'Tất cả').map(folder => (
                                        <option key={`src-folder-${folder}`} value={folder}>
                                            {folder}
                                        </option>
                                    ))}
                                </select>
                                <button 
                                    onClick={handleRepairLabels}
                                    disabled={isRepairing}
                                    className="mt-2 text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-all flex items-center gap-1"
                                    title="Sửa lỗi nhãn AI bằng tiếng Anh (Applying, Remembering...)"
                                >
                                    {isRepairing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>} Sửa lỗi nhãn AI (English tags)
                                </button>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <i className="fas fa-folder-open mr-1"></i> Lưu đề vào thư mục
                                </label>
                                <select 
                                    disabled={readOnly}
                                    value={targetExamFolder} 
                                    onChange={e => setTargetExamFolder(e.target.value)}
                                    className="w-full p-4 bg-white border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                    <option value="Mặc định">Mặc định</option>
                                    {examFolders.filter(f => f !== 'Mặc định' && f !== 'Tất cả').map((folder, idx) => (
                                        <option key={`target-exam-folder-${idx}`} value={folder}>{folder}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mục đích sử dụng</label>
                                <select
                                    disabled={readOnly}
                                    value={examPurpose}
                                    onChange={e => setExamPurpose(e.target.value as any)}
                                    className="w-full p-4 bg-white border border-slate-300 rounded-sm font-bold text-sm outline-none focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                    <option value="both">Dùng cho cả Thi và Ôn tập</option>
                                    <option value="online_test">Chỉ dùng Kiểm tra Online</option>
                                    <option value="self_study">Chỉ dùng Ôn tập tự học</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">2. Ma trận mức độ Bloom</h3>
                        <div className="bg-blue-50 text-blue-900 border border-blue-200 px-4 py-2 rounded-sm text-xs font-black uppercase">
                            Tổng cộng: {totalQuestionsRequested} Câu
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                         {BLOOM_LEVELS.map(level => {
                            const available = filteredMetadata.filter(q => {
                                const matchFolder = sourceQuestionFolder === 'Tất cả' || 
                                                   q.folder === sourceQuestionFolder || 
                                                   q.folder?.$id === sourceQuestionFolder || 
                                                   q.description?.includes(sourceQuestionFolder) ||
                                q.folderId === sourceQuestionFolder;
                                const matchBloom = normalizeBloomLevel(q.bloomLevel) === normalizeBloomLevel(level);
                                return matchFolder && matchBloom;
                            }).length;
                            return (
                                <div key={level} className={`p-6 rounded-sm border transition-all ${matrixCounts[level] > 0 ? 'bg-blue-50 border-blue-900' : 'bg-slate-50 border-slate-300 opacity-60'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{level}</label>
                                        <span className="text-[9px] font-bold text-slate-400">
                                            {isMatrixLoading ? <i className="fas fa-spinner fa-spin"></i> : `Kho: ${available}`}
                                        </span>
                                    </div>
                                    <input 
                                        type="number" 
                                        disabled={readOnly || isMatrixLoading}
                                        min="0"
                                        max={available}
                                        value={matrixCounts[level]}
                                        onChange={e => setMatrixCounts({...matrixCounts, [level]: parseInt(e.target.value) || 0})}
                                        className="w-full bg-white border border-slate-300 rounded-sm p-3 font-black text-xl text-blue-900 outline-none text-center focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="max-w-[210mm] mx-auto mb-20 animate-fade-in-up">
            {/* Tab Buttons */}
            <div className="flex gap-2 mb-6 border-b-2 border-slate-100 pb-2">
                <button 
                    onClick={() => setPreviewTab('EXAM')} 
                    className={`px-6 py-2 font-bold text-xs uppercase tracking-widest rounded-sm transition-all border ${previewTab === 'EXAM' ? 'bg-blue-900 text-white border-blue-900' : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'}`}
                    title="Xem nội dung đề thi"
                >
                    <i className="fas fa-file-lines mr-2"></i> Nội dung Đề thi
                </button>
                <button 
                    onClick={() => setPreviewTab('ANSWERS')} 
                    className={`px-6 py-2 font-bold text-xs uppercase tracking-widest rounded-sm transition-all border ${previewTab === 'ANSWERS' ? 'bg-blue-900 text-white border-blue-900' : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'}`}
                    title="Xem đáp án và giải thích"
                >
                    <i className="fas fa-key mr-2"></i> Đáp án & Giải thích
                </button>
            </div>

            {/* ===== TAB: ĐỀ THI ===== */}
            {previewTab === 'EXAM' && (
              <div 
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
                className="bg-white p-[20mm] text-black shadow-[0_20px_80px_rgba(0,0,0,0.1)]"
              >
                 <div className="flex justify-between items-start mb-6 w-full">
                    <div className="text-center w-[40%] flex flex-col">
                       <h4 className="text-[11px] uppercase leading-tight">{examConfig.organizationName}</h4>
                       <h4 className="text-[12px] font-bold uppercase leading-tight mt-1">{examConfig.schoolName}</h4>
                       <div className="w-[30%] h-[1px] bg-black mx-auto my-1"></div>
                       <div className="text-left mt-6 pl-4 space-y-1">
                          <p className="text-[11px] italic font-medium">Họ và tên: ......................................................</p>
                          <p className="text-[11px] italic font-medium">Số báo danh: ...................................................</p>
                       </div>
                    </div>
                    <div className="text-center w-[50%] flex flex-col">
                       <h4 className="text-[11px] font-bold uppercase leading-tight tracking-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                       <h4 className="text-[12px] font-bold leading-tight mt-1">Độc lập - Tự do - Hạnh phúc</h4>
                       <div className="w-[40%] h-[1px] bg-black mx-auto my-1"></div>
                    </div>
                 </div>

                 <div className="text-center mb-8 w-full border-t border-black/5 pt-4">
                    <h2 className="text-[18px] font-bold uppercase leading-tight mb-1">{examConfig.examName}</h2>
                    <h3 className="text-[14px] font-bold uppercase leading-tight">
                       Môn: {subjectName || 'Tên môn học'} 
                       {moduleName && <span className="ml-2 font-medium normal-case">({moduleName})</span>}
                    </h3>
                    <p className="text-[12px] italic mt-1">(Thời gian làm bài: {examConfig.time} phút, không kể thời gian giao đề)</p>
                    <div className="border border-black px-4 py-1 inline-block mt-4 font-bold text-[13px] tracking-widest">
                       MÃ ĐỀ THI: {examConfig.examCode}
                    </div>
                 </div>

                 <div className="space-y-8">
                    <p className="text-[12px] italic pb-2 mb-4 text-center border-b border-dashed border-black/10">(Học sinh/Sinh viên không được sử dụng tài liệu trừ phụ lục quy định)</p>
                    
                    {selectedQuestions.map((q, idx) => (
                       <div key={q.id} className="text-[14px] leading-relaxed break-inside-avoid mb-6">
                          <div className="flex gap-2 font-bold mb-3 items-start">
                             <span className="shrink-0">Câu {idx + 1}:</span>
                             <div className="flex-1">{formatContent(q.content)}</div>
                          </div>
                          
                          {q.image && (
                            <div className="my-6 flex justify-center">
                                <img src={q.image} className="max-h-[70mm] max-w-full object-contain border border-black/5 rounded-sm" alt="Hình minh họa" />
                            </div>
                          )}
                          
                          {q.type === QuestionType.MULTIPLE_CHOICE && q.options && (
                             <div className="grid grid-cols-2 gap-x-12 gap-y-3 mt-3 ml-8">
                                {q.options.map((opt, i) => (
                                   <div key={i} className="flex gap-2 items-start">
                                      <span className="font-bold">{String.fromCharCode(65 + i)}.</span>
                                      <div className="flex-1">{formatContent(opt)}</div>
                                   </div>
                                ))}
                             </div>
                          )}

                          {q.type === QuestionType.ESSAY && (
                             <div className="mt-4 border-b border-dashed border-gray-100 h-2"></div>
                          )}
                       </div>
                    ))}
                 </div>

                 <div className="text-center mt-16 mb-16 italic text-[14px] font-bold tracking-[0.5em]">--- HẾT ---</div>
              </div>
            )}

            {/* ===== TAB: ĐÁP ÁN & GIẢI THÍCH ===== */}
            {previewTab === 'ANSWERS' && (
              <div className="space-y-4">
                  <h2 className="text-xl font-black text-center mb-6 text-red-600">
                      <i className="fas fa-key mr-2"></i>BẢNG ĐÁP ÁN & GIẢI THÍCH CHI TIẾT - MÃ ĐỀ: {examConfig.examCode}
                  </h2>
                   {selectedQuestions.map((q, idx) => {
                       const data = answerData[q.id];
                       if (!data) return null;
                       return (
                          <div key={`ans-preview-${q.id}`} className="p-4 bg-white border border-slate-300 rounded-sm">
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="font-black text-white bg-blue-900 px-2 py-1 text-xs rounded-sm">Câu {idx + 1}</span>
                                  <span className="font-black text-red-600">Đáp án: {data.correctLetter}</span>
                              </div>
                              <p className="text-sm text-slate-700 mb-2"><span className="font-bold">Nội dung:</span> {formatContent(typeof q.content === 'string' ? q.content : (q.content as any).content)}</p>
                              <div className="bg-slate-50 p-3 border border-slate-200 text-sm text-slate-600 italic rounded-sm">
                                  <span className="font-bold text-blue-900 not-italic mr-1"><i className="fas fa-lightbulb"></i> Giải thích:</span> 
                                  {data.explanation}
                              </div>
                          </div>
                       );
                   })}
                  <div className="flex justify-end mt-12">
                      <div className="text-center">
                          <p className="italic text-[12px]">Ngày ..... tháng ..... năm 20...</p>
                          <p className="font-bold text-[13px] mt-2">CÁN BỘ RA ĐỀ</p>
                          <p className="mt-14 text-[12px]">(Ký và ghi rõ họ tên)</p>
                      </div>
                  </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ExamCreator;
