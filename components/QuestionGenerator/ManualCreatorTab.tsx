import React, { useState } from 'react';
import { Question, QuestionType, QuestionFolder } from '../../types';
import { formatContent } from '../../utils/textFormatter';
import ReviewList from './ReviewList';

interface ManualCreatorTabProps {
  folders: QuestionFolder[]; 
  availableFolders: string[];
  examFolders: string[];
  onQuestionCreated: (question: Question) => void;
  onQuestionsGenerated: (questions: Question[]) => void;
  onNotify: (message: string, type: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  pendingQuestions: Question[];
  onUpdateQuestion: (index: number, updated: Question) => void;
  onRemoveQuestion: (index: number) => void;
  onApproveAll: () => void;
}

const BLOOM_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];

const ManualCreatorTab: React.FC<ManualCreatorTabProps> = ({ 
  availableFolders,
  examFolders, 
  onQuestionCreated, 
  onNotify, 
  isLoading, 
  setIsLoading,
  pendingQuestions,
  onUpdateQuestion,
  onRemoveQuestion,
  onApproveAll
}) => {
  const [manualQ, setManualQ] = useState({
    content: '',
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    bloomLevel: 'Nhận biết',
    category: 'An toàn điện',
    folder: 'Mặc định',
    image: '' 
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState<'PREVIEW' | 'QUEUE'>('PREVIEW');

  // Gộp thư mục đề thi: từ Appwrite custom folders + availableFolders (câu hỏi) + default  
  const mergedExamFolders = React.useMemo(() => {
    const set = new Set(['Mặc định', ...examFolders, ...availableFolders]);
    return Array.from(set).sort();
  }, [examFolders, availableFolders]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleAttachImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        onNotify("Vui lòng chỉ chọn định dạng hình ảnh (PNG, JPG, JPEG).", "warning");
        return;
    }
    setIsLoading(true);
    try {
        const base64 = await fileToBase64(file);
        setManualQ(prev => ({ ...prev, image: base64 }));
        onNotify("Đã đính kèm ảnh minh họa", "success");
    } catch (err) {
        onNotify("Lỗi xử lý ảnh", "error");
    } finally {
        setIsLoading(false);
    }
  };

  const handleRemoveImage = () => {
    setManualQ(prev => ({ ...prev, image: '' }));
  };

  const handleAddManual = () => {
    if (!manualQ.content.trim()) return onNotify("Nội dung trống", "warning");
    if (!manualQ.folder.trim()) return onNotify("Chọn thư mục", "warning");
    
    let finalCorrectAnswer = manualQ.correctAnswer;
    if (manualQ.type === QuestionType.MULTIPLE_CHOICE) {
      if (manualQ.options.some(opt => !opt.trim())) return onNotify("Thiếu phương án", "warning");
      if (selectedIndex === null) return onNotify("Chọn đáp án đúng", "warning");
      finalCorrectAnswer = manualQ.options[selectedIndex];
    } else {
      if (!manualQ.correctAnswer.trim()) return onNotify("Thiếu đáp án chuẩn", "warning");
    }

    const newQuestion: Question = {
      ...manualQ,
      correctAnswer: finalCorrectAnswer,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      options: manualQ.type === QuestionType.MULTIPLE_CHOICE ? manualQ.options : undefined,
      folderId: 'default'
    } as Question;

    onQuestionCreated(newQuestion);
    setManualQ({ ...manualQ, content: '', correctAnswer: '', explanation: '', options: ['', '', '', ''], image: '' });
    setSelectedIndex(null);
    setRightTab('QUEUE'); // Switch to queue to see added question
    onNotify("Đã thêm vào giỏ", "success");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden animate-fade-in">
      {/* LEFT: FORM (5/12) */}
      <div className="lg:col-span-5 flex flex-col overflow-y-auto pr-2 custom-scrollbar pb-6">
        <div className="bg-slate-50 border border-slate-300 rounded-sm p-6 space-y-6">
          <div className="space-y-4">
            <label htmlFor="manual-folder-input" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Thư mục đề thi</label>
            <div className="relative">
              <input
                id="manual-folder-input"
                list="manual-folder-datalist"
                value={manualQ.folder}
                onChange={e => setManualQ({...manualQ, folder: e.target.value})}
                placeholder="Chọn hoặc nhập tên thư mục..."
                title="Chọn thư mục lưu trữ câu hỏi"
                className="w-full bg-white border border-slate-300 text-slate-700 px-4 py-3 rounded-sm font-bold text-sm outline-none focus:border-blue-900"
              />
              <datalist id="manual-folder-datalist">
                {mergedExamFolders.map((f, idx) => (
                  <option key={idx} value={f} />
                ))}
              </datalist>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Nội dung câu hỏi</label>
            <div className="relative">
              <textarea 
                value={manualQ.content} 
                onChange={e => setManualQ({...manualQ, content: e.target.value})} 
                placeholder="Nhập nội dung..." 
                className="w-full h-40 p-4 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 font-medium text-sm transition-all resize-none" 
              />
              <label title="Đính kèm hình ảnh" className="absolute bottom-3 right-3 w-10 h-10 bg-blue-900 text-white rounded-sm flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-all">
                <i className="fas fa-camera"></i>
                <input type="file" title="Chọn ảnh đính kèm" accept="image/*" className="hidden" onChange={handleAttachImage} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Loại</label>
              <select title="Chọn loại câu hỏi" value={manualQ.type} onChange={e => setManualQ({...manualQ, type: e.target.value as QuestionType})} className="w-full p-3 bg-white border border-slate-300 rounded-sm font-bold text-xs uppercase">
                <option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm</option>
                <option value={QuestionType.ESSAY}>Tự luận</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Mức độ Bloom</label>
              <select title="Chọn mức độ Bloom" value={manualQ.bloomLevel} onChange={e => setManualQ({...manualQ, bloomLevel: e.target.value})} className="w-full p-3 bg-white border border-slate-300 rounded-sm font-bold text-xs">
                {BLOOM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {manualQ.type === QuestionType.MULTIPLE_CHOICE ? (
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Phương án trả lời (Options List)</label>
              {manualQ.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border border-slate-200 bg-white rounded-sm mb-2">
                  <input 
                    type="radio" 
                    name="correct-answer"
                    checked={selectedIndex === i}
                    onChange={() => setSelectedIndex(i)}
                    className="w-4 h-4 text-blue-900 focus:ring-blue-900"
                    title="Chọn làm đáp án đúng"
                  />
                  <input 
                    value={opt} 
                    onChange={e => { const n = [...manualQ.options]; n[i] = e.target.value; setManualQ({...manualQ, options: n}); }} 
                    placeholder={`Nội dung phương án ${String.fromCharCode(65+i)}`} 
                    className="w-full border border-slate-300 rounded-sm px-3 py-2 focus:border-blue-900 focus:ring-1 focus:ring-blue-900 outline-none text-sm font-medium" 
                  />
                  {manualQ.options.length > 2 && (
                    <button 
                      onClick={() => {
                        const n = manualQ.options.filter((_, idx) => idx !== i);
                        setManualQ({...manualQ, options: n});
                        if (selectedIndex === i) setSelectedIndex(null);
                        else if (selectedIndex !== null && selectedIndex > i) setSelectedIndex(selectedIndex - 1);
                      }}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Xóa phương án"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  )}
                </div>
              ))}
              <button 
                onClick={() => setManualQ({...manualQ, options: [...manualQ.options, '']})}
                className="border border-blue-900 text-blue-900 bg-transparent hover:bg-slate-50 rounded-sm px-3 py-1 mt-2 text-sm font-medium"
              >
                + Thêm đáp án
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Đáp án chuẩn</label>
              <textarea 
                title="Nhập đáp án chuẩn"
                placeholder="Nhập đáp án chuẩn..."
                value={manualQ.correctAnswer} 
                onChange={e => setManualQ({...manualQ, correctAnswer: e.target.value})} 
                className="w-full h-24 p-2 bg-white border border-slate-300 rounded-sm outline-none text-sm resize-none" 
              />
            </div>
          )}

          <button onClick={handleAddManual} disabled={isLoading} className="w-full py-4 bg-blue-900 text-white rounded-sm font-bold uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95">
            <i className="fas fa-plus"></i> Thêm vào hàng chờ
          </button>
        </div>
      </div>

      {/* RIGHT: PREVIEW/QUEUE (7/12) */}
      <div className="lg:col-span-7 flex flex-col min-w-0 overflow-hidden bg-white border border-slate-300 rounded-sm">
        <div className="flex bg-slate-100 border-b border-slate-300 p-1 shrink-0">
            <button onClick={() => setRightTab('PREVIEW')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${rightTab === 'PREVIEW' ? 'bg-blue-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Live Preview</button>
            <button onClick={() => setRightTab('QUEUE')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 ${rightTab === 'QUEUE' ? 'bg-blue-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Hàng chờ ({pendingQuestions.length})</button>
        </div>

        <div className="flex-1 overflow-hidden relative">
            {rightTab === 'PREVIEW' ? (
                <div className="h-full p-10 overflow-y-auto custom-scrollbar">
                    <div className="max-w-xl mx-auto border border-slate-300 rounded-sm overflow-hidden bg-white">
                        <div className="px-4 py-2 bg-slate-900 flex justify-between items-center text-[9px] font-bold text-white uppercase tracking-widest">
                            <span>System Object Preview</span>
                            <span className="text-yellow-500">{manualQ.bloomLevel}</span>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="text-xl font-bold text-slate-800 leading-relaxed border-l-4 border-blue-900 pl-4">
                                {manualQ.content.trim() ? formatContent(manualQ.content) : "Waiting for input..."}
                            </div>
                            {manualQ.image && <img src={manualQ.image} alt="Art" className="max-h-48 rounded-sm border border-slate-300 mx-auto" />}
                            
                            {manualQ.type === QuestionType.MULTIPLE_CHOICE ? (
                                <div className="space-y-2">
                                    {manualQ.options.map((o, i) => (
                                        <div key={i} className={`p-4 border rounded-sm flex items-center gap-4 ${selectedIndex === i ? 'bg-blue-50 border-blue-900 text-blue-900' : 'bg-white border-slate-100 text-slate-400'}`}>
                                            <span className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-black ${selectedIndex === i ? 'bg-blue-900 text-white' : 'bg-slate-100'}`}>{String.fromCharCode(65+i)}</span>
                                            <span className="text-xs font-bold">{o || "---"}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 border border-slate-200 text-xs italic text-slate-500">
                                    {manualQ.correctAnswer || "No reference answer provided."}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <ReviewList 
                    questions={pendingQuestions} 
                    folders={[]} 
                    selectedFolderId="default" 
                    onUpdateQuestion={onUpdateQuestion} 
                    onRemoveQuestion={onRemoveQuestion} 
                    onApproveAll={onApproveAll} 
                    onCancel={() => {}} 
                />
            )}
        </div>
      </div>
    </div>
  );
};

export default ManualCreatorTab;