import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Question, QuestionType, KnowledgeDocument, AppSettings, UserProfile } from "../types";

// --- CONFIGURATION ---
const PRIMARY_MODEL = "gemini-2.5-flash"; 
const FALLBACK_MODEL = "gemini-flash-latest"; 
const STORAGE_KEY_API = 'DTS_GEMINI_API_KEY';

const DEFAULT_SETTINGS: AppSettings = {
  modelName: PRIMARY_MODEL, 
  aiVoice: "Zephyr",
  temperature: 0.7,
  maxOutputTokens: 2048,
  autoSave: true,
  ragTopK: 5, 
  thinkingBudget: 0, 
  systemExpertise: 'ACADEMIC'
};

const getSettings = (): AppSettings => {
  const saved = localStorage.getItem('app_settings');
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
};

/**
 * Retrieves the API Key with priority:
 * 1. User Custom Key (LocalStorage)
 * 2. System Environment Variable
 */
export const getDynamicApiKey = (): string | undefined => {
  const customKey = localStorage.getItem(STORAGE_KEY_API);
  if (customKey && customKey.trim().length > 0) {
    return customKey;
  }
  return process.env.API_KEY;
};

const getAI = (specificKey?: string) => {
  const apiKey = specificKey || getDynamicApiKey();
  
  if (!apiKey) {
    throw new Error("Vui lòng nhập Gemini API Key trong phần Cài đặt hệ thống (Settings) để sử dụng các tính năng AI.");
  }
  
  return new GoogleGenAI({ apiKey });
};

/**
 * Validates an API Key by making a lightweight request.
 */
export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: "Hi",
    });
    return true;
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};

/**
 * SMART WRAPPER: Handles 429/503 errors by falling back to a stable model.
 */
const generateWithFallback = async (
  ai: GoogleGenAI, 
  params: any, 
  retryCount = 4
): Promise<{ response: GenerateContentResponse, usedModel: string }> => {
  let currentModel = params.model;
  
  if (!currentModel) currentModel = PRIMARY_MODEL;

  let attempt = 0;
  let currentConfig = params.config ? { ...params.config } : {};

  while (attempt < retryCount) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: currentModel,
        config: currentConfig
      });
      
      return { response, usedModel: currentModel };

    } catch (error: any) {
      const msg = error.toString();
      const status = error.status || 0;
      const isQuotaError = msg.includes('429') || status === 429 || msg.includes('RESOURCE_EXHAUSTED');
      const isServerOverload = msg.includes('503') || status === 503 || msg.includes('Overloaded');

      if (isQuotaError || isServerOverload) {
        attempt++;
        if (attempt >= retryCount) break; 

        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error("Lỗi kết nối AI. Vui lòng kiểm tra dung lượng file (tối đa 1000 trang) hoặc kiểm tra API Key.");
};

const getSystemInstruction = (settings: AppSettings, contextText: string, user?: UserProfile | null) => {
  const userName = user?.fullName || "Bạn";
  const userRole = user?.role || "student";

  let roleInstruction = "";

  if (userRole === 'teacher') {
    roleInstruction = `
    VAI TRÒ: Trợ lý AI chuyên nghiệp hỗ trợ Cán bộ quản lý ${userName}.
    PHONG CÁCH: Chuyên nghiệp, đi thẳng vào chuyên môn.
    NHIỆM VỤ: Soạn giáo án, đề xuất câu hỏi thi, tra cứu quy chuẩn.
    `;
  } else if (userRole === 'admin') {
    roleInstruction = `
    VAI TRÒ: System Bot (CLI Style).
    PHONG CÁCH: Cực ngắn gọn. Chỉ báo cáo trạng thái hoặc kết quả.
    `;
  } else {
    roleInstruction = `
    VAI TRÒ: Thầy giáo AI (Socratic Tutor) hướng dẫn học viên ${userName}.
    PHONG CÁCH: Thân thiện, khuyến khích tư duy.
    `;
  }

  let instruction = `${roleInstruction}
  
  CẤU TRÚC TRẢ LỜI & SỬ DỤNG CÔNG CỤ (QUAN TRỌNG):
  1. **TRA CỨU GOOGLE (Ưu tiên):** 
     - Sử dụng Google Search nếu cần thông tin thực tế bổ sung.

  2. **Cấu trúc phản hồi:**
     - Trả lời trực tiếp câu hỏi dựa trên nội dung tài liệu cung cấp (nếu có).
     - Định dạng Markdown và LaTeX ($...$) cho công thức.
  `;

  if (contextText) {
    instruction += `\n\n[QUY TẮC CỨNG]:
1. TUYỆT ĐỐI chỉ dùng thông tin trong tài liệu này để thực hiện yêu cầu. Không bịa đặt.
2. Nếu tài liệu không chứa đủ dữ liệu, hãy trả lời: "Tài liệu không đủ thông tin".

[NỘI DUNG TÀI LIỆU]:\n${contextText.substring(0, 800000)}`;
  }
  
  return instruction;
};

// --- EXPORTED FUNCTIONS ---

export const generateChatResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  config?: { temperature?: number; maxOutputTokens?: number; model?: string },
  knowledgeDocs: KnowledgeDocument[] = [],
  user?: UserProfile | null
) => {
  try {
    const ai = getAI();
    const settings = getSettings();
    let contextText = "";
    let sources: { uri: string; title: string }[] = [];
    
    // Context Stuffing Logic
    if (knowledgeDocs.length > 0) {
        contextText = knowledgeDocs.map(doc => `--- DOCUMENT: ${doc.name} ---\n${doc.text}`).join("\n\n");
        sources = knowledgeDocs.map(doc => ({ uri: '#', title: doc.name }));
    }

    const targetModel = PRIMARY_MODEL;
    const tools = [{ googleSearch: {} }];

    const { response, usedModel } = await generateWithFallback(ai, {
      model: targetModel,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: getSystemInstruction(settings, contextText, user),
        temperature: config?.temperature || settings.temperature,
        tools: tools 
      },
    });

    const searchSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter((chunk: any) => chunk.web)
      ?.map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title
      })) || [];

    const allSources = [...sources, ...searchSources].filter((v,i,a)=>a.findIndex(t=>(t.uri === v.uri))===i);

    let finalText = response.text || "AI không thể tạo phản hồi.";
    
    return {
      text: finalText,
      sources: allSources,
      modelUsed: usedModel
    };
  } catch (error: any) {
    console.error("AI Core Error:", error);
    throw new Error("Lỗi kết nối AI. Vui lòng kiểm tra dung lượng file (tối đa 1000 trang) hoặc kiểm tra API Key.");
  }
};

export const generateQuestionsByAI = async (
  promptText: string,
  count: number,
  difficulty: string,
  contextText?: string
): Promise<Partial<Question>[]> => {
  try {
    const ai = getAI();
    
    let finalPrompt = promptText;
    if (contextText) {
      finalPrompt = `
Bạn là một chuyên gia. Tôi cung cấp cho bạn một tài liệu đầy đủ dưới đây.
[QUY TẮC CỨNG]:
1. TUYỆT ĐỐI chỉ dùng thông tin trong tài liệu này để thực hiện yêu cầu. Không bịa đặt.
2. Nếu tài liệu không chứa đủ dữ liệu, hãy trả lời: "Tài liệu không đủ thông tin".

[NỘI DUNG TÀI LIỆU]:
${contextText.substring(0, 800000)}

[YÊU CẦU CỦA NGƯỜI DÙNG]:
${promptText}
`;
    }

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          type: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING },
          category: { type: Type.STRING },
          bloomLevel: { type: Type.STRING }
        },
        required: ["content", "type", "correctAnswer", "explanation", "category", "bloomLevel"],
      },
    };

    const { response } = await generateWithFallback(ai, {
      model: PRIMARY_MODEL,
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4,
      },
    });
    
    // DEBUG: Log raw response
    const rawText = response.text || "";
    console.log("Raw response from Gemini:", rawText);

    if (!rawText) return [];

    // SANITIZATION: Remove potential markdown wrapping
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      return JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Cleaned Text:", cleanedText);
      throw new Error("Lỗi cấu trúc dữ liệu AI. Vui lòng thử lại.");
    }
  } catch (error: any) {
    console.error("Question Gen Error:", error);
    throw new Error("Lỗi kết nối AI. Vui lòng kiểm tra dung lượng file (tối đa 1000 trang) hoặc kiểm tra API Key.");
  }
};

export const evaluateOralAnswer = async (
    question: string,
    correctAnswerOrContext: string,
    userAnswer: string
): Promise<{ score: number; feedback: string }> => {
    try {
      const ai = getAI();
      
      const { response } = await generateWithFallback(ai, {
          model: PRIMARY_MODEL,
          contents: `Đánh giá câu trả lời môn học.\nCâu hỏi: ${question}\nĐáp án chuẩn: ${correctAnswerOrContext}\nCâu trả lời sinh viên: ${userAnswer}`,
          config: { 
              responseMimeType: "application/json", 
              temperature: 0.3,
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      score: { type: Type.NUMBER },
                      feedback: { type: Type.STRING }
                  },
                  required: ["score", "feedback"]
              }
          }
      });

      const rawText = response.text || "";
      if (!rawText) return { score: 0, feedback: "AI không thể đánh giá." };

      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
          return JSON.parse(cleanedText);
      } catch (parseError) {
          console.error("Evaluation Parse Error:", parseError, "Text:", cleanedText);
          return { score: 0, feedback: "Lỗi cấu trúc dữ liệu AI khi đánh giá." };
      }
    } catch (error: any) {
      console.error("Evaluation Error:", error);
      throw new Error("Lỗi kết nối AI. Vui lòng kiểm tra dung lượng file (tối đa 1000 trang) hoặc kiểm tra API Key.");
    }
};
