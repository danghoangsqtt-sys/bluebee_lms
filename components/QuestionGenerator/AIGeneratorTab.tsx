import React, { useEffect, useMemo, useRef, useState } from "react";
import { ID } from "../../lib/appwrite";
import { extractTextFromPDF } from "../../services/documentProcessor";
import { generateQuestionsByAI } from "../../services/geminiService";
import { Question, QuestionFolder, QuestionType } from "../../types";
import ReviewList from "./ReviewList";

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

const BLOOM_LEVELS = ["Nhận biết", "Thông hiểu", "Vận dụng", "Phân tích", "Đánh giá", "Sáng tạo"];

const BLOOM_COLORS: Record<string, { border: string; label: string; input: string; bg: string }> = {
  "Nhận biết": { border: "border-blue-300", label: "text-blue-600", input: "text-blue-800", bg: "bg-blue-50" },
  "Thông hiểu": { border: "border-teal-300", label: "text-teal-600", input: "text-teal-800", bg: "bg-teal-50" },
  "Vận dụng": { border: "border-green-300", label: "text-green-600", input: "text-green-800", bg: "bg-green-50" },
  "Phân tích": { border: "border-amber-300", label: "text-amber-600", input: "text-amber-800", bg: "bg-amber-50" },
  "Đánh giá": { border: "border-orange-300", label: "text-orange-600", input: "text-orange-800", bg: "bg-orange-50" },
  "Sáng tạo": { border: "border-purple-300", label: "text-purple-600", input: "text-purple-800", bg: "bg-purple-50" },
};

const DEFAULT_FOLDER = "Mặc định";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeLooseText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

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
  onApproveAll,
}) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [bloomCounts, setBloomCounts] = useState<Record<string, number>>({
    "Nhận biết": 0,
    "Thông hiểu": 0,
    "Vận dụng": 0,
    "Phân tích": 0,
    "Đánh giá": 0,
    "Sáng tạo": 0,
  });
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [targetFolder, setTargetFolder] = useState(DEFAULT_FOLDER);
  const [folderOpen, setFolderOpen] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);

  void examFolders;

  const totalQuestions = Object.values(bloomCounts).reduce((a, b) => a + b, 0);

  const questionFolders = useMemo(() => {
    const folderSet = new Set([DEFAULT_FOLDER, ...availableFolders]);
    return Array.from(folderSet).sort();
  }, [availableFolders]);

  useEffect(() => {
    if (!folderOpen) return;

    const handler = (event: MouseEvent) => {
      if (folderRef.current && !folderRef.current.contains(event.target as Node)) {
        setFolderOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [folderOpen]);

  const normalizeType = (raw: unknown): QuestionType => {
    const normalized = normalizeLooseText(raw);
    return normalized.includes("MULTIPLE") || normalized.includes("TRAC") ? QuestionType.MULTIPLE_CHOICE : QuestionType.ESSAY;
  };

  const normalizeOptions = (raw: unknown) => {
    if (!Array.isArray(raw)) return undefined;
    const cleaned = raw.map(item => String(item || "").trim()).filter(Boolean).slice(0, 4);
    return cleaned.length > 0 ? cleaned : undefined;
  };

  const buildPromptForBloom = (bloomLevel: string, amount: number) =>
    [
      customPrompt ? `Yeu cau bo sung: "${customPrompt}"` : "",
      `Hay tao dung ${amount} cau ${qType === QuestionType.MULTIPLE_CHOICE ? "trac nghiem (MULTIPLE_CHOICE)" : "tu luan (ESSAY)"}.`,
      `Tat ca cau hoi phai co bloomLevel = "${bloomLevel}".`,
      "YEU CAU QUAN TRONG:",
      "1. Noi dung phai bam sat tai lieu da cung cap.",
      "2. Khong lap lai cau hoi hoac y tuong giua cac cau.",
      "3. 'type' bat buoc la 'MULTIPLE_CHOICE' hoac 'ESSAY'.",
      "4. 'category' ngan gon, dung chu de bai hoc.",
      qType === QuestionType.MULTIPLE_CHOICE
        ? "5. Moi cau trac nghiem phai co 4 lua chon ro rang, 1 dap an dung va co giai thich."
        : "5. Cau tu luan phai co 'correctAnswer' day du de dung lam dap an mau.",
      "6. Dung LaTeX cho cong thuc trong dau $.",
      "7. Tra ve dung so luong duoc yeu cau.",
    ]
      .filter(Boolean)
      .join("\n");

  const handleGenerate = async () => {
    if (totalQuestions === 0) return onNotify("Hãy chọn ít nhất 1 mức độ Bloom", "warning");
    if (!pdfFile && !customPrompt.trim()) return onNotify("Hãy tải lên tệp PDF hoặc nhập nội dung gợi ý", "warning");
    if (!targetFolder.trim()) return onNotify("Vui lòng chọn thư mục lưu trữ", "warning");

    setIsLoading(true);
    try {
      let contextText = "";

      if (pdfFile) {
        onNotify("Đang trích xuất nội dung tài liệu...", "info");
        contextText = await extractTextFromPDF(pdfFile);
      }

      const bloomPlan = Object.entries(bloomCounts).filter(([, count]) => count > 0);
      const generatedQuestions: Question[] = [];

      for (let index = 0; index < bloomPlan.length; index++) {
        const [bloomLevel, count] = bloomPlan[index];
        onNotify(`Đang sinh ${count} câu mức ${bloomLevel} (${index + 1}/${bloomPlan.length})...`, "info");

        const rawQuestions = await generateQuestionsByAI(
          buildPromptForBloom(bloomLevel, count),
          count,
          bloomLevel,
          contextText || undefined
        );

        const processed = rawQuestions.slice(0, count).map((question, questionIndex) => {
          const normalizedType = normalizeType(question.type);
          return {
            ...question,
            id: ID.unique(),
            folderId: "default",
            folder: targetFolder,
            createdAt: Date.now() + generatedQuestions.length + questionIndex,
            type: normalizedType,
            options: normalizedType === QuestionType.MULTIPLE_CHOICE ? normalizeOptions(question.options) : undefined,
            bloomLevel,
            category: String(question.category || "AI Generated").trim(),
            correctAnswer: String(question.correctAnswer || "").trim(),
            explanation: String(question.explanation || "").trim(),
          } as Question;
        });

        generatedQuestions.push(...processed);

        if (processed.length < count) {
          onNotify(`AI chỉ sinh được ${processed.length}/${count} câu cho mức ${bloomLevel}.`, "warning");
        }

        if (index < bloomPlan.length - 1) {
          await sleep(1200);
        }
      }

      if (generatedQuestions.length === 0) {
        throw new Error("AI không trả về câu hỏi hợp lệ.");
      }

      onQuestionsGenerated(generatedQuestions);

      if (generatedQuestions.length < totalQuestions) {
        onNotify(`Đã sinh ${generatedQuestions.length}/${totalQuestions} câu. Bạn có thể chạy thêm để bổ sung phần còn thiếu.`, "warning");
      } else {
        onNotify("AI đã biên soạn đề thi thành công!", "success");
      }
    } catch (error: any) {
      onNotify(error?.message || "Lỗi xử lý AI. Vui lòng kiểm tra lại kết nối.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fileSizeLabel = pdfFile
    ? pdfFile.size > 1048576
      ? `${(pdfFile.size / 1048576).toFixed(1)} MB`
      : `${(pdfFile.size / 1024).toFixed(0)} KB`
    : null;

  return (
    <div className="grid h-full grid-cols-1 gap-0 overflow-hidden lg:grid-cols-12">
      <aside className="flex h-full flex-col overflow-hidden border-r border-slate-200 lg:col-span-5">
        <div className="flex shrink-0 items-center justify-between bg-slate-900 px-6 py-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-yellow-500">AI Studio</p>
            <h3 className="mt-0.5 text-sm font-black uppercase tracking-widest text-white">Biên soạn tự động</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isLoading ? "animate-pulse bg-yellow-400" : "bg-emerald-400"}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{isLoading ? "Processing" : "Ready"}</span>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50">
          <div className="space-y-5 p-5">
            <section>
              <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                <i className="fas fa-file-pdf mr-1.5 text-red-500" />
                Nguồn tri thức
              </label>
              <label
                className={`group relative block cursor-pointer rounded-sm border-2 border-dashed transition-all ${
                  pdfFile ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white hover:border-blue-900/40 hover:bg-slate-50"
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  title="Tải giáo trình PDF"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={event => setPdfFile(event.target.files?.[0] || null)}
                />
                <div className="px-4 py-6 text-center">
                  {pdfFile ? (
                    <>
                      <i className="fas fa-file-circle-check mb-2 block text-2xl text-emerald-500" />
                      <p className="truncate px-2 text-xs font-black text-emerald-700">{pdfFile.name}</p>
                      <span className="mt-1.5 inline-block rounded-sm bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-500">
                        {fileSizeLabel} · Nhấp để thay thế
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt mb-2 block text-2xl text-slate-300 transition-colors group-hover:text-blue-900/30" />
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Kéo thả hoặc nhấp để chọn PDF</p>
                      <p className="mt-1 text-[9px] text-slate-300">Tối đa 50MB · Toàn bộ nội dung được xử lý</p>
                    </>
                  )}
                </div>
              </label>
            </section>

            <section>
              <label htmlFor="ai-prompt" className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                <i className="fas fa-comment-dots mr-1.5 text-blue-900" />
                Gợi ý AI <span className="normal-case font-medium text-slate-400">(tuỳ chọn)</span>
              </label>
              <textarea
                id="ai-prompt"
                value={customPrompt}
                onChange={event => setCustomPrompt(event.target.value)}
                placeholder="Ví dụ: Tập trung chương 2, ưu tiên an toàn điện, tránh lý thuyết thuần tuý..."
                className="h-20 w-full resize-none rounded-sm border border-slate-300 bg-white p-3 text-xs font-medium outline-none transition-all placeholder:text-slate-300 focus:border-blue-900"
              />
            </section>

            <section>
              <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                <i className="fas fa-folder-open mr-1.5 text-yellow-500" />
                Thư mục câu hỏi
              </label>
              <div ref={folderRef} className="relative">
                <button
                  type="button"
                  onClick={() => setFolderOpen(value => !value)}
                  className="flex w-full items-center justify-between rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:border-blue-900"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <i className="fas fa-folder shrink-0 text-xs text-yellow-500" />
                    <span className="truncate">{targetFolder}</span>
                  </div>
                  <i className={`fas fa-chevron-down shrink-0 text-xs text-slate-400 transition-transform ${folderOpen ? "rotate-180" : ""}`} />
                </button>
                {folderOpen && (
                  <div className="custom-scrollbar absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-sm border border-slate-300 bg-white shadow-xl">
                    {questionFolders.map((folderName, index) => (
                      <button
                        type="button"
                        key={index}
                        onClick={() => {
                          setTargetFolder(folderName);
                          setFolderOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
                          targetFolder === folderName ? "bg-blue-900 font-bold text-white" : "font-medium text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <i className={`fas fa-folder text-xs ${targetFolder === folderName ? "text-yellow-300" : "text-yellow-500"}`} />
                        <span className="flex-1 truncate">{folderName}</span>
                        {targetFolder === folderName && <i className="fas fa-check shrink-0 text-xs" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section>
              <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                <i className="fas fa-list-check mr-1.5 text-blue-900" />
                Loại câu hỏi
              </label>
              <div className="flex overflow-hidden rounded-sm border border-slate-300 bg-white">
                {[
                  { value: QuestionType.MULTIPLE_CHOICE, icon: "fa-circle-dot", label: "Trắc nghiệm" },
                  { value: QuestionType.ESSAY, icon: "fa-pen-nib", label: "Tự luận" },
                ].map(({ value, icon, label }) => (
                  <React.Fragment key={value}>
                    <button
                      type="button"
                      onClick={() => setQType(value)}
                      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                        qType === value ? "bg-blue-900 text-white" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      }`}
                    >
                      <i className={`fas ${icon} text-xs`} />
                      {label}
                    </button>
                    {value === QuestionType.MULTIPLE_CHOICE && <div className="w-px bg-slate-200" />}
                  </React.Fragment>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <i className="fas fa-chart-bar mr-1.5 text-blue-900" />
                  Ma trận Bloom
                </label>
                {totalQuestions > 0 && (
                  <span className="rounded-sm border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-black text-blue-900">
                    Tổng {totalQuestions} câu
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {BLOOM_LEVELS.map(level => {
                  const color = BLOOM_COLORS[level];
                  return (
                    <div key={level} className={`rounded-sm border p-2.5 transition-all focus-within:shadow-sm ${color.bg} ${color.border}`}>
                      <p className={`mb-1.5 truncate text-center text-[8px] font-black uppercase ${color.label}`}>{level}</p>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        title={`Số câu ${level}`}
                        value={bloomCounts[level]}
                        onChange={event =>
                          setBloomCounts({
                            ...bloomCounts,
                            [level]: parseInt(event.target.value, 10) || 0,
                          })
                        }
                        className={`w-full bg-transparent text-center text-base font-black outline-none ${color.input}`}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || totalQuestions === 0}
            className={`flex w-full items-center justify-center gap-3 rounded-sm py-3.5 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${
              isLoading || totalQuestions === 0
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-blue-900 text-white shadow-md shadow-blue-900/20 hover:bg-slate-800"
            }`}
          >
            {isLoading ? (
              <>
                <i className="fas fa-circle-notch fa-spin" />
                Đang phân tích tài liệu...
              </>
            ) : (
              <>
                <i className="fas fa-wand-magic-sparkles" />
                AI biên soạn ngay ({totalQuestions} câu)
              </>
            )}
          </button>
          <p className="text-center text-[8px] text-slate-400">
            <i className="fas fa-lock mr-1" />
            PDF xử lý cục bộ · Gemini có fallback nhẹ · Request được chia lô theo Bloom
          </p>
        </div>
      </aside>

      <main className="flex h-full flex-col overflow-hidden bg-white lg:col-span-7">
        {pendingQuestions.length === 0 ? (
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            <div className="flex flex-col items-center px-10 pb-8 pt-14">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-sm bg-slate-100">
                <i className="fas fa-wand-magic-sparkles text-2xl text-slate-300" />
              </div>
              <p className="mb-1.5 text-sm font-black uppercase tracking-widest text-slate-400">Chờ kết quả AI</p>
              <p className="mb-8 max-w-xs text-center text-[10px] leading-relaxed text-slate-300">
                Tải lên giáo trình PDF, thiết lập ma trận Bloom rồi nhấn <strong className="font-black text-slate-400">AI biên soạn ngay</strong> để bắt đầu.
              </p>

              <div className="w-full max-w-sm space-y-2">
                {[
                  { icon: "fa-file-pdf", color: "text-red-400", bg: "bg-red-50", step: "01", label: "Tải lên giáo trình PDF", desc: "Hỗ trợ tài liệu tới 50MB" },
                  { icon: "fa-chart-bar", color: "text-blue-500", bg: "bg-blue-50", step: "02", label: "Thiết lập ma trận Bloom", desc: "6 mức độ nhận thức" },
                  { icon: "fa-wand-magic-sparkles", color: "text-yellow-500", bg: "bg-yellow-50", step: "03", label: "AI tự động biên soạn đề", desc: "Request chia nhỏ để ổn định hơn" },
                  { icon: "fa-list-check", color: "text-emerald-500", bg: "bg-emerald-50", step: "04", label: "Kiểm duyệt và phê duyệt", desc: "Chỉnh sửa trước khi lưu" },
                ].map(({ icon, color, bg, step, label, desc }) => (
                  <div key={step} className="flex items-center gap-4 rounded-sm border border-slate-100 bg-slate-50 p-3.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm ${bg}`}>
                      <i className={`fas ${icon} ${color} text-sm`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase text-slate-300">{step}</span>
                        <p className="truncate text-xs font-black text-slate-600">{label}</p>
                      </div>
                      <p className="text-[9px] font-medium text-slate-400">{desc}</p>
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
