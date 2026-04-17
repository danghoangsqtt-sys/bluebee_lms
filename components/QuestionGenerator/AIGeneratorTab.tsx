import React, { useState } from 'react';
import { extractTextFromPDF } from '../../services/documentProcessor';
import { generateQuestionsByAI } from '../../services/geminiService';
import { Question, QuestionType, QuestionFolder } from '../../types';
import { ID } from '../../lib/appwrite';
import ReviewList from './ReviewList';

interface AIGeneratorTabProps {
  folders: QuestionFolder[];
  availableFolders: string[];
  examFolders: string[];
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

const BLOOM_COLORS: Record<string, { border: string; label: string; input: string; bg: string }> = {
  'Nhận biết':  { border: 'border-blue-300',   label: 'text-blue-600',   input: 'text-blue-700',   bg: 'bg-blue-50'   },
  'Thông hiểu': { border: 'border-teal-300',    label: 'text-teal-600',   input: 'text-teal-700',   bg: 'bg-teal-50'   },
  'Vận dụng':   { border: 'border-green-300',   label: 'text-green-600',  input: 'text-green-700',  bg: 'bg-green-50'  },
  'Phân tích':  { border: 'border-amber-300',   label: 'text-amber-600',  input: 'text-amber-700',  bg: 'bg-amber-50'  },
  'Đánh giá':   { border: 'border-orange-300',  label: 'text-orange-600', input: 'text-orange-700', bg: 'bg-orange-50' },
  'Sáng tạo':   { border: 'border-purple-300',  label: 'text-purple-600', input: 'text-purple-700', bg: 'bg-purple-50' },
};

const AIGeneratorTab: React.FC<AIGeneratorTabProps> = ({
  folders,
  availableFolders,
  examFolders,
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

  const mergedExamFolders = React.useMemo(() => {
    const set = new Set(['Mặc định', ...examFolders, ...availableFolders]);
    return Array.from(set).sort();
  }, [examFolders, availableFolders]);

  const normalizeType = (rawType: any): QuestionType => {
    const s = String(rawType || '').toUpperCase();
    return s.includes('MULTIPLE') || s.includes('TRẮC') ? QuestionType.MULTIPLE_CHOICE : QuestionType.ESSAY;
  };

  const handleGenerate = async () => {
    if (totalQuestions === 0) return onNotify('Hãy chọn ít nhất 1 mức độ Bloom', 'warning');
    if (!pdfFile && !customPrompt.trim()) return onNotify('Hãy tải lên tệp PDF hoặc nhập nội dung gợi ý', 'warning');
    if (!targetFolder.trim()) return onNotify('Vui lòng chọn thư mục lưu trữ', 'warning');

    setIsLoading(true);
    try {
      let contextContent = '';
      if (pdfFile) contextContent = await extractTextFromPDF(pdfFile);

      const bloomRequest = Object.entries(bloomCounts)
        .filter(([, c]) => c > 0)
        .map(([l, c]) => `${c} câu mức độ ${l}`)
        .join(', ');

      const prompt = [
        customPrompt ? `Yêu cầu bổ sung: "${customPrompt}"` : '',
        `Hãy tạo ${totalQuestions} câu ${qType === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm (MULTIPLE_CHOICE)' : 'Tự luận (ESSAY)'} bao gồm: ${bloomRequest}.`,
        '',
        'YÊU CẦU QUAN TRỌNG:',
        '1. Với câu hỏi Trắc nghiệm: Phải có 4 phương án rõ ràng, 1 đáp án đúng và phần giải thích tại sao đúng.',
        "2. Với câu hỏi Tự luận: Nội dung câu hỏi phải mang tính gợi mở/vấn đáp. Trường 'correctAnswer' PHẢI chứa nội dung đáp án chuẩn chi tiết và đầy đủ.",
        '3. Sử dụng LaTeX cho công thức toán/điện trong dấu $.',
        "4. Trả về JSON array. Trường 'type' bắt buộc là 'MULTIPLE_CHOICE' hoặc 'ESSAY'."
      ].filter(Boolean).join('\n');

      const rawQuestions = await generateQuestionsByAI(prompt, totalQuestions, 'Phân tích tài liệu', contextContent || undefined);

      const processed = rawQuestions.map(q => ({
        ...q,
        id: ID.unique(),
        folderId: 'default',
        folder: targetFolder,
        createdAt: Date.now(),
        type: normalizeType(q.type)
      } as Question));

      onQuestionsGenerated(processed);
      onNotify('AI đã biên soạn đề thi thành công!', 'success');
    } catch (e: any) {
      onNotify(e?.message || 'Lỗi xử lý AI. Vui lòng kiểm tra lại kết nối.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fileSizeLabel = pdfFile
    ? pdfFile.size > 1024 * 1024
      ? `${(pdfFile.size / 1024 / 1024).toFixed(1)} MB`
      : `${(pdfFile.size / 1024).toFixed(0)} KB`
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 h-full overflow-hidden animate-fade-in">

      {/* ═══════════════════════════════════════════
          CỘT TRÁI — BẢNG ĐIỀU KHIỂN AI (5/12)
      ════════════════════════════════════════════ */}
      <aside className="lg:col-span-5 flex flex-col h-full overflow-hidden border-r border-slate-200">

        {/* Header cột trái */}
        <div className="shrink-0 px-6 py-4 bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.3em]">AI Studio</p>
            <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mt-0.5">Biên soạn tự động</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {isLoading ? 'Processing' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          <div className="p-6 space-y-5">

            {/* ── 1. TẢI TÀI LIỆU PDF ── */}
            <section>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-file-pdf text-red-500 mr-1.5"></i>Nguồn tri thức
              </label>

              <label className={`block border-2 border-dashed rounded-sm text-center cursor-pointer transition-all relative group
                ${pdfFile
                  ? 'border-emerald-400 bg-emerald-50 hover:border-emerald-500'
                  : 'border-slate-300 bg-white hover:border-blue-900/50 hover:bg-slate-50'
                }`}>
                <input
                  type="file"
                  accept=".pdf"
                  title="Tải giáo trình PDF"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={e => setPdfFile(e.target.files?.[0] || null)}
                />
                <div className="py-8 px-4">
                  {pdfFile ? (
                    <>
                      <i className="fas fa-file-circle-check text-3xl text-emerald-500 mb-3 block"></i>
                      <p className="text-xs font-black text-emerald-700 truncate px-4">{pdfFile.name}</p>
                      <div className="flex items-center justify-center gap-3 mt-2">
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-sm">{fileSizeLabel}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Nhấp để thay thế</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt text-3xl text-slate-300 mb-3 block group-hover:text-blue-900/40 transition-colors"></i>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Kéo thả hoặc nhấp để chọn PDF</p>
                      <p className="text-[9px] text-slate-400 mt-1">Hỗ trợ toàn bộ tài liệu — tối đa 50MB</p>
                    </>
                  )}
                </div>
              </label>
            </section>

            {/* ── 2. GỢI Ý BỔ SUNG ── */}
            <section>
              <label htmlFor="ai-custom-prompt" className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-comment-dots text-blue-900 mr-1.5"></i>Gợi ý AI (tuỳ chọn)
              </label>
              <textarea
                id="ai-custom-prompt"
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Ví dụ: Tập trung chương 2, ưu tiên an toàn điện, tránh lý thuyết thuần túy..."
                className="w-full h-20 p-3 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 font-medium text-xs resize-none transition-all placeholder:text-slate-300"
              />
            </section>

            {/* ── 3. THƯ MỤC LƯU TRỮ ── */}
            <section>
              <label htmlFor="ai-folder-input" className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-folder-open text-yellow-500 mr-1.5"></i>Thư mục đề thi
              </label>
              <div className="relative">
                <input
                  id="ai-folder-input"
                  list="ai-folder-datalist"
                  value={targetFolder}
                  onChange={e => setTargetFolder(e.target.value)}
                  placeholder="Chọn hoặc nhập tên thư mục..."
                  title="Chọn thư mục lưu trữ"
                  className="w-full bg-white border border-slate-300 text-slate-700 px-4 py-3 rounded-sm font-bold text-sm outline-none focus:border-blue-900 pr-9 transition-all"
                />
                <datalist id="ai-folder-datalist">
                  {mergedExamFolders.map((f, i) => <option key={i} value={f} />)}
                </datalist>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
              </div>
            </section>

            {/* ── 4. LOẠI CÂU HỎI (TOGGLE) ── */}
            <section>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-list-check text-blue-900 mr-1.5"></i>Loại câu hỏi
              </label>
              <div className="flex bg-white border border-slate-300 rounded-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQType(QuestionType.MULTIPLE_CHOICE)}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
                    ${qType === QuestionType.MULTIPLE_CHOICE
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <i className="fas fa-circle-dot text-xs"></i> Trắc nghiệm
                </button>
                <div className="w-px bg-slate-200"></div>
                <button
                  type="button"
                  onClick={() => setQType(QuestionType.ESSAY)}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
                    ${qType === QuestionType.ESSAY
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <i className="fas fa-pen-nib text-xs"></i> Tự luận
                </button>
              </div>
            </section>

            {/* ── 5. MA TRẬN BLOOM ── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <i className="fas fa-chart-bar text-blue-900 mr-1.5"></i>Ma trận Bloom
                </label>
                {totalQuestions > 0 && (
                  <span className="text-[9px] font-black text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm">
                    Tổng: {totalQuestions} câu
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {BLOOM_LEVELS.map(l => {
                  const c = BLOOM_COLORS[l];
                  return (
                    <div key={l} className={`border rounded-sm p-2.5 ${c.bg} ${c.border} transition-all focus-within:ring-1 focus-within:ring-blue-900`}>
                      <p className={`text-[8px] font-black uppercase text-center truncate mb-1.5 ${c.label}`}>{l}</p>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        title={`Số câu mức ${l}`}
                        value={bloomCounts[l]}
                        onChange={e => setBloomCounts({ ...bloomCounts, [l]: parseInt(e.target.value) || 0 })}
                        className={`w-full text-center font-black text-base outline-none bg-transparent ${c.input}`}
                      />
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        </div>

        {/* ── NÚT THỰC THI ── */}
        <div className="shrink-0 p-4 bg-white border-t border-slate-200 space-y-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || totalQuestions === 0}
            className={`w-full py-4 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95
              ${isLoading || totalQuestions === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-900 text-white hover:bg-slate-800 shadow-md shadow-blue-900/20'
              }`}
          >
            {isLoading
              ? <><i className="fas fa-circle-notch fa-spin"></i> Đang phân tích tài liệu...</>
              : <><i className="fas fa-wand-magic-sparkles"></i> AI Biên soạn ngay ({totalQuestions} câu)</>
            }
          </button>
          <p className="text-[8px] text-slate-400 text-center font-medium">
            <i className="fas fa-lock mr-1"></i>PDF được xử lý cục bộ · Gemini 2.5 Flash
          </p>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          CỘT PHẢI — KIỂM DUYỆT KẾT QUẢ (7/12)
      ════════════════════════════════════════════ */}
      <main className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-white">

        {/* Header cột phải */}
        {pendingQuestions.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 select-none p-12">
            <div className="w-20 h-20 rounded-sm bg-slate-100 flex items-center justify-center mb-6">
              <i className="fas fa-wand-magic-sparkles text-3xl text-slate-300"></i>
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Chờ kết quả AI</p>
            <p className="text-[10px] text-slate-300 text-center max-w-xs leading-relaxed">
              Tải lên giáo trình PDF, thiết lập ma trận Bloom rồi nhấn <strong className="text-slate-400">AI Biên soạn ngay</strong> để bắt đầu.
            </p>

            {/* Hướng dẫn nhanh */}
            <div className="mt-10 grid grid-cols-3 gap-4 w-full max-w-sm">
              {[
                { icon: 'fa-file-pdf', color: 'text-red-400', step: '01', label: 'Tải PDF lên' },
                { icon: 'fa-chart-bar', color: 'text-blue-400', step: '02', label: 'Cài ma trận Bloom' },
                { icon: 'fa-wand-magic-sparkles', color: 'text-yellow-400', step: '03', label: 'AI biên soạn' },
              ].map(({ icon, color, step, label }) => (
                <div key={step} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-sm bg-slate-100 flex items-center justify-center">
                    <i className={`fas ${icon} ${color} text-base`}></i>
                  </div>
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{step}</p>
                  <p className="text-[9px] font-bold text-slate-400 text-center">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingQuestions.length > 0 && (
          <ReviewList
            questions={pendingQuestions}
            folders={folders}
            selectedFolderId="default"
            onUpdateQuestion={onUpdateQuestion}
            onRemoveQuestion={onRemoveQuestion}
            onApproveAll={onApproveAll}
            onCancel={() => {}}
          />
        )}
      </main>
    </div>
  );
};

export default AIGeneratorTab;
