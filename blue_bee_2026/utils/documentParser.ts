import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker for Vite
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extracts raw text from a PDF file using PDF.js
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Không thể trích xuất văn bản từ file PDF.');
  }
}

/**
 * Extracts raw text from a Word (.docx) file using Mammoth
 */
export async function extractTextFromWord(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (error) {
    console.error('Error parsing Word document:', error);
    throw new Error('Không thể trích xuất văn bản từ file Word.');
  }
}

/**
 * General document parser that routes based on file type
 */
export async function parseDocument(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    return await extractTextFromPDF(file);
  } 
  
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
    fileName.endsWith('.docx')
  ) {
    return await extractTextFromWord(file);
  }
  
  if (file.type === 'text/plain' || fileName.endsWith('.txt')) {
    return await file.text();
  }

  throw new Error(`Định dạng file không được hỗ trợ: ${file.name}. Vui lòng sử dụng .txt, .pdf hoặc .docx`);
}
