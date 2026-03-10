export const parseExamText = (rawText: string) => {
    const questions: any[] = [];
    
    const essayMatch = rawText.match(/(?:Phần\s*[2II]+\.?|B\.)\s*TỰ LUẬN/i);
    const essayStartIndex = essayMatch ? essayMatch.index : rawText.length;

    let globalAnswers: Record<string, string> = {};
    let globalExplanations: Record<string, string> = {};
    
    const endSectionMatch = rawText.match(/(?:BẢNG ĐÁP ÁN|Hướng dẫn giải)[\s\S]*$/i);
    let processingText = rawText;

    if (endSectionMatch && endSectionMatch.index !== undefined) {
        const endSectionText = endSectionMatch[0];
        processingText = rawText.substring(0, endSectionMatch.index);

        const answerTableMatch = endSectionText.match(/BẢNG ĐÁP ÁN\n([\s\S]*?)(?:Hướng dẫn giải|$)/i);
        if (answerTableMatch) {
            const tokens = answerTableMatch[1].match(/\d+\s*[A-D]/gi);
            if (tokens) {
                tokens.forEach(t => {
                    const qNum = t.match(/\d+/)?.[0];
                    const ans = t.match(/[A-D]/i)?.[0].toUpperCase();
                    if (qNum && ans) globalAnswers[qNum] = ans;
                });
            }
        }

        const explanationMatch = endSectionText.match(/Hướng dẫn giải[\s\S]*$/i);
        if (explanationMatch) {
            const explainBlocks = explanationMatch[0].matchAll(/Câu\s*(\d+)[^\n]*\n([\s\S]*?)(?=\nCâu\s*\d+[^\n]*\n|$)/gi);
            for (const match of explainBlocks) {
                globalExplanations[match[1]] = match[2].trim();
            }
        }
    }

    // Chấp nhận khoảng trắng hoặc Tab trước chữ Câu / Số thứ tự
    const blocks = processingText.split(/(?=\n\s*(?:Câu\s*\d+|[0-9]+\s*[\.\)]))/gi)
                          .map(b => b.trim())
                          .filter(b => b.length > 0);
    
    let currentTextIndex = 0;

    blocks.forEach(block => {
        currentTextIndex = rawText.indexOf(block, currentTextIndex);
        const isEssay = currentTextIndex > (essayStartIndex !== undefined && essayStartIndex !== null ? essayStartIndex : rawText.length);

        if (!block.match(/^(?:Câu\s*\d+|[0-9]+\s*[\.\)])/i)) return;

        const q: any = { type: isEssay ? 'ESSAY' : 'MULTIPLE_CHOICE', content: '', options: [], correctAnswer: '', explanation: '', imageUrl: '' };
        
        const chooseMatch = block.match(/\bChọn\s+([A-D])\b/i);
        if (chooseMatch) {
            q.correctAnswer = chooseMatch[1].toUpperCase();
            block = block.replace(chooseMatch[0], ''); 
        }

        const inlineExplainMatch = block.match(/(?:Hướng dẫn giải|Lời giải|Cách giải:)[\s\S]*/i);
        if (inlineExplainMatch) {
            q.explanation = inlineExplainMatch[0].replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
            block = block.replace(inlineExplainMatch[0], '');
        }

        const qNumMatch = block.match(/^(?:Câu\s*(\d+)|(\d+)\s*[\.\)])/i);
        const qNum = qNumMatch ? (qNumMatch[1] || qNumMatch[2]) : '';

        // Xử lý thẻ hình ảnh (VD: [img:$img_1$])
        const imgMatch = block.match(/\[img:([^\]]+)\]/i);
        if (imgMatch) {
            q.imageUrl = imgMatch[1]; 
            block = block.replace(imgMatch[0], ''); 
        }

        block = block.replace(/(?:\n|^)(?:Phần\s*[12II]+\.?|B\.|A\.)\s*(?:TỰ LUẬN|TRẮC NGHIỆM)[\s\S]*$/i, '');

        const lines = block.split('\n');
        let contentLines: string[] = [];
        
        if (q.type === 'MULTIPLE_CHOICE') {
            const standardLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
            let optionCount = 0;

            lines.forEach(line => {
                const cleanLine = line.trim();
                const isOptionLine = /^(?:\*)?\s*[A-Da-d][\.\:\)]/.test(cleanLine);

                if (isOptionLine) {
                    const optRegex = /(?:^|\s+)(\*)?\s*([A-Da-d])[\.\:\)]\s*(.*?)(?=(?:\s+\*?\s*[A-Da-d][\.\:\)])|$)/gi;
                    let m;
                    while ((m = optRegex.exec(cleanLine)) !== null) {
                        const isCorrect = m[1] === '*';
                        // TỰ ĐỘNG ÉP KIỂU CHỮ CÁI: Dù GV gõ a,b,b,d -> Vẫn ép thành A, B, C, D
                        const correctLetter = standardLetters[optionCount] || m[2].toUpperCase();
                        
                        // Dọn sạch Tab (\t) và khoảng trắng thừa
                        const optContent = m[3].replace(/[ \t]+/g, ' ').trim();
                        
                        q.options.push(`${correctLetter}. ${optContent}`);
                        if (isCorrect) q.correctAnswer = correctLetter;
                        
                        optionCount++;
                    }
                } else if (q.options.length === 0) {
                    contentLines.push(line);
                } else {
                    if (q.options.length > 0 && cleanLine !== '') q.options[q.options.length - 1] += ' ' + cleanLine.replace(/[ \t]+/g, ' ');
                }
            });
        } else {
            contentLines = lines;
        }

        q.content = contentLines.join('\n')
            .replace(/^(?:Câu\s*\d+(?:\.[^\s\n]+|\([^)]+\))?[\.\:]?|\d+[\.\)])\s*/i, '')
            .trim()
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n');

        if (!q.correctAnswer && globalAnswers[qNum]) q.correctAnswer = globalAnswers[qNum];
        if (!q.explanation && globalExplanations[qNum]) q.explanation = globalExplanations[qNum];

        if (q.content) questions.push(q);
    });

    return questions;
};
