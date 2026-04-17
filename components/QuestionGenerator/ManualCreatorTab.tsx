import React, { useState } from 'react';
import { Question, QuestionType, QuestionFolder } from '../../types';
import { ID } from '../../lib/appwrite';
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

const BLOOM_COLORS: Record<string, { active: string; inactive: string; dot: string }> = {
  'Nhận biết':  { active: 'bg-blue-600 text-white border-blue-600',     inactive: 'bg-white text-blue-700 border-blue-200 hover:border-blue-400',     dot: 'bg-blue-500'   },
  'Thông hiểu': { active: 'bg-teal-600 text-white border-teal-600',     inactive: 'bg-white text-teal-700 border-teal-200 hover:border-teal-400',     dot: 'bg-teal-500'   },
  'Vận dụng':   { active: 'bg-green-600 text-white border-green-600',   inactive: 'bg-white text-green-700 border-green-200 hover:border-green-400',   dot: 'bg-green-500'  },
  'Phân tích':  { active: 'bg-amber-500 text-white border-amber-500',   inactive: 'bg-white text-amber-700 border-amber-200 hover:border-amber-400',   dot: 'bg-amber-500'  },
  'Đánh giá':   { active: 'bg-orange-500 text-white border-orange-500', inactive: 'bg-white text-orange-700 border-orange-200 hover:border-orange-400', dot: 'bg-orange-500' },
  'Sáng tạo':   { active: 'bg-purple-600 text-white border-purple-600', inactive: 'bg-white text-purple-700 border-purple-200 hover:border-purple-400', dot: 'bg-purple-500' },
};

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

  const mergedExamFolders = React.useMemo(() => {
    const set = new Set(['Mặc định', ...examFolders, ...availableFolders]);
    return Array.from(set).sort();
  }, [examFolders, availableFolders]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const handleAttachImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotify('Vui lòng chỉ chọn định dạng hình ảnh (PNG, JPG, JPEG).', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const base64 = await fileToBase64(file);
      setManualQ(prev => ({ ...prev, image: base64 }));
      onNotify('Đã đính kèm ảnh minh họa', 'success');
    } catch {
      onNotify('Lỗi xử lý ảnh', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveImage = () => setManualQ(prev => ({ ...prev, image: '' }));

  const handleAddManual = () => {
    if (!manualQ.content.trim()) return onNotify('Nội dung trống', 'warning');
    if (!manualQ.folder.trim()) return onNotify('Chọn thư mục', 'warning');

    let finalCorrectAnswer = manualQ.correctAnswer;
    if (manualQ.type === QuestionType.MULTIPLE_CHOICE) {
      if (manualQ.options.some(o => !o.trim())) return onNotify('Thiếu phương án', 'warning');
      if (selectedIndex === null) return onNotify('Chọn đáp án đúng', 'warning');
      finalCorrectAnswer = manualQ.options[selectedIndex];
    } else {
      if (!manualQ.correctAnswer.trim()) return onNotify('Thiếu đáp án chuẩn', 'warning');
    }

    onQuestionCreated({
      ...manualQ,
      correctAnswer: finalCorrectAnswer,
      id: ID.unique(),
      createdAt: Date.now(),
      options: manualQ.type === QuestionType.MULTIPLE_CHOICE ? manualQ.options : undefined,
      folderId: 'default'
    } as Question);

    setManualQ({ ...manualQ, content: '', correctAnswer: '', explanation: '', options: ['', '', '', ''], image: '' });
    setSelectedIndex(null);
    setRightTab('QUEUE');
    onNotify('Đã thêm vào hàng chờ', 'success');
  };

  const bloomColor = BLOOM_COLORS[manualQ.bloomLevel] || BLOOM_COLORS['Nhận biết'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 h-full overflow-hidden animate-fade-in">

      {/* ═══════════════════════════════════════════
          CỘT TRÁI — NHẬP LIỆU THỦ CÔNG (5/12)
      ════════════════════════════════════════════ */}
      <aside className="lg:col-span-5 flex flex-col h-full overflow-hidden border-r border-slate-200">

        {/* Header */}
        <div className="shrink-0 px-6 py-4 bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.3em]">Manual Studio</p>
            <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mt-0.5">Nhập thủ công</h3>
          </div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded-sm">
            {pendingQuestions.length} câu
          </span>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          <div className="p-6 space-y-5">

            {/* ── 1. THƯ MỤC ── */}
            <section>
              <label htmlFor="manual-folder-input" className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-folder-open text-yellow-500 mr-1.5"></i>Thư mục đề thi
              </label>
              <div className="relative">
                <input
                  id="manual-folder-input"
                  list="manual-folder-datalist"
                  value={manualQ.folder}
                  onChange={e => setManualQ({ ...manualQ, folder: e.target.value })}
                  placeholder="Chọn hoặc nhập tên thư mục..."
                  title="Chọn thư mục lưu trữ câu hỏi"
                  className="w-full bg-white border border-slate-300 text-slate-700 px-4 py-3 rounded-sm font-bold text-sm outline-none focus:border-blue-900 pr-9 transition-all"
                />
                <datalist id="manual-folder-datalist">
                  {mergedExamFolders.map((f, i) => <option key={i} value={f} />)}
                </datalist>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
              </div>
            </section>

            {/* ── 2. LOẠI + BLOOM ── */}
            <section className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                  <i className="fas fa-list-check text-blue-900 mr-1.5"></i>Loại
                </label>
                <div className="flex bg-white border border-slate-300 rounded-sm overflow-hidden h-10">
                  <button type="button"
                    onClick={() => { setManualQ({ ...manualQ, type: QuestionType.MULTIPLE_CHOICE }); setSelectedIndex(null); }}
                    className={`flex-1 text-[9px] font-black uppercase tracking-widest transition-all ${manualQ.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                  >TN</button>
                  <div className="w-px bg-slate-200"></div>
                  <button type="button"
                    onClick={() => setManualQ({ ...manualQ, type: QuestionType.ESSAY })}
                    className={`flex-1 text-[9px] font-black uppercase tracking-widest transition-all ${manualQ.type === QuestionType.ESSAY ? 'bg-blue-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                  >TL</button>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                  <i className="fas fa-layer-group text-blue-900 mr-1.5"></i>Bloom
                </label>
                <div className={`h-10 px-3 flex items-center border rounded-sm text-[10px] font-black uppercase tracking-widest ${bloomColor.active}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 mr-2 shrink-0"></div>
                  <span className="truncate">{manualQ.bloomLevel}</span>
                </div>
              </div>
            </section>

            {/* Bloom pills */}
            <div className="flex flex-wrap gap-1.5">
              {BLOOM_LEVELS.map(l => {
                const bc = BLOOM_COLORS[l];
                return (
                  <button type="button" key={l}
                    onClick={() => setManualQ({ ...manualQ, bloomLevel: l })}
                    className={`px-2.5 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest transition-all ${manualQ.bloomLevel === l ? bc.active : bc.inactive}`}
                  >{l}</button>
                );
              })}
            </div>

            {/* ── 3. NỘI DUNG CÂU HỎI ── */}
            <section>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-pencil text-blue-900 mr-1.5"></i>Nội dung câu hỏi
              </label>
              <div className="relative">
                <textarea
                  value={manualQ.content}
                  onChange={e => setManualQ({ ...manualQ, content: e.target.value })}
                  placeholder="Nhập nội dung câu hỏi..."
                  className="w-full h-32 p-4 pb-12 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 font-medium text-sm transition-all resize-none"
                />
                {/* Camera button */}
                <label title="Đính kèm hình ảnh"
                  className="absolute bottom-3 left-3 w-8 h-8 bg-slate-100 text-slate-500 border border-slate-200 rounded-sm flex items-center justify-center cursor-pointer hover:bg-blue-900 hover:text-white hover:border-blue-900 transition-all">
                  <i className="fas fa-camera text-xs"></i>
                  <input type="file" title="Chọn ảnh" accept="image/*" className="hidden" onChange={handleAttachImage} />
                </label>
                {/* Image preview inline */}
                {manualQ.image && (
                  <div className="absolute bottom-3 left-14 flex items-center gap-2">
                    <img src={manualQ.image} alt="thumb" className="h-8 w-8 object-cover rounded-sm border border-slate-300" />
                    <button type="button" onClick={handleRemoveImage} title="Xóa ảnh"
                      className="w-5 h-5 bg-red-500 text-white rounded-sm flex items-center justify-center hover:bg-red-700 transition-all">
                      <i className="fas fa-times text-[9px]"></i>
                    </button>
                  </div>
                )}
                <div className="absolute bottom-3 right-3 text-[9px] font-bold text-slate-300">
                  {manualQ.content.length} ký tự
                </div>
              </div>
            </section>

            {/* ── 4. PHƯƠNG ÁN / ĐÁP ÁN ── */}
            {manualQ.type === QuestionType.MULTIPLE_CHOICE ? (
              <section>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                  <i className="fas fa-circle-dot text-blue-900 mr-1.5"></i>Phương án trả lời
                </label>
                <div className="space-y-2">
                  {manualQ.options.map((opt, i) => (
                    <div key={i} className={`flex items-center gap-2 border rounded-sm overflow-hidden transition-all
                      ${selectedIndex === i ? 'border-blue-900 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <button type="button"
                        onClick={() => setSelectedIndex(i)}
                        title="Đặt làm đáp án đúng"
                        className={`w-10 shrink-0 self-stretch flex items-center justify-center text-[10px] font-black transition-all
                          ${selectedIndex === i ? 'bg-blue-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                        {String.fromCharCode(65 + i)}
                      </button>
                      <input
                        value={opt}
                        onChange={e => { const n = [...manualQ.options]; n[i] = e.target.value; setManualQ({ ...manualQ, options: n }); }}
                        placeholder={`Phương án ${String.fromCharCode(65 + i)}`}
                        className="flex-1 py-2.5 pr-2 outline-none bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-300"
                      />
                      {manualQ.options.length > 2 && (
                        <button type="button"
                          onClick={() => {
                            const n = manualQ.options.filter((_, idx) => idx !== i);
                            setManualQ({ ...manualQ, options: n });
                            if (selectedIndex === i) setSelectedIndex(null);
                            else if (selectedIndex !== null && selectedIndex > i) setSelectedIndex(selectedIndex - 1);
                          }}
                          className="w-8 shrink-0 self-stretch flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Xóa phương án">
                          <i className="fas fa-minus text-xs"></i>
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => setManualQ({ ...manualQ, options: [...manualQ.options, ''] })}
                    className="w-full py-2 border border-dashed border-slate-300 text-slate-400 rounded-sm text-[10px] font-black uppercase tracking-widest hover:border-blue-900 hover:text-blue-900 transition-all">
                    <i className="fas fa-plus mr-1.5"></i>Thêm phương án
                  </button>
                </div>
              </section>
            ) : (
              <section>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                  <i className="fas fa-check-circle text-emerald-600 mr-1.5"></i>Đáp án chuẩn / Hướng dẫn chấm
                </label>
                <textarea
                  title="Nhập đáp án chuẩn"
                  placeholder="Nhập đáp án mẫu chi tiết để giảng viên chấm điểm..."
                  value={manualQ.correctAnswer}
                  onChange={e => setManualQ({ ...manualQ, correctAnswer: e.target.value })}
                  className="w-full h-28 p-3 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 text-sm resize-none transition-all"
                />
              </section>
            )}

            {/* ── 5. GIẢI THÍCH ── */}
            <section>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                <i className="fas fa-lightbulb text-amber-500 mr-1.5"></i>Giải thích (tuỳ chọn)
              </label>
              <input
                value={manualQ.explanation}
                onChange={e => setManualQ({ ...manualQ, explanation: e.target.value })}
                placeholder="Giải thích ngắn gọn tại sao đáp án này đúng..."
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-sm outline-none focus:border-blue-900 text-xs font-medium transition-all"
              />
            </section>

          </div>
        </div>

        {/* Nút thêm */}
        <div className="shrink-0 p-4 bg-white border-t border-slate-200">
          <button
            type="button"
            onClick={handleAddManual}
            disabled={isLoading}
            className="w-full py-4 bg-blue-900 text-white rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <i className="fas fa-plus-circle"></i>Thêm vào hàng chờ
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          CỘT PHẢI — PREVIEW / QUEUE (7/12)
      ════════════════════════════════════════════ */}
      <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-white">

        {/* Tab switcher */}
        <div className="shrink-0 flex border-b border-slate-200 bg-slate-50">
          <button type="button"
            onClick={() => setRightTab('PREVIEW')}
            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
              ${rightTab === 'PREVIEW' ? 'bg-white text-blue-900 border-b-2 border-blue-900' : 'text-slate-400 hover:text-slate-600'}`}>
            <i className="fas fa-eye"></i> Live Preview
          </button>
          <button type="button"
            onClick={() => setRightTab('QUEUE')}
            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
              ${rightTab === 'QUEUE' ? 'bg-white text-blue-900 border-b-2 border-blue-900' : 'text-slate-400 hover:text-slate-600'}`}>
            <i className="fas fa-layer-group"></i> Hàng chờ
            {pendingQuestions.length > 0 && (
              <span className="bg-blue-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm min-w-[18px] text-center">
                {pendingQuestions.length}
              </span>
            )}
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          {rightTab === 'PREVIEW' ? (
            <div className="h-full overflow-y-auto custom-scrollbar p-8 bg-slate-50">
              <div className="max-w-lg mx-auto">
                {/* Card preview */}
                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
                  {/* Card header */}
                  <div className="px-5 py-3 bg-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${manualQ.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-400' : 'bg-yellow-400'}`}></span>
                      <span className="text-[9px] font-black text-white uppercase tracking-widest">
                        {manualQ.type === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm' : 'Tự luận'}
                      </span>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-sm border uppercase tracking-widest ${bloomColor.active}`}>
                      {manualQ.bloomLevel}
                    </span>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Question text */}
                    <div className="text-base font-bold text-slate-800 leading-relaxed border-l-4 border-blue-900 pl-4 min-h-[3rem]">
                      {manualQ.content.trim() ? formatContent(manualQ.content) : (
                        <span className="text-slate-300 italic font-normal">Đang chờ nội dung...</span>
                      )}
                    </div>

                    {/* Image preview */}
                    {manualQ.image && (
                      <img src={manualQ.image} alt="Minh họa" className="max-h-40 rounded-sm border border-slate-200 mx-auto object-contain" />
                    )}

                    {/* Options or answer */}
                    {manualQ.type === QuestionType.MULTIPLE_CHOICE ? (
                      <div className="space-y-2">
                        {manualQ.options.map((o, i) => (
                          <div key={i}
                            className={`flex items-center gap-3 p-3 border rounded-sm transition-all
                              ${selectedIndex === i ? 'bg-blue-50 border-blue-900' : 'bg-slate-50 border-slate-100'}`}>
                            <span className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-black shrink-0
                              ${selectedIndex === i ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className={`text-xs font-medium ${selectedIndex === i ? 'text-blue-900 font-bold' : 'text-slate-500'}`}>
                              {o || <em className="text-slate-300">Trống</em>}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Đáp án chuẩn</p>
                        <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                          {manualQ.correctAnswer || <em className="text-emerald-400">Chưa nhập đáp án</em>}
                        </p>
                      </div>
                    )}

                    {/* Explanation */}
                    {manualQ.explanation && (
                      <div className="flex gap-2 p-3 bg-amber-50 border border-amber-100 rounded-sm">
                        <i className="fas fa-lightbulb text-amber-400 text-xs mt-0.5 shrink-0"></i>
                        <p className="text-[10px] text-amber-800 italic font-medium">{manualQ.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Folder badge */}
                <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <i className="fas fa-folder-open text-yellow-400"></i>
                  {manualQ.folder || 'Mặc định'}
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
