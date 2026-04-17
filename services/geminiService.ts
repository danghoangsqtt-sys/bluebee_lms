import { GenerateContentResponse, GoogleGenAI, Type } from "@google/genai";
import { AppSettings, KnowledgeDocument, Question, UserProfile } from "../types";

const PRIMARY_MODEL = "gemini-2.5-flash";
const SECONDARY_MODEL = "gemini-2.5-flash-lite";
const TERTIARY_MODEL = "gemini-2.0-flash";
const STORAGE_KEY_API = "DTS_GEMINI_API_KEY";

const MAX_CONTEXT_CHARS = 1500000;
const MAX_EXAM_CONTEXT_CHARS = 240000;
const MAX_HISTORY_LENGTH = 20;
const AI_REQUEST_GAP_MS = 1800;
const OVERLOAD_RETRY_LIMIT = 2;

let lastAiRequestAt = 0;
let aiRequestQueue: Promise<void> = Promise.resolve();

const DEFAULT_SETTINGS: AppSettings = {
  modelName: PRIMARY_MODEL,
  aiVoice: "Zephyr",
  temperature: 0.7,
  maxOutputTokens: 2048,
  autoSave: true,
  ragTopK: 5,
  thinkingBudget: 0,
  systemExpertise: "ACADEMIC",
};

const getSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem("app_settings");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withAiRequestQueue = async <T>(task: () => Promise<T>): Promise<T> => {
  const runTask = async (): Promise<T> => {
    const waitTime = Math.max(0, AI_REQUEST_GAP_MS - (Date.now() - lastAiRequestAt));
    if (waitTime > 0) {
      await sleep(waitTime);
    }

    try {
      return await task();
    } finally {
      lastAiRequestAt = Date.now();
    }
  };

  const queuedTask = aiRequestQueue.catch(() => undefined).then(runTask);
  aiRequestQueue = queuedTask.then(() => undefined, () => undefined);
  return queuedTask;
};

const getSupportedModel = (modelName?: string): string => {
  if (!modelName || modelName === "gemini-1.5-flash" || modelName === "gemini-3-flash-preview") {
    return PRIMARY_MODEL;
  }
  return modelName;
};

const truncateContext = (contextText: string, maxChars: number): string => {
  if (contextText.length <= maxChars) {
    return contextText;
  }

  return `${contextText.substring(0, maxChars)}\n\n[...NOI DUNG DA BI CAT DE GIAM TAI REQUEST AI...]`;
};

const getRetryDelayMs = (error: unknown, attempt: number, kind: "quota" | "overload") => {
  const rawMessage = String((error as any)?.message || error || "");
  const retryAfterMatch = rawMessage.match(/retry after\s+(\d+)(?:\s*seconds?|\s*s)?/i);
  if (retryAfterMatch) {
    return Number(retryAfterMatch[1]) * 1000;
  }

  const baseDelay = kind === "overload" ? 3000 : 5000;
  const maxDelay = kind === "overload" ? 12000 : 30000;
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  const jitter = Math.floor(Math.random() * 700);
  return exponentialDelay + jitter;
};

const getAiErrorMeta = (error: unknown) => {
  const message = String((error as any)?.message || (error as any)?.toString?.() || "");
  const status = Number((error as any)?.status || (error as any)?.code || 0);
  const lowerMessage = message.toLowerCase();

  return {
    message,
    isQuotaError:
      status === 429 ||
      lowerMessage.includes("429") ||
      lowerMessage.includes("resource_exhausted") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("quota"),
    isServerOverload:
      status === 503 ||
      lowerMessage.includes("503") ||
      lowerMessage.includes("overloaded") ||
      lowerMessage.includes("service unavailable"),
    isModelError:
      status === 404 ||
      (lowerMessage.includes("model") && lowerMessage.includes("not found")),
  };
};

export const getDynamicApiKey = (): string | undefined => {
  const customKey = localStorage.getItem(STORAGE_KEY_API);
  if (customKey && customKey.trim().length > 0) {
    return customKey;
  }

  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
};

const getAI = (specificKey?: string) => {
  const apiKey = specificKey || getDynamicApiKey();

  if (!apiKey) {
    throw new Error("Vui long nhap Gemini API Key trong phan Cai dat he thong de su dung tinh nang AI.");
  }

  return new GoogleGenAI({ apiKey });
};

export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    await withAiRequestQueue(() =>
      ai.models.generateContent({
        model: SECONDARY_MODEL,
        contents: "Hi",
      })
    );
    return true;
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};

const generateWithFallback = async (
  ai: GoogleGenAI,
  params: any,
  retryCount = 4
): Promise<{ response: GenerateContentResponse; usedModel: string }> => {
  const preferredModel = getSupportedModel(params.model || getSettings().modelName || PRIMARY_MODEL);
  const modelsToTry = Array.from(new Set([preferredModel, SECONDARY_MODEL, TERTIARY_MODEL]));

  for (const modelToUse of modelsToTry) {
    let attempt = 0;
    const currentConfig = params.config ? { ...params.config } : {};

    while (attempt < retryCount) {
      try {
        const response = await withAiRequestQueue(() =>
          ai.models.generateContent({
            ...params,
            model: modelToUse,
            config: currentConfig,
          })
        );

        if (modelToUse !== preferredModel) {
          console.info(`[AI Fallback] Dang dung model du phong: ${modelToUse}`);
        }

        return { response, usedModel: modelToUse };
      } catch (error) {
        const { message, isQuotaError, isServerOverload, isModelError } = getAiErrorMeta(error);

        if (isModelError) {
          console.warn(`[AI Fallback] Model ${modelToUse} khong ton tai, thu model tiep theo...`);
          break;
        }

        if (isServerOverload) {
          attempt++;
          if (attempt >= OVERLOAD_RETRY_LIMIT) {
            console.warn(`[AI Fallback] ${modelToUse} van overloaded, chuyen model du phong...`);
            break;
          }

          const delay = getRetryDelayMs(error, attempt, "overload");
          console.warn(`[AI Overload] ${modelToUse} qua tai, cho ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        if (isQuotaError) {
          attempt++;
          if (attempt >= retryCount) {
            break;
          }

          const delay = getRetryDelayMs(error, attempt, "quota");
          console.warn(`[AI Retry] ${attempt}/${retryCount} - Cho ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        console.error(`[AI Error] ${modelToUse}:`, message);
        throw error;
      }
    }
  }

  throw new Error(
    "Dich vu AI dang qua tai hoac vuot han muc key free. He thong da thu model du phong va retry nhieu lan nhung khong thanh cong."
  );
};

const getSystemInstruction = (settings: AppSettings, contextText: string, user?: UserProfile | null) => {
  const userName = user?.fullName || "Ban";
  const userRole = user?.role || "student";

  let roleInstruction = "";

  if (userRole === "teacher") {
    roleInstruction = `
VAI TRO: Tro ly AI ho tro can bo quan ly ${userName}.
PHONG CACH: Chuyen nghiep, di thang vao chuyen mon.
NHIEM VU: Soan giao an, de xuat cau hoi thi, tra cuu quy chuan.
`;
  } else if (userRole === "admin") {
    roleInstruction = `
VAI TRO: System Bot.
PHONG CACH: Rat ngan gon. Chi bao cao trang thai va ket qua.
`;
  } else {
    roleInstruction = `
VAI TRO: Thay giao AI huong dan hoc vien ${userName}.
PHONG CACH: Than thien, khuyen khich tu duy.
`;
  }

  let instruction = `${roleInstruction}

CAU TRUC TRA LOI VA SU DUNG CONG CU:
1. Tra loi truc tiep dua tren noi dung tai lieu neu co.
2. Dinh dang Markdown va LaTeX ($...$) cho cong thuc.
`;

  if (contextText) {
    instruction += `\n[QUY TAC CUNG]:
1. Tuyet doi chi dung thong tin trong tai lieu nay.
2. Neu tai lieu khong du thong tin, hay noi ro "Tai lieu khong du thong tin".

[NOI DUNG TAI LIEU]:
${truncateContext(contextText, MAX_CONTEXT_CHARS)}`;
  }

  return instruction;
};

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

    if (knowledgeDocs.length > 0) {
      contextText = knowledgeDocs.map(doc => `--- DOCUMENT: ${doc.name} ---\n${doc.text}`).join("\n\n");
      sources = knowledgeDocs.map(doc => ({ uri: "#", title: doc.name }));
    }

    const trimmedHistory = history.slice(-MAX_HISTORY_LENGTH);
    const targetModel = getSupportedModel(config?.model || settings.modelName || PRIMARY_MODEL);
    const tools = [{ googleSearch: {} }];

    const { response, usedModel } = await generateWithFallback(ai, {
      model: targetModel,
      contents: [...trimmedHistory, { role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: getSystemInstruction(settings, contextText, user),
        temperature: config?.temperature || settings.temperature,
        maxOutputTokens: config?.maxOutputTokens || settings.maxOutputTokens,
        tools,
      },
    });

    const searchSources =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.web)
        ?.map((chunk: any) => ({
          uri: chunk.web.uri,
          title: chunk.web.title,
        })) || [];

    const allSources = [...sources, ...searchSources].filter(
      (value, index, array) => array.findIndex(item => item.uri === value.uri) === index
    );

    return {
      text: response.text || "AI khong the tao phan hoi.",
      sources: allSources,
      modelUsed: usedModel,
    };
  } catch (error: any) {
    console.error("AI Core Error:", error);
    throw new Error(error.message || "Loi ket noi AI. Vui long kiem tra API Key.");
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
    const targetModel = getSupportedModel(getSettings().modelName || PRIMARY_MODEL);

    let finalPrompt = `${promptText}

So luong cau hoi can sinh: ${count}
Muc do Bloom muc tieu: ${difficulty}`;

    if (contextText) {
      finalPrompt = `
Ban la mot chuyen gia su pham. Chi duoc dung thong tin trong tai lieu sau.
[QUY TAC CUNG]:
1. Khong duoc bia dat.
2. Neu tai lieu khong du thong tin, tra ve JSON rong [].

[NOI DUNG TAI LIEU]:
${truncateContext(contextText, MAX_EXAM_CONTEXT_CHARS)}

[YEU CAU]:
${finalPrompt}
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
          bloomLevel: { type: Type.STRING },
        },
        required: ["content", "type", "correctAnswer", "explanation", "category", "bloomLevel"],
      },
    };

    const { response } = await generateWithFallback(ai, {
      model: targetModel,
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.4,
      },
    });

    const rawText = response.text || "";
    if (!rawText) {
      return [];
    }

    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(cleanedText);
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Cleaned Text:", cleanedText.substring(0, 500));
      throw new Error("Loi cau truc du lieu AI. Vui long thu lai.");
    }
  } catch (error: any) {
    console.error("Question Gen Error:", error);
    throw new Error(error.message || "Loi ket noi AI. Vui long kiem tra API Key.");
  }
};

export const evaluateOralAnswer = async (
  question: string,
  correctAnswerOrContext: string,
  userAnswer: string
): Promise<{ score: number; feedback: string }> => {
  try {
    const ai = getAI();
    const evaluationPrompt = `Danh gia cau tra loi mon hoc.
Cau hoi: ${question}
Dap an chuan: ${correctAnswerOrContext}
Cau tra loi sinh vien: ${userAnswer}

Hay cho diem tu 0-10 va nhan xet ngan gon bang tieng Viet.`;

    const { response } = await generateWithFallback(ai, {
      model: getSupportedModel(getSettings().modelName || PRIMARY_MODEL),
      contents: [{ role: "user", parts: [{ text: evaluationPrompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
          },
          required: ["score", "feedback"],
        },
      },
    });

    const rawText = response.text || "";
    if (!rawText) {
      return { score: 0, feedback: "AI khong the danh gia." };
    }

    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Evaluation Parse Error:", parseError);
      return { score: 0, feedback: "Loi cau truc du lieu AI khi danh gia." };
    }
  } catch (error: any) {
    console.error("Evaluation Error:", error);
    throw new Error(error.message || "Loi ket noi AI khi cham diem.");
  }
};

export const generateStudentPerformanceEvaluation = async (
  studentName: string,
  score: number,
  timeSpentStr: string,
  redFlags: number,
  wrongQuestionContents: string[]
): Promise<string> => {
  try {
    const ai = getAI();
    const wrongText =
      wrongQuestionContents.length > 0
        ? wrongQuestionContents.map((q, i) => `${i + 1}. ${q}`).join("\n")
        : "Khong co cau sai.";

    const prompt = `Danh gia khach quan va ngan gon (1 doan 30-50 chu) ve bai kiem tra cua hoc sinh ${studentName}.
Thong tin bai thi:
- Diem: ${score}/10
- Thoi gian lam bai: ${timeSpentStr}
- So lan canh bao gian lan: ${redFlags}
- Cac noi dung lam sai chinh:
${wrongText}

Hay viet mot nhan xet danh cho giao vien, danh gia thai do, toc do lam bai va kien thuc bi hong.`;

    const { response } = await generateWithFallback(ai, {
      model: getSupportedModel(getSettings().modelName || PRIMARY_MODEL),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
      },
    });

    return response.text || "AI khong the tao nhan xet.";
  } catch (error) {
    console.error("Gemini Evaluation Error:", error);
    return "Khong the khoi tao nhan xet vi loi ket noi dich vu AI.";
  }
};
