import React from 'react';

/**
 * Hàm sanitize cơ bản để loại bỏ các script và attribute nguy hiểm mà không cần thư viện bên ngoài.
 * Đảm bảo các thẻ HTML sinh ra từ regex (strong, li, br) và KaTeX được giữ lại nhưng script/iframe bị loại bỏ.
 */
const sanitizeHTML = (html: string): string => {
  return html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "") // Xóa thẻ script
    .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "") // Xóa thẻ iframe
    .replace(/on\w+="[^"]*"/gim, "") // Xóa các event attributes như onclick, onload
    .replace(/javascript:[^"]*/gim, ""); // Xóa javascript: pseudo-protocol
};

/**
 * Utility để format văn bản hỗ trợ Markdown cơ bản và KaTeX (Toán học/Điện học).
 * Cấu hình { strict: false, throwOnError: false } để hỗ trợ ký tự Unicode (tiếng Việt) trong công thức.
 */
export const formatContent = (text: string): React.ReactNode => {
  if (!text) return null;

  let html = text;

  // 1. Xử lý xuống dòng trước để tránh phá vỡ cấu trúc SVG của KaTeX sau này
  html = html.replace(/\n/g, '<br />');

  // 2. Render KaTeX Display Mode ($$ ... $$)
  html = html.replace(/\$\$(.*?)\$\$/gs, (_, math) => {
    try {
      const cleanMath = math.replace(/<br \/>/g, '\n');
      return (window as any).katex.renderToString(cleanMath, { 
        displayMode: true, 
        throwOnError: false,
        strict: false 
      });
    } catch (e) {
      return math;
    }
  });

  // 3. Render KaTeX Inline Mode ($ ... $)
  html = html.replace(/\$(.*?)\$/g, (_, math) => {
    try {
      const cleanMath = math.replace(/<br \/>/g, '\n');
      return (window as any).katex.renderToString(cleanMath, { 
        displayMode: false, 
        throwOnError: false, 
        strict: false 
      });
    } catch (e) {
      return math;
    }
  });

  // 4. Markdown cơ bản: Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-inherit">$1</strong>');

  // 5. Markdown cơ bản: Lists
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li class="ml-4 list-disc mb-1">$1</li>');

  // Áp dụng sanitize trước khi nạp vào dangerouslySetInnerHTML
  const sanitizedHtml = sanitizeHTML(html);

  return React.createElement('div', {
    className: 'math-content break-words',
    dangerouslySetInnerHTML: { __html: sanitizedHtml }
  });
};