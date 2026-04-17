import React from 'react';
import { Question, QuestionType, QuestionFolder } from '../../types';
import { formatContent } from '../../utils/textFormatter';

interface ReviewListProps {
  questions: Question[];
  folders: QuestionFolder[];
  selectedFolderId: string;
  onUpdateQuestion: (index: number, updated: Question) => void;
  onRemoveQuestion: (index: number) => void;
  onApproveAll: () => void;
  onCancel: () => void;
}

const ReviewList: React.FC<ReviewListProps> = ({ 
  questions, 
  onUpdateQuestion, 
  onRemoveQuestion, 
  onApproveAll, 
  onCancel 
}) => {

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const existing = questions[index].previewUrl;
    if (existing && existing.startsWith('blob:')) URL.revokeObjectURL(existing);

    const previewUrl = URL.createObjectURL(file);
    const updatedQ = {
        ...questions[index],
        imageFile: file,
        previewUrl: previewUrl
    };
    onUpdateQuestion(index, updatedQ);
  };

  const handleRemoveImage = (index: number) => {
    const existing = questions[index].previewUrl;
    if (existing && existing.startsWith('blob:')) URL.revokeObjectURL(existing);

    const updatedQ = {
        ...questions[index],
        imageFile: undefined,
        previewUrl: undefined,
        image: undefined
    };
    onUpdateQuestion(index, updatedQ);
  };

  return (
    <div className="bg-white h-full flex flex-col overflow-hidden animate-fade-in rounded-sm">
      <header className="flex justify-between items-center px-6 py-4 border-b-2 border-slate-300 bg-slate-50 shrink-0">
        <div>
          <h2 className="text-sm font-black text-blue-900 uppercase tracking-[0.2em] flex items-center gap-2">
            <i className="fas fa-list-check"></i> Kiểm duyệt dữ liệu ({questions.length})
          </h2>
        </div>
        <div className="flex gap-2">
          {questions.length > 0 && (
            <button 
                onClick={onApproveAll} 
                className="px-6 py-2.5 bg-blue-900 text-white rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
            >
                Phê duyệt tất cả
            </button>
          )}
          <button onClick={onCancel} className="px-4 py-2.5 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-red-600 transition-all">Reset</button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto space-y-px bg-slate-200 custom-scrollbar">
        {questions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center bg-white text-slate-300 gap-4">
                <i className="fas fa-inbox text-4xl opacity-20"></i>
                <p className="text-[10px] font-bold uppercase tracking-widest italic text-center">Hàng chờ trống.<br/>Vui lòng biên soạn câu hỏi để kiểm duyệt.</p>
            </div>
        ) : questions.map((q, i) => {
          const displayImage = q.previewUrl || q.image;
          
          return (
            <div key={q.id || i} className="p-8 bg-white border-b border-slate-300 relative group transition-all hover:bg-slate-50">
               <div className={`absolute top-0 left-0 w-1.5 h-full ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-900' : 'bg-yellow-500'}`}></div>
               
               <button 
                 onClick={() => onRemoveQuestion(i)}
                 className="absolute top-6 right-6 w-8 h-8 rounded-sm bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center border border-slate-200 z-10"
                 title="Xóa"
               >
                  <i className="fas fa-times text-xs"></i>
               </button>

               <div className="flex items-center gap-3 mb-6">
                  <span className="bg-slate-900 text-white px-2 py-1 rounded-sm text-[9px] font-black uppercase tracking-tighter">IDX-{i+1}</span>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-widest border ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                      {q.type === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm' : 'Tự luận'}
                  </span>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 border border-slate-200 rounded-sm italic">{q.bloomLevel}</span>
                  <span className="text-[9px] font-bold text-blue-900 bg-blue-50/50 px-2 py-1 border border-blue-900/20 rounded-sm flex items-center gap-1.5 ml-auto">
                    <i className="fas fa-folder-open text-[10px]"></i> {q.folder || "Mặc định"}
                  </span>
               </div>

               <div className="mb-6">
                   <textarea 
                      title="Nội dung câu hỏi"
                      value={q.content}
                      onChange={(e) => onUpdateQuestion(i, { ...q, content: e.target.value })}
                      className="w-full bg-transparent border-none font-bold text-slate-800 text-lg leading-relaxed outline-none focus:ring-0 resize-none p-0 custom-scrollbar mb-2"
                      rows={2}
                   />
                   <div className="text-[10px] text-slate-400 font-medium italic border-l-2 border-slate-200 pl-3">
                     Preview: {formatContent(q.content)}
                   </div>
               </div>

               <div className="mb-6 flex gap-4 items-start">
                   {displayImage && (
                      <div className="relative inline-block group/img shrink-0">
                         <img src={displayImage} alt="Minh họa" className="max-h-32 rounded-sm border border-slate-300 object-contain bg-white p-1" />
                         <button 
                             title="Xóa ảnh minh họa"
                             onClick={() => handleRemoveImage(i)}
                             className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-sm flex items-center justify-center hover:scale-110 transition-transform"
                         >
                             <i className="fas fa-times text-[10px]"></i>
                         </button>
                      </div>
                   )}
                   <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-slate-200 rounded-sm bg-slate-50 text-slate-400 hover:border-blue-900 hover:text-blue-900 transition-all cursor-pointer text-[10px] font-bold uppercase tracking-widest text-center px-4">
                        <div className="space-y-2">
                            <i className="fas fa-camera text-xl"></i>
                            <p>{displayImage ? "Đổi ảnh" : "Thêm ảnh"}</p>
                        </div>
                        <input title="Chọn ảnh minh họa" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e, i)} />
                   </label>
               </div>

               {q.options && q.type === QuestionType.MULTIPLE_CHOICE ? (
                 <div className="space-y-2">
                    <p className="text-[10px] font-bold text-blue-900 uppercase tracking-widest mb-3 italic">Phương án trả lời:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options.map((opt, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center gap-3 p-2 border rounded-sm transition-all ${opt === q.correctAnswer ? 'bg-blue-50 border-blue-900 text-blue-900 font-black' : 'bg-white border-slate-200 text-slate-600'}`}
                        >
                            <input 
                              type="radio" 
                              name={`correct-ans-${i}`}
                              checked={opt === q.correctAnswer}
                              onChange={() => onUpdateQuestion(i, { ...q, correctAnswer: opt })}
                              className="w-4 h-4 text-blue-900 focus:ring-blue-900"
                              title="Chọn làm đáp án đúng"
                            />
                            <input 
                              title={`Nội dung phương án ${String.fromCharCode(65+idx)}`}
                              value={opt}
                              onChange={(e) => {
                                  const newOpts = [...(q.options || [])];
                                  newOpts[idx] = e.target.value;
                                  onUpdateQuestion(i, { ...q, options: newOpts, correctAnswer: opt === q.correctAnswer ? e.target.value : q.correctAnswer });
                              }}
                              className="bg-transparent border border-slate-300 w-full p-2 rounded-sm focus:ring-1 focus:ring-blue-900 outline-none text-xs"
                            />
                        </div>
                        ))}
                    </div>
                 </div>
               ) : (
                 <div className="bg-slate-50 p-6 rounded-sm border border-slate-300 border-l-4 border-l-yellow-500">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 italic">Đáp án chuẩn / Hướng dẫn chấm</p>
                    <textarea 
                      title="Đáp án chuẩn / Hướng dẫn chấm"
                      value={q.correctAnswer}
                      onChange={(e) => onUpdateQuestion(i, { ...q, correctAnswer: e.target.value })}
                      className="w-full bg-transparent border-none text-slate-700 text-sm leading-relaxed font-bold focus:ring-0 resize-none p-0 custom-scrollbar"
                      rows={3}
                    />
                 </div>
               )}
               
               <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-3">
                   <i className="fas fa-comment-dots text-slate-300 text-sm"></i>
                   <input 
                      title="Lời giải thích / Ghi chú"
                      value={q.explanation || ''}
                      onChange={(e) => onUpdateQuestion(i, { ...q, explanation: e.target.value })}
                      placeholder="Nhập giải thích hoặc ghi chú..."
                      className="w-full bg-transparent border-none text-[10px] text-slate-500 font-medium italic focus:ring-0 p-0"
                   />
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewList;
