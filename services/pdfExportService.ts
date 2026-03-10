
import { Question, QuestionType } from '../types';

interface ExamInfo {
    organizationName: string;
    schoolName: string;
    examName: string;
    examCode: string;
    time: string;
    subjectName: string;
    moduleName: string;
    semester?: string;
    year?: string;
}

const formatTextForPdf = (text: string): string => {
    if (!text) return '';
    let html = text.replace(/\n/g, '<br />');
    
    // Render Katex if available
    if ((window as any).katex) {
        html = html.replace(/\$\$(.*?)\$\$/gs, (_, math) => {
            try { return (window as any).katex.renderToString(math, { displayMode: true, throwOnError: false }); } catch (e) { return math; }
        });
        html = html.replace(/\$(.*?)\$/g, (_, math) => {
            try { return (window as any).katex.renderToString(math, { displayMode: false, throwOnError: false }); } catch (e) { return math; }
        });
    }
    return html;
};

export const exportExamToPdf = (
    examInfo: ExamInfo,
    questions: Question[],
    answerKey: Record<number, string>,
    examCode: string
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Vui lòng cho phép popup để in đề thi.");
        return;
    }

    const { organizationName, schoolName, examName, time, subjectName, moduleName } = examInfo;

    // --- HTML TEMPLATE CONSTRUCTION ---
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>In Đề Thi - Mã ${examCode}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <style>
            body { font-family: "Times New Roman", Times, serif; line-height: 1.5; color: #000; background: #fff; }
            .page-container { width: 210mm; margin: 0 auto; padding: 20mm; box-sizing: border-box; }
            
            /* Header Styling */
            .header-table { width: 100%; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
            .header-left { width: 40%; text-align: center; vertical-align: top; }
            .header-right { width: 60%; text-align: center; vertical-align: top; }
            .org-name { text-transform: uppercase; font-size: 11pt; }
            .school-name { text-transform: uppercase; font-weight: bold; font-size: 12pt; }
            .exam-name { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin-top: 15px; }
            .meta-info { font-size: 13pt; font-weight: bold; margin: 5px 0; }
            .exam-code-box { border: 1px solid #000; padding: 5px 15px; display: inline-block; font-weight: bold; margin-top: 10px; }
            
            /* Question Styling */
            .question-block { margin-bottom: 15px; page-break-inside: avoid; }
            .q-content { font-weight: bold; margin-bottom: 5px; text-align: justify; }
            .q-image { display: block; margin: 10px auto; max-height: 200px; max-width: 100%; }
            .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-left: 20px; }
            .option-item { display: flex; gap: 5px; }
            .option-label { font-weight: bold; }
            
            /* Answer Key Page */
            .answer-page { page-break-before: always; padding-top: 30px; }
            .answer-title { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 30px; text-transform: uppercase; }
            .answer-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; border: 1px solid #000; }
            .answer-cell { border: 1px solid #000; padding: 10px; text-align: center; font-size: 12pt; }
            .answer-cell strong { margin-right: 5px; }

            @media print {
                body { margin: 0; padding: 0; }
                .page-container { width: 100%; padding: 0; margin: 0; }
                button { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="page-container">
            <!-- HEADER -->
            <table class="header-table">
                <tr>
                    <td class="header-left">
                        <div class="org-name">${organizationName}</div>
                        <div class="school-name">${schoolName}</div>
                        <hr style="width: 30%; border: 0.5px solid #000; margin: 5px auto;" />
                    </td>
                    <td class="header-right">
                        <div style="font-weight: bold; font-size: 11pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div style="font-weight: bold; font-size: 12pt;">Độc lập - Tự do - Hạnh phúc</div>
                        <hr style="width: 20%; border: 0.5px solid #000; margin: 5px auto;" />
                    </td>
                </tr>
                <tr>
                    <td colspan="2" style="text-align: center;">
                        <div class="exam-name">${examName}</div>
                        <div class="meta-info">
                            Môn: ${subjectName} 
                            ${moduleName ? `(${moduleName})` : ''}
                        </div>
                        <div style="font-style: italic;">(Thời gian làm bài: ${time} phút)</div>
                        <div class="exam-code-box">MÃ ĐỀ THI: ${examCode}</div>
                    </td>
                </tr>
            </table>

            <div style="text-align: center; font-style: italic; border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 20px;">
                (Thí sinh không được sử dụng tài liệu)
            </div>

            <!-- QUESTIONS CONTENT -->
            <div class="questions-container">
                ${questions.map((q, idx) => `
                    <div class="question-block">
                        <div class="q-content">
                            <span>Câu ${idx + 1}:</span> ${formatTextForPdf(q.content)}
                        </div>
                        ${q.image ? `<img src="${q.image}" class="q-image" />` : ''}
                        
                        ${q.type === QuestionType.MULTIPLE_CHOICE && q.options ? `
                            <div class="options-grid">
                                ${q.options.map((opt, i) => `
                                    <div class="option-item">
                                        <span class="option-label">${String.fromCharCode(65 + i)}.</span>
                                        <div>${formatTextForPdf(opt)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        ${q.type === QuestionType.ESSAY ? `
                            <div style="margin-top: 10px; border-bottom: 1px dashed #999; height: 100px;"></div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>

            <div style="text-align: center; margin-top: 30px; font-weight: bold;">--- HẾT ---</div>
        </div>

        <!-- ANSWER KEY PAGE -->
        <div class="page-container answer-page">
            <div class="answer-title">ĐÁP ÁN ĐỀ THI MÃ: ${examCode}</div>
            
            <div class="answer-grid">
                ${Object.entries(answerKey).map(([num, ans]) => `
                    <div class="answer-cell">
                        <strong>Câu ${num}:</strong> ${ans}
                    </div>
                `).join('')}
            </div>

            <div style="margin-top: 50px; text-align: right; padding-right: 50px;">
                <div style="font-style: italic;">Ngày ..... tháng ..... năm 20...</div>
                <div style="font-weight: bold; margin-top: 10px;">CÁN BỘ RA ĐỀ</div>
                <div style="margin-top: 60px;">(Ký và ghi rõ họ tên)</div>
            </div>
        </div>

        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
