import React, { useState } from 'react';
import { extractTextFromPDF } from '../../services/documentProcessor';
import { generateQuestionsByAI } from '../../services/geminiService';
import { Question, QuestionType, QuestionFolder } from '../../types';
import ReviewList from './ReviewList';

interface AIGeneratorTabProps {
  folders: QuestionFolder[];
  availableFolders: string[];
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

const AIGeneratorTab: React.FC<AIGeneratorTabProps> = ({ 
  folders,
  availableFolders, 
  onQuestionsGenerated, 
  onNotify, 
  isLoading, 
  setIsLoading,
  pendingQuestions,
  onUpdateQuestion,
  onRemoveQuestion,
  onApproveAll
}) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [bloomCounts, setBloomCounts] = useState<Record<string, number>>({
    'Nhận biết': 0, 'Thông hiểu': 0, 'Vận dụng': 0, 'Phân tích': 0, 'Đánh giá': 0, 'Sáng tạo': 0
  });
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [targetFolder, setTargetFolder] = useState<string>('Mặc định');

  const totalQuestions = Object.values(bloomCounts).reduce((a, b) => a + b, 0);

  const normalizeType = (rawType: any): QuestionType => {
    const typeStr = String(rawType || "").toUpperCase();
    if (typeStr.includes("MULTIPLE") || typeStr.includes("TRẮC NGHIỆM") || typeStr.includes("TRAC NGHIEM")) {
      return QuestionType.MULTIPLE_CHOICE;
    }
    return QuestionType.ESSAY;
  };

  const handleGenerate = async () => {
    if (totalQuestions === 0) return onNotify("Hãy chọn ít nhất 1 mức độ Bloom", "warning");
    if (!pdfFile && !customPrompt.trim()) return onNotify("Hãy tải lên tệp PDF hoặc nhập nội dung gợi ý", "warning");
    if (!targetFolder.trim()) return onNotify("Vui lòng nhập tên thư mục lưu trữ", "warning");

    setIsLoading(true);
    try {
      let contextContent = "";
      if (pdfFile) {
        contextContent = await extractTextFromPDF(pdfFile);
      }
      
      const bloomRequest = Object.entries(bloomCounts)
        .filter(([_, c]) => c > 0)
        .map(([l, c]) => `${c} câu mức độ ${l}`)
        .join(', ');

      // Fix H-01: Tách prompt và contextText hoàn toàn riêng biệt
      // Không nhúng contextContent vào prompt string (gây mất context sau 15K chars)
      if (!pdfFile && !customPrompt.trim()) {
        setIsLoading(false);
        return onNotify("Vui lòng tải tài liệu lên hoặc nhập nội dung gợi ý trước khi tạo câu hỏi!", "error");
      }
      
      // Prompt mô tả yêu cầu - không chứa context (context truyền riêng)
      const prompt = [
        customPrompt ? `Yêu cầu bổ sung: "${customPrompt}"` : '',
        `Hãy tạo ${totalQuestions} câu ${qType === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm (MULTIPLE_CHOICE)' : 'Tự luận (ESSAY)'} bao gồm: ${bloomRequest}.`,
        '',
        'YÊu CẦU QUAN TRỌNG:',
        '1. Với câu hỏi Trắc nghiệm: Phải có 4 phương án rõ ràng, 1 đáp án đúng và phần giải thích tại sao đúng.',
        "2. Với câu hỏi Tự luận: Nội dung câu hỏi phải mang tính gợi mở/vấn đáp. Trường 'correctAnswer' PHẢI chứa nội dung đáp án chuẩn chi tiết và đầy đủ.",
        "3. Sử dụng LaTeX cho công thức toán/điện trong dấu $.",
        "4. Trả về JSON array. Trường 'type' bắt buộc là 'MULTIPLE_CHOICE' hoặc 'ESSAY'."
      ].filter(Boolean).join('\n');
      
      // Fix H-01: Truyền contextContent như tham số riêng (4th param), không nhúng vào prompt
      // Với PDF dài, geminiService sẽ cắt ngắn đúng cách và truyền đầy đủ nội dung
      const rawQuestions = await generateQuestionsByAI(
        prompt, 
        totalQuestions, 
        "Phân tích tài liệu",
        contextContent || undefined  // Fix H-01: Truyền contextText đầy đủ như tham số riêng
      );
      
      const processed = rawQuestions.map(q => ({
        ...q, 
        id: Math.random().toString(36).substr(2, 9), 
        folderId: 'default',
        folder: targetFolder,
        createdAt: Date.now(),
        type: normalizeType(q.type)
      } as Question));
      
      onQuestionsGenerated(processed);
      onNotify("AI đã biên soạn đề thi thành công!", "success");
    } catch (e) { 
      onNotify("Lỗi xử lý AI. Vui lòng kiểm tra lại kết nối.", "error"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
        {/* CỘT TRÁI: ĐIỀU KHIỂN AI (4/12) */}
        <aside className="lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar pb-6">
            <div className="bg-slate-50 border border-slate-300 rounded-sm p-6 space-y-6">
                <div>
                    <label htmlFor="ai-pdf-upload" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block mb-4">Nguồn tri thức (PDF)</label>
                    <div className="border-2 border-dashed border-slate-300 p-8 rounded-sm text-center bg-white hover:border-blue-900/50 transition-all relative cursor-pointer group">
                        <input id="ai-pdf-upload" title="Tải giáo trình PDF" type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                        <i className={`fas ${pdfFile ? 'fa-file-circle-check text-green-600' : 'fa-cloud-upload-alt text-slate-300'} text-3xl mb-3`}></i>
                        <p className="text-[10px] font-bold text-slate-600 truncate">{pdfFile ? pdfFile.name : "TẢI GIÁO TRÌNH PDF"}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <label htmlFor="ai-custom-prompt" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Gợi ý AI (Prompt bổ sung)</label>
                    <textarea 
                        id="ai-custom-prompt"
                        title="Gợi ý AI bổ sung"
                        value={customPrompt}
                        onChange={e => setCustomPrompt(e.target.value)}
                        placeholder="Ví dụ: Tập trung vào chương 2, các linh kiện bán dẫn..."
                        className="w-full h-24 p-4 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 font-medium text-xs resize-none transition-all"
                    />
                </div>

                <div className="space-y-3">
                    <label htmlFor="ai-folder-input" className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Thư mục đề thi</label>
                    <input 
                        id="ai-folder-input"
                        type="text"
                        list="ai-folder-options"
                        value={targetFolder} 
                        onChange={e => setTargetFolder(e.target.value)} 
                        title="Thư mục lưu trữ câu hỏi"
                        placeholder="Tên thư mục..."
                        className="w-full bg-white border border-slate-300 text-slate-700 px-4 py-3 rounded-sm font-bold text-sm outline-none focus:border-blue-900"
                    />
                    <datalist id="ai-folder-options">
                        {availableFolders?.map((folderName, idx) => (
                        <option key={`ai-folder-${idx}`} value={folderName} />
                        ))}
                    </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Loại câu hỏi</label>
                        <select 
                            title="Chọn loại câu hỏi"
                            value={qType} 
                            onChange={e => setQType(e.target.value as QuestionType)} 
                            className="w-full p-3 bg-white border border-slate-300 rounded-sm font-bold text-xs outline-none focus:border-blue-900"
                        >
                            <option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm</option>
                            <option value={QuestionType.ESSAY}>Tự luận</option>
                        </select>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Tổng số câu</label>
                        <div className="p-3 bg-blue-900 text-white rounded-sm font-black text-center text-sm">{totalQuestions}</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">Ma trận Bloom</label>
                    <div className="grid grid-cols-3 gap-2">
                        {BLOOM_LEVELS.map(l => (
                            <div key={l} className="bg-white p-2 border border-slate-300 rounded-sm">
                                <label className="text-[8px] font-black text-slate-400 block text-center mb-1 uppercase truncate">{l}</label>
                                <input 
                                    title={`Số lượng câu hỏi mức độ ${l}`}
                                    type="number" min="0" 
                                    value={bloomCounts[l]} 
                                    onChange={e => setBloomCounts({...bloomCounts, [l]: parseInt(e.target.value)||0})} 
                                    className="w-full text-center font-black text-blue-900 outline-none bg-transparent text-sm" 
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <button 
                  onClick={handleGenerate} 
                  disabled={isLoading || totalQuestions === 0} 
                  className="w-full bg-blue-900 text-white px-8 py-4 rounded-sm font-bold disabled:bg-slate-200 disabled:text-slate-400 hover:bg-slate-800 transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-widest"
                >
                  {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-microchip"></i>}
                  {isLoading ? "ENGINE RUNNING..." : "THỰC THI BIÊN SOẠN"}
                </button>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-sm">
                <p className="text-[9px] font-bold text-yellow-900 uppercase flex items-center gap-2 mb-1">
                    <i className="fas fa-shield-halved"></i> Security Protocol
                </p>
                <p className="text-[8px] text-yellow-700 leading-tight">Mô hình Gemini-2.5-Flash được tối ưu cho tri thức chuyên môn. Dữ liệu PDF được trích xuất cục bộ trước khi xử lý AI.</p>
            </div>
        </aside>

        {/* CỘT PHẢI: KẾT QUẢ & REVIEW (8/12) */}
        <main className="lg:col-span-8 flex flex-col min-w-0 h-full overflow-hidden bg-white border border-slate-300 rounded-sm shadow-inner">
            <ReviewList 
                questions={pendingQuestions}
                folders={folders} 
                selectedFolderId="default"
                onUpdateQuestion={onUpdateQuestion}
                onRemoveQuestion={onRemoveQuestion}
                onApproveAll={onApproveAll}
                onCancel={() => {}} // Not needed here as controlled by index
            />
        </main>
    </div>
  );
};

export default AIGeneratorTab;