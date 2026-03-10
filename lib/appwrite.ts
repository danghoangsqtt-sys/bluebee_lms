import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

// Config
export const APPWRITE_CONFIG = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  dbId: import.meta.env.VITE_APPWRITE_DB_ID,
  collections: {
    profiles: import.meta.env.VITE_APPWRITE_COLLECTION_PROFILES,
    questions: import.meta.env.VITE_APPWRITE_COLLECTION_QUESTIONS,
    exams: import.meta.env.VITE_APPWRITE_COLLECTION_EXAMS,
    classes: import.meta.env.VITE_APPWRITE_COLLECTION_CLASSES,
    lectures: import.meta.env.VITE_APPWRITE_COLLECTION_LECTURES,
    user_documents: 'user_documents',
    folders: import.meta.env.VITE_APPWRITE_COLLECTION_FOLDERS || 'folders',
    examResults: import.meta.env.VITE_APPWRITE_COLLECTION_EXAM_RESULTS || 'exam_results',
    schedules: import.meta.env.VITE_APPWRITE_COLLECTION_SCHEDULES || 'schedules',
    notifications: 'notifications',
    tasks: 'tasks',
  },
  buckets: {
    lectures: import.meta.env.VITE_APPWRITE_BUCKET_LECTURES,
  }
};

const client = new Client();

if (APPWRITE_CONFIG.endpoint && APPWRITE_CONFIG.projectId) {
    client
        .setEndpoint(APPWRITE_CONFIG.endpoint)
        .setProject(APPWRITE_CONFIG.projectId);
} else {
    console.error("Lỗi: Thiếu cấu hình Appwrite trong file .env");
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { ID, Query };
export default client;