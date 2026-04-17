export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --- SUPABASE DATABASE SCHEMA ---
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string | null;
          role: "admin" | "teacher" | "student";
          status: "pending" | "active";
          class_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          role?: "admin" | "teacher" | "student";
          status?: "pending" | "active";
          class_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          role?: "admin" | "teacher" | "student";
          status?: "pending" | "active";
          class_id?: string | null;
          updated_at?: string | null;
        };
      };
      classes: {
        Row: {
          id: string;
          name: string;
          teacher_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          teacher_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          teacher_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          content: Json;
          type: string;
          options: string[] | null;
          correct_answer: string | null;
          explanation: string | null;
          bloom_level: string | null;
          category: string | null;
          folder_id: string | null;
          image: string | null;
          is_public_bank: boolean;
          creator_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          content: Json;
          type: string;
          options?: string[] | null;
          correct_answer?: string | null;
          explanation?: string | null;
          bloom_level?: string | null;
          category?: string | null;
          folder_id?: string | null;
          image?: string | null;
          is_public_bank?: boolean;
          creator_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: Json;
          type?: string;
          options?: string[] | null;
          correct_answer?: string | null;
          explanation?: string | null;
          bloom_level?: string | null;
          category?: string | null;
          folder_id?: string | null;
          image?: string | null;
          is_public_bank?: boolean;
          creator_id?: string | null;
          created_at?: string;
        };
      };
      exams: {
        Row: {
          id: string;
          title: string;
          type: string;
          question_ids: string[];
          duration: number | null;
          config: Json;
          class_id: string | null;
          creator_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          type: string;
          question_ids: string[];
          config?: Json;
          class_id?: string | null;
          creator_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          type?: string;
          question_ids?: string[];
          config?: Json;
          class_id?: string | null;
          creator_id?: string | null;
          created_at?: string;
        };
      };
      lectures: {
        Row: {
          id: string;
          title: string;
          file_url: string;
          creator_id: string | null;
          shared_with_class_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          file_url: string;
          creator_id?: string | null;
          shared_with_class_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          file_url?: string;
          creator_id?: string | null;
          shared_with_class_id?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

// --- FRONTEND INTERFACES (CamelCase for UI) ---

export enum QuestionType {
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  ESSAY = "ESSAY",
}

export type UserRole = "admin" | "teacher" | "student";
export type UserStatus = "pending" | "active";

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  email?: string;
  avatarUrl?: string;
  classId?: string; // Mapped from DB class_id
  status: UserStatus;
  updatedAt?: number;
  className?: string; // Optional UI helper
}

export interface Class {
  id: string;
  name: string;
  teacherId?: string; // Mapped from DB teacher_id
  teacherName?: string; // Computed for UI
  isActive: boolean;
  createdAt: number;
}

export type ExamType = "REGULAR" | "15_MIN" | "45_MIN" | "MID_TERM" | "FINAL";

export interface QuestionFolder {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface Question {
  id: string;
  content: any; // Can be string or JSON object from DB
  type: string;
  creatorId?: string;
  isPublicBank?: boolean;
  createdAt: number;

  // Frontend/UI standard properties (CamelCase)
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  bloomLevel?: string;
  category?: string;
  folderId?: string; // Keeping for compatibility, but 'folder' string is preferred now
  folder?: string; // NEW: Text-based folder name stored in metadata
  image?: string;

  optionImages?: string[]; // Per-option images (parallel to options[])

  // Temporary fields for Upload Logic
  imageFile?: File;
  previewUrl?: string;

  // DB Reflection (SnakeCase) - kept for compatibility when mapping raw DB responses
  bloom_level?: string;
  is_public_bank?: boolean;
  folder_id?: string;
  correct_answer?: string;
  creator_id?: string;
}

export interface Exam {
  id: string;
  title: string;
  creatorId?: string;
  sharedWithClassId?: string;
  config: any;
  createdAt: number;

  // UI / Extended properties
  type?: string;
  questionIds?: string[];
  folder?: string; // NEW: Support folder organization for exams

  // Additional properties for Exam Creator
  subject_name?: string;
  module_name?: string;
  exam_type?: string;

  // DB properties
  question_ids?: string[];
  duration?: number | null;
  class_id?: string;
  creator_id?: string;

  // Runtime / config properties
  exam_purpose?: string;
  status?: string;
  // Fix L-05: Thêm các fields runtime từ mapDbExamToLocal để type-safe hơn
  start_time?: string | null;
  end_time?: string | null;
  exam_password?: string | null;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  max_attempts?: number;
}

export interface Lecture {
  id: string;
  title: string;
  fileUrl: string;
  creatorId: string;
  sharedWithClassId?: string;
  createdAt: number;
}

// --- SYSTEM & AI TYPES ---

export interface Schedule {
  id: string;
  title: string;
  description?: string;
  date: string; // Legacy field (YYYY-MM-DD) — kept for backward compat
  startDate: string; // ISO datetime (YYYY-MM-DDTHH:mm)
  endDate: string; // ISO datetime (YYYY-MM-DDTHH:mm)
  isAllDay: boolean;
  color: string; // Event color code (e.g. '#3b82f6')
  reminderMinutes: number; // 0 = no reminder, 15/30/60 etc.
  class_id: string;
  creator_id: string;
  createdAt: number;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  creationDate?: string;
  producer?: string;
}

export interface DocumentFile {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadDate: string;
  isProcessed?: boolean;
  metadata?: PdfMetadata;
}

export interface VectorChunk {
  id: string;
  docId: string;
  text: string;
  embedding: number[];
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
  isRAG?: boolean;
}

export interface AppSettings {
  modelName: string;
  aiVoice: string;
  temperature: number;
  maxOutputTokens: number;
  autoSave: boolean;
  ragTopK: number;
  thinkingBudget: number;
  systemExpertise: "ACADEMIC" | "FIELD_EXPERT" | "STUDENT_ASSISTANT";
  debugMode?: boolean;
}

export interface AppVersionInfo {
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  changelog: string;
  updateUrl: string;
  isUpdateAvailable: boolean;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
}

declare global {
  interface Window {
    require: (module: "electron" | string) => any;
  }
}
