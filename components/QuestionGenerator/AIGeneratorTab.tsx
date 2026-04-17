import React, { useState, useRef, useEffect } from 'react';
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
  'Nhận biết':  { border: 'border-blue-300',   label: 'text-blue-600',   input: 'text-blue-800',   bg: 'bg-blue-50'   },
  'Thông hiểu': { border: 'border-teal-300',   label: 'text-teal-600',   input: 'text-teal-800',   bg: 'bg-teal-50'   },
  'Vận dụng':   { border: 'border-green-300',  label: 'text-green-600',  input: 'text-green-800',  bg: 'bg-green-50'  },
  'Phân tích':  { border: 'border-amber-300',  label: 'text-amber-600',  input: 'text-amber-800',  bg: 'bg-amber-50'  },
  'Đánh giá':   { border: 'border-orange-300', label: 'text-orange-600', input: 'text-orange-800', bg: 'bg-orange-50' },
  'Sáng tạo':   { border: 'border-purple-300', label: 'text-purple-600', input: 'text-purple-800', bg: 'bg-purple-50' },
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
  const [customPrompt, setCustomPrompt] = useState('');
  const [bloomCounts, setBloomCounts] = useState<Record<string, number>>({
    'Nhận biết': 0, 'Thông hiểu': 0, 'Vận dụng': 0, 'Phân tích': 0, 'Đánh giá': 0, 'Sáng tạo': 0,
  });
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [targetFolder, setTargetFolder] = useState('Mặc định');
  const [folderOpen, setFolderOpen] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);

  const totalQuestions = Object.values(bloomCounts).reduce((a, b) => a + b, 0);

  const mergedExamFolders = React.useMemo(() => {
    const s = new Set(['Mặc định', ...examFolders]);
    return Array.from(s).sort();
  }, [examFolders]);

  useEffect(() => {
    if (!folderOpen) return;
    const handler = (e: MouseEvent) => {
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) setFolderOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [folderOpen]);

  const normalizeType = (raw: any): QuestionType => {
    const s = String(raw || '').toUpperCase();
    return s.includes('MULTIPLE') || s.includes('TRẮC') ? QuestionType.MULTIPLE_CHOICE : QuestionType.ESSAY;
  };

  const handleGenerate = async () => {
    if (totalQuestions === 0) return onNotify('Hãy chọn ít nhất 1 mức độ Bloom', 'warning');
    if (!pdfFile && !customPrompt.trim()) return onNotify('Hãy tải lên tệp PDF hoặc nhập nội dung gợi ý', 'warning');
    if (!targetFolder.trim()) return onNotify('Vui lòng chọn thư mục lưu trữ', 'warning');
    setIsLoading(true);
    try {
      let ctx = '';
      if (pdfFile) ctx = await extractTextFromPDF(pdfFile);
      const bloomReq = Object.entries(bloomCounts)
        .filter(([, c]) => c > 0)
        .map(([l, c]) => `${c} câu mức độ ${l}`).join(', ');
      const prompt = [
        customPrompt ? `Yêu cầu bổ sung: "${customPrompt}"` : '',
        `Hãy tạo ${totalQuestions} câu ${qType === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm (MULTIPLE_CHOICE)' : 'Tự luận (ESSAY)'} bao gồm: ${bloomReq}.`,
        'YÊU CẦU QUAN TRỌNG:',
        '1. Trắc nghiệm: 4 phương án rõ ràng, 1 đáp án đúng, có giải thích.',
        "2. Tự luận: 'correctAnswer' phải là đáp án chuẩn chi tiết đầy đủ.",
        '3. Dùng LaTeX cho công thức trong dấu $.',
        "4. 'type' bắt buộc là 'MULTIPLE_CHOICE' hoặc 'ESSAY'.",
      ].filter(Boolean).join('\n');
      const raw = await generateQuestionsByAI(prompt, totalQuestions, 'Phân tích tài liệu', ctx || undefined);
      const processed = raw.map(q => ({
        ...q, id: ID.unique(), folderId: 'default', folder: targetFolder, createdAt: Date.now(), type: normalizeType(q.type),
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
    ? pdfFile.size > 1048576 ? `${(pdfFile.size / 1048576).toFixed(1)} MB` : `${(pdfFile.size / 1024).toFixed(0)} KB`
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 h-full overflow-hidden">

      {/* ══ TRÁI: BẢNG ĐIỀU KHIỂN (5/12) ══ */}
      <aside className="lg:col-span-5 flex flex-col h-full overflow-hidden border-r border-slate-200">

        {/* Header */}
        <div className="shrink-0 px-6 py-4 bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.3em]">AI Studio</p>
            <h3 className="text-sm font-black text-white uppercase tracking-widest leading-tight mt-0.5">Biên soạn tự động</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isLoading ? 'Processing' : 'Ready'}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          <div className="p-5 space-y-5">

            {/* 1. TẢI PDF */}
            <section>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-file-pdf text-red-500 mr-1.5"></i>Nguồn tri thức
              </label>
              <label className={`block border-2 border-dashed rounded-sm cursor-pointer transition-all relative group
                ${pdfFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-white hover:border-blue-900/40 hover:bg-slate-50'}`}>
                <input type="file" accept=".pdf" title="Tải giáo trình PDF"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                <div className="py-6 px-4 text-center">
                  {pdfFile ? (
                    <>
                      <i className="fas fa-file-circle-check text-2xl text-emerald-500 mb-2 block"></i>
                      <p className="text-xs font-black text-emerald-700 truncate px-2">{pdfFile.name}</p>
                      <span className="text-[9px] font-bold text-emerald-500 bg-emerald-100 px-2 py-0.5 rounded-sm mt-1.5 inline-block">{fileSizeLabel} · Nhấp để thay thế</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt text-2xl text-slate-300 mb-2 block group-hover:text-blue-900/30 transition-colors"></i>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Kéo thả hoặc nhấp để chọn PDF</p>
                      <p className="text-[9px] text-slate-300 mt-1">Tối đa 50MB · Toàn bộ nội dung được xử lý</p>
                    </>
                  )}
                </div>
              </label>
            </section>

            {/* 2. GỢI Ý AI */}
            <section>
              <label htmlFor="ai-prompt" className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-comment-dots text-blue-900 mr-1.5"></i>Gợi ý AI <span className="normal-case font-medium text-slate-400">(tuỳ chọn)</span>
              </label>
              <textarea id="ai-prompt" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Ví dụ: Tập trung chương 2, ưu tiên an toàn điện, tránh lý thuyết thuần túy..."
                className="w-full h-20 p-3 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 font-medium text-xs resize-none transition-all placeholder:text-slate-300" />
            </section>

            {/* 3. THƯ MỤC — custom dropdown */}
            <section>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-folder-open text-yellow-500 mr-1.5"></i>Thư mục đề thi
              </label>
              <div ref={folderRef} className="relative">
                <button type="button" onClick={() => setFolderOpen(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-300 rounded-sm text-sm font-bold text-slate-700 hover:border-blue-900 transition-all">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="fas fa-folder text-yellow-500 text-xs shrink-0"></i>
                    <span className="truncate">{targetFolder}</span>
                  </div>
                  <i className={`fas fa-chevron-down text-slate-400 text-xs transition-transform shrink-0 ${folderOpen ? 'rotate-180' : ''}`}></i>
                </button>
                {folderOpen && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-sm shadow-xl max-h-52 overflow-y-auto custom-scrollbar">
                    {mergedExamFolders.map((f, i) => (
                      <button type="button" key={i}
                        onClick={() => { setTargetFolder(f); setFolderOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors
                          ${targetFolder === f ? 'bg-blue-900 text-white font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'}`}>
                        <i className={`fas fa-folder text-xs ${targetFolder === f ? 'text-yellow-300' : 'text-yellow-500'}`}></i>
                        <span className="flex-1 truncate">{f}</span>
                        {targetFolder === f && <i className="fas fa-check text-xs shrink-0"></i>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 4. LOẠI CÂU HỎI */}
            <section>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-list-check text-blue-900 mr-1.5"></i>Loại câu hỏi
              </label>
              <div className="flex bg-white border border-slate-300 rounded-sm overflow-hidden">
                {([
                  { v: QuestionType.MULTIPLE_CHOICE, icon: 'fa-circle-dot', label: 'Trắc nghiệm' },
                  { v: QuestionType.ESSAY,           icon: 'fa-pen-nib',    label: 'Tự luận'    },
                ] as const).map(({ v, icon, label }) => (
                  <React.Fragment key={v}>
                    <button type="button" onClick={() => setQType(v as QuestionType)}
                      className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5
                        ${qType === v ? 'bg-blue-900 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                      <i className={`fas ${icon} text-xs`}></i>{label}
                    </button>
                    {v === QuestionType.MULTIPLE_CHOICE && <div className="w-px bg-slate-200"></div>}
                  </React.Fragment>
                ))}
              </div>
            </section>

            {/* 5. MA TRẬN BLOOM */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <i className="fas fa-chart-bar text-blue-900 mr-1.5"></i>Ma trận Bloom
                </label>
                {totalQuestions > 0 && (
                  <span className="text-[9px] font-black text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm">
                    Tổng {totalQuestions} câu
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {BLOOM_LEVELS.map(l => {
                  const c = BLOOM_COLORS[l];
                  return (
                    <div key={l} className={`border rounded-sm p-2.5 ${c.bg} ${c.border} transition-all focus-within:shadow-sm`}>
                      <p className={`text-[8px] font-black uppercase text-center truncate mb-1.5 ${c.label}`}>{l}</p>
                      <input type="number" min="0" max="50" title={`Số câu ${l}`}
                        value={bloomCounts[l]}
                        onChange={e => setBloomCounts({ ...bloomCounts, [l]: parseInt(e.target.value) || 0 })}
                        className={`w-full text-center font-black text-base outline-none bg-transparent ${c.input}`} />
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        </div>

        {/* Footer: nút thực thi */}
        <div className="shrink-0 p-4 bg-white border-t border-slate-200 space-y-2">
          <button type="button" onClick={handleGenerate}
            disabled={isLoading || totalQuestions === 0}
            className={`w-full py-3.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95
              ${isLoading || totalQuestions === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-900 text-white hover:bg-slate-800 shadow-md shadow-blue-900/20'}`}>
            {isLoading
              ? <><i className="fas fa-circle-notch fa-spin"></i>Đang phân tích tài liệu...</>
              : <><i className="fas fa-wand-magic-sparkles"></i>AI Biên soạn ngay ({totalQuestions} câu)</>}
          </button>
          <p className="text-[8px] text-slate-400 text-center">
            <i className="fas fa-lock mr-1"></i>PDF xử lý cục bộ · Gemini 2.5 Flash · Tối đa 1.5M ký tự
          </p>
        </div>
      </aside>

      {/* ══ PHẢI: KẾT QUẢ (7/12) ══ */}
      <main className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-white">
        {pendingQuestions.length === 0 ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Empty state — compact, top-aligned */}
            <div className="flex flex-col items-center pt-14 px-10 pb-8">
              <div className="w-16 h-16 rounded-sm bg-slate-100 flex items-center justify-center mb-5">
                <i className="fas fa-wand-magic-sparkles text-2xl text-slate-300"></i>
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1.5">Chờ kết quả AI</p>
              <p className="text-[10px] text-slate-300 text-center max-w-xs leading-relaxed mb-8">
                Tải lên giáo trình PDF, thiết lập ma trận Bloom rồi nhấn&nbsp;
                <strong className="text-slate-400 font-black">AI Biên soạn ngay</strong> để bắt đầu.
              </p>

              {/* Hướng dẫn dạng list */}
              <div className="w-full max-w-sm space-y-2">
                {[
                  { icon: 'fa-file-pdf',            color: 'text-red-400',    bg: 'bg-red-50',    step: '01', label: 'Tải lên giáo trình PDF',       desc: 'Hỗ trợ tài liệu tới 50MB' },
                  { icon: 'fa-chart-bar',           color: 'text-blue-500',   bg: 'bg-blue-50',   step: '02', label: 'Thiết lập ma trận Bloom',      desc: '6 mức độ nhận thức' },
                  { icon: 'fa-wand-magic-sparkles', color: 'text-yellow-500', bg: 'bg-yellow-50', step: '03', label: 'AI tự động biên soạn đề',      desc: 'Gemini 2.5 Flash phân tích' },
                  { icon: 'fa-list-check',          color: 'text-emerald-500',bg: 'bg-emerald-50',step: '04', label: 'Kiểm duyệt & phê duyệt',       desc: 'Chỉnh sửa trước khi lưu' },
                ].map(({ icon, color, bg, step, label, desc }) => (
                  <div key={step} className="flex items-center gap-4 p-3.5 bg-slate-50 border border-slate-100 rounded-sm">
                    <div className={`w-9 h-9 rounded-sm ${bg} flex items-center justify-center shrink-0`}>
                      <i className={`fas ${icon} ${color} text-sm`}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-300 uppercase">{step}</span>
                        <p className="text-xs font-black text-slate-600 truncate">{label}</p>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
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
