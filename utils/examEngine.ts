
import { Question, QuestionType } from '../types';

/**
 * Fisher-Yates Shuffle Algorithm
 * Randomizes an array in-place (O(n) complexity).
 */
export const shuffleArray = <T>(array: T[]): T[] => {
    const clone = [...array];
    for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
};

/**
 * Fix H-02: Helper to remove prefixes like "A. ", "B)", "C: " from strings
 * Chỉ strip nếu pattern hợp lệ: chữ cái đơn + dấu phân cách + khoảng trắng
 * Không strip nếu là từ thửng ("Áp dụng", "Analysis"...)
 */
const stripPrefix = (text: string): string => {
    if (!text) return '';
    // Chỉ strip khi có đúng pattern: [A-F]. hoặc [A-F]) hoặc [A-F]: + khoảng trắng
    // Regex này đảm bảo không cắt nhầm từ như "Áp dụng" hay "Always"
    return text.replace(/^([A-F])([\.\:\)])\s+/i, '').trim();
};

export interface AnswerEntry {
    correctLetter: string;
    content: string;
    explanation: string;
}

export interface GeneratedExamData {
    examQuestions: any[];
    answerData: Record<string, AnswerEntry>;
    examCode: string;
}

/**
 * Generates a complete exam paper with shuffled questions and shuffled options.
 * @param sourceQuestions List of available questions
 * @param count Number of questions to select
 * @param examCode The exam code identifier
 */
import { ID } from '../lib/appwrite';

export const generateExamPaper = (sourceQuestions: any[], count: number, examCode: string, shuffleQ: boolean = true, shuffleO: boolean = true): GeneratedExamData => {
    const selected = shuffleQ ? shuffleArray(sourceQuestions).slice(0, count) : [...sourceQuestions].slice(0, count);
    const finalQuestions: any[] = [];
    
    // answerData chứa nhiều thông tin hơn (Chữ cái, Nội dung, Giải thích)
    const answerData: Record<string, AnswerEntry> = {};

    selected.forEach((qItem, index) => {
        // Deep clone tuyệt đối để tránh mutation lên state gốc hoặc cache
        const qClone = JSON.parse(JSON.stringify(qItem));
        const q = { ...qClone, id: qClone.$id || qClone.id || `q-${index}` };
        const qKey = q.id;

        if (q.type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
            const rawCorrect = (q.correctAnswer || '').trim();
            // Fix H-02: Dùng stripPrefix để clean options nhất quán
            const cleanOptions = q.options.map((opt: any) => stripPrefix(String(opt)));
            
            // Xác định nội dung đáp án đúng:
            let correctContent = '';
            const letterMatch = rawCorrect.match(/^([A-D])[\.\:\)]?\s*$/i);
            let correctIndexInOriginal = -1;
            
            if (letterMatch) {
                // Case 1: Chỉ là chữ cái → lấy nội dung từ options theo index
                correctIndexInOriginal = letterMatch[1].toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                correctContent = cleanOptions[correctIndexInOriginal] || '';
            } else {
                // Case 2 & 3: Bỏ prefix nếu có, dùng nội dung gốc
                correctContent = rawCorrect.replace(/^[A-D][\.\:\)]\s*/, '').trim();
                const compareCorrect = correctContent.toLowerCase().replace(/\s+/g, '');
                correctIndexInOriginal = cleanOptions.findIndex((opt: string) => opt.toLowerCase().replace(/\s+/g, '') === compareCorrect);
            }

            // Map each option to an object tracking original index
            const optionsArray: { text: string; originalIndex: number }[] = cleanOptions.map((text: string, originalIndex: number) => ({ text, originalIndex }));

            // Xáo trộn đáp án an toàn bằng object
            const shuffledOptions = shuffleO ? shuffleArray<{ text: string; originalIndex: number }>(optionsArray) : optionsArray;
            
            const prefixes = ['A', 'B', 'C', 'D', 'E', 'F'];
            const finalOptions = shuffledOptions.map((opt, i) => `${prefixes[i]}. ${opt.text}`);
            
            // Tìm vị trí đáp án đúng sau khi xáo trộn dựa trên originalIndex
            const correctIndex = shuffledOptions.findIndex(opt => opt.originalIndex === correctIndexInOriginal);
            
            answerData[qKey] = {
                correctLetter: correctIndex !== -1 ? prefixes[correctIndex] : 'Lỗi/Chưa xác định',
                content: correctContent,
                explanation: q.explanation || 'Không có giải thích chi tiết.'
            };

            // Deep clone object cuối cùng trước khi push
            finalQuestions.push(JSON.parse(JSON.stringify({ ...q, options: finalOptions })));
        } else {
            answerData[qKey] = {
                correctLetter: 'Tự luận',
                content: q.correctAnswer || 'Xem hướng dẫn',
                explanation: q.explanation || 'Không có giải thích.'
            };
            // Deep clone cho câu tự luận
            finalQuestions.push(JSON.parse(JSON.stringify(q)));
        }
    });

    return { examQuestions: finalQuestions, answerData, examCode };
};
