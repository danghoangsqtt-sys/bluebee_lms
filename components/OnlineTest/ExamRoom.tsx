import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { submitExamResult, fetchLatestExamAttempt, updateExamResult } from '../../services/databaseService';

const MathContent = ({ content }: { content: string }) => {
    return (
        <div className="prose prose-slate max-w-none">
            <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default function ExamRoom({ exam, questions, answerData, user, onExit }: { exam: any, questions: any[], answerData: any, user: any, onExit: () => void }) {
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isTimeInitialized, setIsTimeInitialized] = useState(false);
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const timerEndTimeRef = useRef<number | null>(null);
    
    // Đã thay đổi: Record<string, string> theo ID câu hỏi thay vi index
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [flags, setFlags] = useState<Set<string>>(new Set());
    const [cheatCount, setCheatCount] = useState<number>(0);
    
    // Refs to avoid stale closures in intervals/listeners
    const answersRef = useRef<Record<string, string>>({});
    const flagsRef = useRef<Set<string>>(new Set());
    const cheatCountRef = useRef<number>(0);
    // Fix C-04: Dùng ref cho viewMode để tránh stale closure trong timer
    const viewModeRef = useRef<'TESTING' | 'REVIEW' | 'RESULT'>('TESTING');
    // Fix L-03: Dùng ReturnType<typeof setTimeout> thay vì NodeJS.Timeout
    const antiCheatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync refs with state
    useEffect(() => { answersRef.current = answers; }, [answers]);
    useEffect(() => { flagsRef.current = flags; }, [flags]);
    useEffect(() => { cheatCountRef.current = cheatCount; }, [cheatCount]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const startTimeRef = useRef(Date.now());
    const [viewMode, setViewMode] = useState<'TESTING' | 'REVIEW' | 'RESULT'>('TESTING');
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [correctCount, setCorrectCount] = useState<number>(0);

    // Fix C-04: Cập nhật viewModeRef mỗi khi viewMode thay đổi
    useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 5000);
    };

    useEffect(() => {
        const initRoom = async () => {
            try {
                const latestAttempt = await fetchLatestExamAttempt(exam.id, user.id);
                if (latestAttempt && (latestAttempt.status === 'in_progress' || latestAttempt.status === 'disconnected')) {
                    setAttemptId(latestAttempt.id);
                    const initTimeRemaining = latestAttempt.remainingTime !== undefined && latestAttempt.remainingTime !== null 
                        ? latestAttempt.remainingTime 
                        : (exam.duration || 60) * 60;
                    
                    setTimeLeft(initTimeRemaining);
                    timerEndTimeRef.current = Date.now() + (initTimeRemaining * 1000);

                    if (latestAttempt.savedAnswers) {
                        try {
                            setAnswers(JSON.parse(latestAttempt.savedAnswers));
                        } catch(e) {}
                    }
                    setIsTimeInitialized(true);
                    
                    if (latestAttempt.status === 'disconnected') {
                        updateExamResult(latestAttempt.id, { status: 'in_progress' }).catch(console.error);
                    }
                } else {
                    const durationTime = (exam.duration || 60) * 60;
                    setTimeLeft(durationTime);
                    timerEndTimeRef.current = Date.now() + (durationTime * 1000);
                    setIsTimeInitialized(true);
                    
                    const newAttempt = await submitExamResult({
                        exam_id: exam.id,
                        student_id: user.id,
                        status: 'in_progress',
                        remainingTime: durationTime,
                        savedAnswers: '{}',
                        score: 0,
                        answers_data: '',
                        answeredCount: 0,
                        redFlags: 0
                    });
                    setAttemptId(newAttempt.$id || newAttempt.id);
                }
            } catch (err) {
                console.error("Lỗi khởi tạo phòng thi:", err);
                const durationTime = (exam.duration || 60) * 60;
                setTimeLeft(durationTime);
                timerEndTimeRef.current = Date.now() + (durationTime * 1000);
                setIsTimeInitialized(true);
            }
        };
        initRoom();
    }, [exam, user]);

    // Fix C-04: Timer effect dùng ref thay vì closure để tránh stale viewMode
    useEffect(() => {
        if (!isTimeInitialized || !timerEndTimeRef.current) return;
        
        const timerCounter = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((timerEndTimeRef.current! - now) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(timerCounter);
                // Fix C-04: Dùng ref để đọc viewMode mới nhất, tránh stale closure
                if (viewModeRef.current !== 'RESULT') {
                    handleAutoSubmit();
                }
            }
        }, 1000);
        return () => clearInterval(timerCounter);
    }, [isTimeInitialized]); // Fix C-04: Bỏ viewMode khỏi dependency, dùng ref thay thế

    // Update Auto-save độc lập, sử dụng debounce timeout riêng
    useEffect(() => {
        if (!attemptId || !isTimeInitialized || Object.keys(answers).length === 0) return;
        
        // Luôn lưu nháp vào Local Storage
        localStorage.setItem(`bluebee_exam_${exam.id}_${user.id}`, JSON.stringify({
            examId: exam.id,
            studentId: user.id,
            answers
        }));

        // Bỏ qua nếu đang offline
        if (!navigator.onLine) return;

        const saveAnswers = setTimeout(() => {
            updateExamResult(attemptId, {
                savedAnswers: JSON.stringify(answersRef.current),
                remainingTime: timeLeft,
                answeredCount: Object.keys(answersRef.current).length,
                redFlags: flagsRef.current.size + cheatCountRef.current
            }).catch(e => console.warn(e));
        }, 5000); // Giảm xuống 5s hoặc tuỳ ý hệ thống, để tránh spam
        return () => clearTimeout(saveAnswers);
    }, [answers, flags, cheatCount, timeLeft, attemptId, isTimeInitialized]);

    // Fix C-05: Tách anti-cheat effect họan toàn khỏi timeLeft,
    // và fix double-counting (blur + visibilitychange cùng xảy ra)
    useEffect(() => {
        if (!attemptId || viewMode !== 'TESTING') return;

        const handleOffline = () => {
             showToast("Trạng thái: Offline - Đáp án đang được lưu tạm trên máy");
        };

        const handleOnline = () => {
             showToast("Trạng thái: Online - Đang đồng bộ dữ liệu...");
             const localData = localStorage.getItem(`bluebee_exam_${exam.id}_${user.id}`);
             let syncAnswers = answersRef.current;
             if (localData) {
                 try {
                     const parsed = JSON.parse(localData);
                     if (parsed && parsed.answers) syncAnswers = parsed.answers;
                 } catch (e) {}
             }
             updateExamResult(attemptId, { 
                 status: 'in_progress',
                 savedAnswers: JSON.stringify(syncAnswers)
             }).catch(e => {});
        };

        const handleBeforeUnload = () => {
            if (navigator.onLine) {
                 updateExamResult(attemptId, { status: 'disconnected', remainingTime: timerEndTimeRef.current 
                    ? Math.max(0, Math.floor((timerEndTimeRef.current - Date.now()) / 1000))
                    : 0 
                 }).catch(e => {});
            }
        };

        const debouncedCheatUpdate = (newTotalRedFlags: number) => {
            if (!navigator.onLine) return;
            if (antiCheatTimeoutRef.current) clearTimeout(antiCheatTimeoutRef.current);
            antiCheatTimeoutRef.current = setTimeout(() => {
                updateExamResult(attemptId, { 
                    status: 'warning_tab_switch', 
                    redFlags: newTotalRedFlags
                }).catch(e => { console.error(e); });
            }, 5000);
        };

        // Fix C-05: Chỉ dùng visibilitychange, bỏ blur để tránh double-counting
        // (blur thường fire trước visibilitychange khi alt-tab)
        const handleVisibilityChange = () => {
             if (exam.exam_purpose === 'self_study') return;
             if (document.hidden) {
                  setCheatCount(prev => {
                      const newCount = prev + 1;
                      cheatCountRef.current = newCount;
                      debouncedCheatUpdate(flagsRef.current.size + newCount);
                      return newCount;
                  });
             } else {
                  if (navigator.onLine) updateExamResult(attemptId, { status: 'in_progress' }).catch(e => {});
             }
        };

        // Fix C-05: handleFocus khi user bấm vào lại cửa sổ, không cần đếm vi phạm
        const handleFocus = () => {
             if (exam.exam_purpose === 'self_study') return;
             if (navigator.onLine) updateExamResult(attemptId, { status: 'in_progress' }).catch(e => {});
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        // Fix C-05: Không có blur listener nữa (tránh double-counting với visibilitychange)
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            if (antiCheatTimeoutRef.current) clearTimeout(antiCheatTimeoutRef.current);
        };
    // Fix C-05: Loại timeLeft khỏi dependencies - dùng ref thay thế để tránh re-register mỗi giây
    }, [attemptId, viewMode, exam, user]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleSelectOption = (qId: string, optionLetter: string, syncImmediately: boolean = false) => {
        setAnswers(prev => {
            const newAnswers = { ...prev, [qId]: optionLetter };
            const currentAnsweredCount = Object.keys(newAnswers).length;

            if (syncImmediately && attemptId) {
                updateExamResult(attemptId, {
                    savedAnswers: JSON.stringify(newAnswers),
                    remainingTime: timeLeft,
                    answeredCount: currentAnsweredCount,
                    redFlags: flags.size + cheatCount
                }).catch(e => console.warn(e));
            }

            return newAnswers;
        });
    };

    const toggleFlag = (qId: string) => {
        setFlags(prev => {
            const newFlags = new Set(prev);
            if (newFlags.has(qId)) newFlags.delete(qId);
            else newFlags.add(qId);
            return newFlags;
        });
    };

    const scrollToQuestion = (qId: string) => {
        const el = document.getElementById(`question-${qId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleGoToReview = () => {
        setViewMode('REVIEW');
    };

    const submitFinalExam = async () => {
        setIsSubmitting(true);
        let correct = 0;
        let answersDetail: Record<string, {
            s: string;
            c: string;
            k: boolean;
        }> = {};

        questions.forEach((q, idx) => {
            const qKey = q.id || `q-${idx}`;
            const studentAns = answersRef.current[qKey];
            
            // Lấy object correct answer chứa correctLetter, content, explanation
            const correctAnswerObj = answerData[qKey];
            const correctAnsLetter = correctAnswerObj?.correctLetter;
            
            let isItemCorrect: boolean | null = false;

            if (q.type === 'MULTIPLE_CHOICE') {
                if (studentAns && studentAns === correctAnsLetter) {
                    correct++;
                    isItemCorrect = true;
                }
            } else if (q.type === 'ESSAY') {
                // Tự luận thì chưa chấm điểm ngay lập tức, cần giáo viên chấm sau
                isItemCorrect = null;
            }
            
            answersDetail[qKey] = {
                s: studentAns || '',
                c: correctAnsLetter || '',
                k: isItemCorrect !== null ? isItemCorrect : (false as any)
            };
            
            // Chỉnh lại chuẩn nếu DB không nhận null
            if (isItemCorrect === null) {
                // @ts-ignore : Chấp nhận lỗi type để ghi đè log
                answersDetail[qKey].k = 'pending';
            }
        });

        // Đề phòng trường hợp lỗi chia cho 0 nếu đề không có câu hỏi nào
        const calculatedScore = questions.length > 0 ? (correct / questions.length) * 10 : 0;
        setCorrectCount(correct);
        setFinalScore(calculatedScore);

        try {
            const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const compressedData = JSON.stringify({
                student_name: user.fullName || user.name || 'Học viên',
                correct_answers: correct,
                total_questions: questions.length,
                time_spent: timeSpent,
                answers: answers,
                answers_detail: answersDetail
            }).substring(0, 16000000);

            const payload = {
                score: parseFloat(calculatedScore.toFixed(2)),
                answers_data: compressedData,
                status: 'submitted',
                remainingTime: timeLeft,
                savedAnswers: "",
                answeredCount: Object.keys(answersRef.current).length,
                redFlags: Math.max(0, flagsRef.current.size + cheatCountRef.current)
            };

            if (attemptId) {
                await updateExamResult(attemptId, payload);
            } else {
                await submitExamResult({
                    exam_id: exam.id,
                    student_id: user.id,
                    ...payload
                });
            }
            
            // Chuyển sang màn hình Kết quả thay vì dùng alert
            setViewMode('RESULT');
        } catch (error) {
            console.error("Lỗi nộp bài:", error);
            alert("Lỗi nộp bài do cấu trúc dữ liệu Appwrite. Vui lòng thử lại!");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Auto submit khi hết giờ
    const handleAutoSubmit = () => {
        if (viewMode !== 'RESULT' && !isSubmitting) submitFinalExam();
    };

    if (viewMode === 'REVIEW') {
        const answeredCount = Object.keys(answers).length;
        const unansweredCount = questions.length - answeredCount;

        return (
            <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto">
                <div className="max-w-3xl mx-auto my-10 p-8 bg-white rounded-sm shadow-xl border border-slate-300">
                    <h2 className="text-3xl font-black text-blue-900 text-center mb-2">XÁC NHẬN NỘP BÀI</h2>
                    <p className="text-center text-slate-500 mb-8 font-medium">Bạn có chắc chắn muốn nộp bài thi lúc này?</p>
                    
                    <div className="grid grid-cols-2 gap-6 mb-10">
                        <div className="bg-blue-50 p-6 rounded-sm border border-blue-200 text-center">
                            <h3 className="text-4xl font-black text-blue-900 mb-1">{answeredCount}</h3>
                            <p className="text-sm font-bold text-green-700 uppercase">Câu đã trả lời</p>
                        </div>
                        <div className={`p-6 rounded-sm border text-center ${unansweredCount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                            <h3 className={`text-4xl font-black mb-1 ${unansweredCount > 0 ? 'text-red-600' : 'text-slate-600'}`}>{unansweredCount}</h3>
                            <p className={`text-sm font-bold uppercase ${unansweredCount > 0 ? 'text-red-500' : 'text-slate-500'}`}>Câu bỏ trống</p>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button 
                            onClick={() => setViewMode('TESTING')} 
                            disabled={isSubmitting}
                            className="px-8 py-4 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-sm font-bold uppercase tracking-widest transition-all"
                        >
                            Quay lại làm tiếp
                        </button>
                        <button 
                            onClick={submitFinalExam} 
                            disabled={isSubmitting}
                            className="px-8 py-4 bg-blue-900 hover:bg-blue-800 text-white rounded-sm font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
                        >
                            {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                            NỘP BÀI CHÍNH THỨC
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'RESULT') {
        return (
            <div className="fixed inset-0 bg-slate-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white p-10 rounded-sm max-w-md w-full shadow-2xl border border-slate-300 text-center animate-fade-in-up">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-check text-5xl"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Tuyệt vời! Bạn đã hoàn thành bài thi.</h2>
                    <p className="text-slate-500 mb-8 font-medium">Kết quả của bạn đã được ghi nhận vào hệ thống.</p>
                    
                    <div className="bg-slate-50 rounded-sm p-6 mb-8 border border-slate-300">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Điểm số</p>
                        <p className="text-6xl font-black text-blue-900">{finalScore?.toFixed(2)}</p>
                        <p className="text-sm font-bold text-slate-500 mt-2">Đúng {correctCount} / {questions.length} câu</p>
                    </div>

                    <button 
                        onClick={onExit} 
                        className="w-full py-4 bg-blue-900 hover:bg-blue-800 text-white rounded-sm font-black uppercase tracking-widest transition-all shadow-lg"
                    >
                        Quay lại trang chủ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col md:flex-row overflow-hidden">
            {toastMessage && (
                <div className="fixed top-4 right-4 bg-amber-500 text-white px-6 py-3 rounded shadow-lg z-[200] font-bold animate-fade-in-down">
                    <i className="fas fa-exclamation-circle mr-2"></i> {toastMessage}
                </div>
            )}
            {/* Cột trái: Danh sách câu hỏi cuộn */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth">
                <div className="max-w-3xl mx-auto space-y-6 pb-20">
                    <h1 className="text-2xl font-black text-blue-900 text-center mb-8 bg-white p-4 rounded-sm shadow-sm border border-slate-300">
                        BÀI THI: {exam.title}
                    </h1>
                    
                    {questions.map((q, index) => {
                        const qId = q.id || `q-${index}`;
                        return (
                        <div key={qId} id={`question-${qId}`} className="bg-white p-6 rounded-sm shadow-sm border border-slate-300">
                            <div className="flex justify-between items-start mb-4">
                                <span className="font-bold text-lg text-slate-800">Câu {index + 1}:</span>
                                <button 
                                    onClick={() => toggleFlag(qId)}
                                    className={`transition-colors ${flags.has(qId) ? 'text-red-500' : 'text-slate-300 hover:text-red-300'}`}
                                    title="Cắm cờ đánh dấu câu này"
                                >
                                    <i className="fas fa-flag text-xl"></i>
                                </button>
                            </div>
                            <div className="text-slate-700 mb-4 text-base">
                                <MathContent content={q.content} />
                            </div>
                            
                            {q.imageUrl && (
                                <img src={q.imageUrl} alt="Hình minh họa" className="max-h-48 mb-4 object-contain rounded" />
                            )}

                    {/* Render Giao diện tùy theo Loại câu hỏi */}
                    {q.type === 'ESSAY' ? (
                        <div className="mt-4">
                            <textarea
                                value={answers[qId] || ''}
                                onChange={(e) => handleSelectOption(qId, e.target.value)}
                                placeholder="Nhập câu trả lời tự luận của bạn vào đây..."
                                className="w-full h-40 p-4 border border-slate-300 rounded-sm outline-none focus:border-blue-900 focus:ring-4 focus:ring-blue-50 transition-all font-medium text-slate-700 bg-slate-50"
                            />
                            <p className="text-right text-[10px] text-slate-400 mt-1 font-bold">Hệ thống tự động lưu nháp <i className="fas fa-save ml-1"></i></p>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {q.options?.map((opt: string, oIdx: number) => {
                                const optionLetter = String.fromCharCode(65 + oIdx);
                                const isSelected = answers[qId] === optionLetter;
                                // Tự động loại bỏ chữ "A. " "B. " ở đầu do Word trích ra để giao diện đẹp hơn
                                const cleanOpt = opt.replace(/^[A-Z][\.\:\)]\s*/i, '');
                                return (
                                    <label key={oIdx} className={`flex items-center gap-3 p-4 rounded-sm border cursor-pointer transition-all ${isSelected ? 'border-blue-900 bg-blue-50 shadow-sm' : 'border-slate-300 bg-white hover:border-blue-200'}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {optionLetter}
                                        </div>
                                        <div className="font-medium text-slate-700 select-none flex-1">
                                            <MathContent content={cleanOpt} />
                                        </div>
                                        <input type="radio" name={`q-${qId}`} className="hidden" checked={isSelected} onChange={() => handleSelectOption(qId, optionLetter, true)} />
                                    </label>
                                );
                            })}
                        </div>
                    )}
                        </div>
                        );
                    })}
                </div>
            </div>

            {/* Cột phải: Lưới điều hướng & Nộp bài */}
            <div className="w-full md:w-80 bg-white border-l border-slate-200 p-6 flex flex-col shrink-0">
                <div className="text-center mb-6">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Thời gian còn lại</p>
                    <div className={`text-3xl font-black font-mono ${timeLeft < 300 ? 'text-red-700 animate-pulse' : 'text-blue-900'}`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar mb-6">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">Danh sách câu hỏi</p>
                    <div className="grid grid-cols-5 gap-2">
                        {questions.map((q, index) => {
                            const qId = q.id || String(index);
                            const isAnswered = !!answers[qId];
                            const isFlagged = flags.has(qId);
                            return (
                                <button 
                                    key={qId}
                                    onClick={() => scrollToQuestion(qId)}
                                    className={`relative h-10 w-full rounded-sm font-bold text-sm transition-all border ${
                                        isAnswered 
                                            ? 'bg-blue-900 text-white border-blue-900' 
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    {index + 1}
                                    {isFlagged && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* Chú giải */}
                    <div className="mt-6 space-y-2 text-xs text-slate-600">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded"></div> Đã trả lời</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 border border-slate-300 rounded"></div> Chưa trả lời</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Đặt cờ đánh dấu</div>
                    </div>
                </div>

                <button 
                    onClick={handleGoToReview} 
                    disabled={isSubmitting}
                    className="w-full py-4 bg-blue-900 hover:bg-blue-800 text-white rounded-sm font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2"
                >
                    {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                    Nộp Bài Ngay
                </button>
            </div>
        </div>
    );
}
