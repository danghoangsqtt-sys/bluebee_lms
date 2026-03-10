import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { Question, Exam, QuestionType } from '../types';

// --- HELPERS ---

const unpackMetadata = (jsonString: string | null | undefined): any => {
  if (!jsonString) return {};
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("Metadata parse error (Non-fatal):", e);
    return {};
  }
};

const cleanContent = (rawContent: any): string => {
  let contentVal = rawContent;
  try {
    if (typeof contentVal === 'string' && (contentVal.trim().startsWith('{') || contentVal.trim().startsWith('['))) {
      const parsed = JSON.parse(contentVal);
      contentVal = parsed.content || contentVal; 
    }
  } catch(e) {}
  return typeof contentVal === 'string' ? contentVal : JSON.stringify(contentVal);
};

const mapDoc = (doc: any) => ({
    ...doc,
    id: doc.$id,
    createdAt: doc.$createdAt ? new Date(doc.$createdAt).getTime() : Date.now()
});

const mapDbQuestionToLocal = (db: any): Question => {
  const mapped = mapDoc(db);
  const meta = unpackMetadata(db.metadata);

  const folder = meta.folder || mapped.folder_id || 'Mặc định';

  return {
    id: mapped.id,
    content: cleanContent(mapped.content),
    type: mapped.type as QuestionType,
    creatorId: mapped.creator_id,
    createdAt: mapped.createdAt,
    options: meta.options || mapped.options || [],
    correctAnswer: meta.correctAnswer || mapped.correct_answer,
    explanation: meta.explanation || mapped.explanation,
    bloomLevel: meta.bloomLevel || mapped.bloom_level,
    category: meta.category || mapped.category,
    folderId: folder,
    folder: folder,
    image: meta.image || mapped.image,
    isPublicBank: mapped.is_public_bank
  };
};

const mapLocalQuestionToDb = (q: Question, userId: string): any => {
  const folderName = q.folder || q.folderId || 'Mặc định';

  const metaObject = {
    options: q.options || [],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    bloomLevel: q.bloomLevel,
    category: q.category || 'General',
    folder: folderName,
    folderId: folderName,
    image: q.image,
  };

  return {
    content: typeof q.content === 'object' ? JSON.stringify(q.content) : q.content,
    type: q.type,
    creator_id: userId,
    bloom_level: q.bloomLevel,
    category: q.category,
    metadata: JSON.stringify(metaObject)
  };
};

const mapDbExamToLocal = (db: any): any => {
  let configObj: any = {};
  if (typeof db.config === 'string') {
      try { configObj = JSON.parse(db.config); } catch(e) {}
  } else if (db.config) {
      configObj = db.config;
  }

  return {
    id: db.$id,
    title: db.title || 'Bài thi không tên',
    type: db.type || 'EXAM',
    question_ids: db.question_ids || [],
    questionIds: db.question_ids || [], 
    config: configObj,
    folder: configObj.folder || db.folder || 'Mặc định',
    creatorId: db.creator_id,
    createdAt: db.$createdAt,
    
    // Đọc mọi cài đặt từ chuỗi nén configObj
    start_time: configObj.start_time || db.start_time,
    end_time: configObj.end_time || db.end_time,
    exam_password: configObj.exam_password || db.exam_password,
    shuffle_questions: configObj.shuffle_questions !== undefined ? configObj.shuffle_questions : true,
    shuffle_options: configObj.shuffle_options !== undefined ? configObj.shuffle_options : true,
    status: configObj.status || db.status || 'draft',
    exam_purpose: configObj.exam_purpose || db.exam_purpose || 'both',
    class_id: configObj.class_id || db.class_id || '',
    max_attempts: configObj.max_attempts || 1
  };
};

const handleFetchError = (context: string, error: any): [] => {
  if (error?.code === 400) {
    console.warn(`⚠️ Appwrite Database Warning [${context}]: ${error?.message}`);
  } else {
    console.error(`❌ Database Error [${context}]:`, error);
  }
  return [];
};

const getAdminHeaders = () => {
    const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
    const secretKey = import.meta.env.VITE_APPWRITE_SERVER_API_KEY;
    if (!secretKey) throw new Error("Hệ thống chưa cấu hình Server API Key.");
    return {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': secretKey,
    };
};

export const createAuthUserAsAdmin = async (email: string, password: string, name: string) => {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    const response = await fetch(`${endpoint}/users`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ userId: 'unique()', email, password, name })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Không thể tạo tài khoản Auth (REST Error)");
    }
    return await response.json();
};

export const deleteAuthUserAsAdmin = async (userId: string) => {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    try {
        const response = await fetch(`${endpoint}/users/${userId}`, {
            method: 'DELETE',
            headers: getAdminHeaders()
        });
        if (!response.ok && response.status !== 404) {
            const err = await response.json();
            console.error("Delete Auth Error:", err);
        }
    } catch (e) {
        console.error("Failed to delete Auth User:", e);
    }
};

export const databaseService = {
  async removeStudentFromClass(profileId: string) {
      try {
          await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, profileId, { class_id: null });
      } catch (error) {
          throw error;
      }
  },

  async deleteUserProfileAndAuth(profileId: string) {
      await deleteAuthUserAsAdmin(profileId);
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, profileId);
      } catch (error) {
          throw error;
      }
  },

  async fetchQuestions(
      userId: string, 
      role: string = 'student',
      options?: { limit?: number; offset?: number; search?: string; folder?: string; type?: string }
  ): Promise<{ documents: Question[]; total: number }> {
    try {
        const queries = [Query.orderDesc('$createdAt')];
        
        if (options?.limit) queries.push(Query.limit(options.limit));
        else queries.push(Query.limit(500)); // Default fallback
        
        if (options?.offset) queries.push(Query.offset(options.offset));

        // Note: Appwrite requires index for search/equal. If not indexed, this might fail or fallback.
        // X-Appwrite-Project might need indices on type, folder_id, content
        if (options?.type && options.type !== 'ALL') queries.push(Query.equal('type', options.type));
        
        // Folders are currently stored in metadata string, which is hard to query cleanly via .equal if not separate.
        // We will use contains for folder if it's stored in metadata.
        if (options?.folder && options.folder !== 'ALL') {
            queries.push(Query.contains('metadata', `"${options.folder}"`));
        }

        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, queries);
        
        // Client side search fallback if Appwrite index is missing for fulltext search on content
        let docs = response.documents.map(mapDbQuestionToLocal);
        
        if (options?.search) {
            const lowerSearch = options.search.toLowerCase();
            docs = docs.filter(q => {
               const contentStr = typeof q.content === 'string' ? q.content : (q.content as any).content || '';
               return contentStr.toLowerCase().includes(lowerSearch);
            });
        }

        return { documents: docs, total: response.total };
    } catch (error: any) {
        handleFetchError('fetchQuestions', error);
        return { documents: [], total: 0 };
    }
  },

  async fetchQuestionMetadataForMatrix(folder?: string): Promise<any[]> {
    try {
        const queries = [
            Query.select(['$id', 'metadata', 'type']), 
            Query.limit(5000) // Khả năng query hàng ngàn record rỗng rất nhanh
        ];
        
        if (folder && folder !== 'Tất cả' && folder !== 'ALL') {
             queries.push(Query.contains('metadata', `"${folder}"`));
        }

        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, queries);
        return response.documents.map(doc => {
            let meta: any = {};
            try { meta = JSON.parse(doc.metadata || '{}'); } catch(e) {}
            return {
                id: doc.$id,
                type: doc.type,
                bloomLevel: meta.bloomLevel || 'Nhận biết',
                folder: meta.folder || meta.folderId || 'Mặc định'
            };
        });
    } catch (error: any) {
        return handleFetchError('fetchQuestionMetadataForMatrix', error);
    }
  },

  async fetchQuestionsByCriteria(questionIds?: string[], folderId?: string): Promise<Question[]> {
      try {
          if (questionIds && questionIds.length > 0) {
              // Appwrite Query.equal limitation is chunking if needed, but for now we expect reasonable array limits
              const queries = [Query.equal('$id', questionIds), Query.limit(Math.max(questionIds.length, 100))];
              const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, queries);
              return response.documents.map(mapDbQuestionToLocal);
          } else if (folderId) {
              const queries = [Query.contains('metadata', `"${folderId}"`), Query.limit(500)];
              const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, queries);
              return response.documents.map(mapDbQuestionToLocal).filter((q: any) => q.folder === folderId || q.folderId === folderId);
          }
          return [];
      } catch (error: any) {
          return handleFetchError('fetchQuestionsByCriteria', error);
      }
  },

  async saveQuestion(q: Question, userId: string, role: string = 'student') {
    const isGlobal = role === 'admin';
    const payload = {
        ...mapLocalQuestionToDb(q, userId),
        is_public_bank: isGlobal
    };
    
    try {
        if (q.id && q.id.length <= 36 && !q.id.includes('.')) { 
             try {
                 const updated = await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, q.id, payload);
                 return mapDbQuestionToLocal(updated);
             } catch (e) {
                 const created = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, q.id, payload);
                 return mapDbQuestionToLocal(created);
             }
        } else {
             const created = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, ID.unique(), payload);
             return mapDbQuestionToLocal(created);
        }
    } catch (error) {
        console.error("Lỗi lưu câu hỏi:", error);
        throw error;
    }
  },

  async deleteQuestion(id: string) {
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, id);
      } catch (error) {
          throw error;
      }
  },

  async updateQuestion(id: string, updates: Partial<Question>) {
      try {
          const doc = await databases.getDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, id);
          let meta: any = {};
          try { meta = JSON.parse(doc.metadata || '{}'); } catch(e) {}
          
          if (updates.folder) {
              meta.folder = updates.folder;
              meta.folderId = updates.folder;
          }
          
          await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, id, {
              metadata: JSON.stringify(meta)
          });
      } catch (error) {
          throw error;
      }
  },

  async bulkInsertQuestions(questions: Question[], userId: string, role: string) {
    for (const q of questions) {
        await this.saveQuestion(q, userId, role);
    }
  },

  // --- SỬA LỖI TẠI ĐÂY: Serverside Filtering cho Exams ---
  async fetchExams(
      userId: string, 
      role: string = 'student',
      options?: { limit?: number; offset?: number; search?: string; folder?: string }
  ): Promise<{ documents: Exam[]; total: number }> {
    try {
        const queries = [Query.orderDesc('$createdAt')];
        
        if (options?.limit) queries.push(Query.limit(options.limit));
        else queries.push(Query.limit(500));
        
        if (options?.offset) queries.push(Query.offset(options.offset));

        if (role === 'teacher') {
            queries.push(Query.or([
                Query.equal('creator_id', [userId]),
                Query.notEqual('class_id', null as any) // Cho phép xem đề đã giao lớp
            ]));
        } else if (role === 'student') {
            // Học sinh chỉ thấy đề đã giao cho lớp của mình (sẽ được xử lý bởi logic gọi từ component)
        }

        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, queries);
        let docs = response.documents.map(mapDbExamToLocal);

        // Client side filter fallback for complex JSON structure
        if (options?.folder && options.folder !== 'ALL') {
            docs = docs.filter(e => e.folder === options.folder);
        }
        if (options?.search) {
            const lowerSearch = options.search.toLowerCase();
            docs = docs.filter(e => e.title && e.title.toLowerCase().includes(lowerSearch));
        }

        return { documents: docs, total: response.total };
    } catch (error: any) {
        console.error("Lỗi tải đề thi:", error);
        return { documents: [], total: 0 };
    }
  },

  async deleteExam(id: string) {
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id);
      } catch (error) {
          throw error;
      }
  },

  async updateExam(id: string, updates: any) {
      try {
          const doc = await databases.getDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id);
          let configObj: any = {};
          try { configObj = JSON.parse(doc.config || '{}'); } catch(e) {}

          if (updates.folder !== undefined) configObj.folder = updates.folder;
          if (updates.start_time !== undefined) configObj.start_time = updates.start_time;
          if (updates.end_time !== undefined) configObj.end_time = updates.end_time;
          if (updates.exam_password !== undefined) configObj.exam_password = updates.exam_password;
          if (updates.shuffle_questions !== undefined) configObj.shuffle_questions = updates.shuffle_questions;
          if (updates.shuffle_options !== undefined) configObj.shuffle_options = updates.shuffle_options;
          if (updates.status !== undefined) configObj.status = updates.status;
          if (updates.class_id !== undefined) configObj.class_id = updates.class_id;
          if (updates.exam_purpose !== undefined) configObj.exam_purpose = updates.exam_purpose;
          if (updates.max_attempts !== undefined) configObj.max_attempts = updates.max_attempts;

          // Xử lý đồng bộ: Nếu cập nhật trường phẳng, hãy gỡ khỏi config JSON để tránh redundancy
          if (updates.title !== undefined) delete configObj.title;
          if (updates.type !== undefined) delete configObj.type;
          if (updates.question_ids !== undefined) {
              delete configObj.question_ids;
              delete configObj.questionIds;
          }

          const dbPayload: any = {
              config: JSON.stringify(configObj)
          };

          if (updates.title !== undefined) dbPayload.title = updates.title;
          if (updates.question_ids !== undefined) dbPayload.question_ids = updates.question_ids;
          if (updates.type !== undefined) dbPayload.type = updates.type;

          await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id, dbPayload);
      } catch (error) {
          console.error("Lỗi cập nhật đề thi:", error);
          throw error;
      }
  },

  // --- SỬA LỖI TẠI ĐÂY: Bỏ các cột có thể không tồn tại trên Appwrite ---
  async saveExam(e: Exam, userId: string, role: string = 'student') {
    try {
        const configToSave: any = {
            ...(e.config || {}),
            exam_purpose: e.exam_purpose || e.config?.exam_purpose || 'both',
            status: e.status || e.config?.status || 'draft',
            class_id: e.sharedWithClassId || e.config?.class_id || null,
            max_attempts: e.config?.max_attempts || 1,
            folder: e.folder || 'Mặc định'
        };

        // Rút gọn config tối đa để tránh Row Size Limit (Appwrite)
        delete configToSave.questionIds;
        delete configToSave.question_ids;
        delete configToSave.title;
        delete configToSave.type;
        delete configToSave.exam_type;
        delete configToSave.folder;
        delete configToSave.subject_name;
        delete configToSave.module_name;

        const payload = {
            title: e.title,
            type: e.type || e.exam_type || 'REGULAR',
            question_ids: e.questionIds || [],
            config: JSON.stringify(configToSave), 
            creator_id: userId
        };
        const created = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, ID.unique(), payload);
        return mapDbExamToLocal(created);
    } catch (error) {
        console.error("Lỗi lưu đề thi:", error);
        throw error;
    }
  },

  async bulkInsertExams(exams: Exam[], userId: string, role: string) {
    for (const e of exams) { await this.saveExam(e, userId, role); }
  },

  async fetchUserDocuments(userId: string, role: string) {
    try {
        const queries = [Query.orderDesc('$createdAt'), Query.limit(500)];
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.user_documents, queries);
        return response.documents;
    } catch (error: any) {
        console.error("Fetch User Docs Error:", error);
        return [];
    }
  },

  async fetchClasses(teacherId?: string): Promise<any[]> {
    try {
        const queries: any[] = [];
        if (teacherId) queries.push(Query.equal('teacher_id', [teacherId]));
        queries.push(Query.orderDesc('$createdAt'));
        queries.push(Query.limit(100));
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.classes, queries);
        return response.documents.map(mapDoc);
    } catch (error: any) {
        return handleFetchError('fetchClasses', error);
    }
  },

  async updateClass(classId: string, name: string) {
      try {
          await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.classes, classId, { name });
      } catch (error) { throw error; }
  },

  async deleteClass(classId: string) {
      try {
          // 1. Tìm tất cả user thuộc lớp này
          const users = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, [Query.equal('class_id', classId)]);
          // 2. Gỡ biên chế (set class_id = null)
          for (const doc of users.documents) {
              await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, doc.$id, { class_id: null });
              // Throttling: Chờ 200ms trước khi tiếp tục để tránh API rate limit
              await new Promise(resolve => setTimeout(resolve, 200));
          }
          // 3. Xóa lớp
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.classes, classId);
      } catch (error) { throw error; }
  },
  
  async fetchStudentsByClass(classId: string) {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId, 
            APPWRITE_CONFIG.collections.profiles, 
            [
                Query.equal('role', 'student'), 
                Query.equal('class_id', classId),
                Query.limit(500)
            ]
        );
        return response.documents.map((doc: any) => ({
            id: doc.$id, 
            fullName: doc.full_name, 
            email: doc.email, 
            role: doc.role, 
            status: doc.status?.toLowerCase(), // Chuẩn hóa về chữ thường để UI dễ check
            classId: doc.class_id, 
            avatarUrl: doc.avatar_url,
            created_by: doc.created_by // Bổ sung lấy tên Giáo viên tạo
        }));
    } catch (error) { return []; }
  },

  // --- TẠO HỌC VIÊN TRỰC TIẾP BỞI GIÁO VIÊN ---
  async createStudentByTeacher(studentData: { email: string; password: string; fullName: string; classId: string; teacherName: string }) {
      try {
          const authUser = await createAuthUserAsAdmin(studentData.email, studentData.password, studentData.fullName);
          const userId = authUser.$id || authUser.id; 
          
          const profilePayload = {
              email: studentData.email,
              full_name: studentData.fullName,
              role: 'student',
              status: 'approved',
              class_id: studentData.classId,
              avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(studentData.fullName)}&background=random`,
              created_by: studentData.teacherName // LƯU VẾT GIÁO VIÊN TẠO
          };
          
          const doc = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, userId, profilePayload);
          
          return {
              id: doc.$id, fullName: doc.full_name, email: doc.email, role: doc.role, status: doc.status, classId: doc.class_id, avatarUrl: doc.avatar_url, created_by: doc.created_by
          };
      } catch (error) {
          console.error("Lỗi tạo học viên bởi Giáo viên:", error);
          throw error;
      }
  },

  async fetchLectures(userId: string, role: string, classId?: string): Promise<any[]> {
    try {
        const queries: any[] = [Query.orderDesc('$createdAt'), Query.limit(100)];
        
        // Học viên chỉ thấy khóa học của lớp mình
        if (role === 'student' && classId) {
            queries.push(Query.equal('shared_with_class_id', [classId]));
        } 
        // Giáo viên chỉ thấy khóa do mình tạo (hoặc bạn có thể bỏ dòng này nếu muốn GV thấy hết)
        else if (role === 'teacher') {
            queries.push(Query.equal('creator_id', [userId]));
        }
        
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, queries);
        return response.documents.map((doc: any) => {
            let configObj = { modules: [] };
            if (doc.config) {
                try { configObj = typeof doc.config === 'string' ? JSON.parse(doc.config) : doc.config; } catch(e) {}
            }
            return {
                id: doc.$id,
                title: doc.title,
                class_id: doc.shared_with_class_id,
                creator_id: doc.creator_id,
                createdAt: doc.$createdAt,
                config: configObj
            };
        });
    } catch (error: any) { 
        console.error("Lỗi tải Bài giảng:", error);
        return []; 
    }
  },
async saveCourse(courseData: any, userId: string) {
      try {
          const payload = {
              title: courseData.title,
              shared_with_class_id: courseData.class_id || null,
              creator_id: userId,
              config: JSON.stringify(courseData.config) // Nén toàn bộ cây thư mục vào JSON
          };

          if (courseData.id) {
              await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, courseData.id, payload);
              return { ...courseData, config: payload.config };
          } else {
              const doc = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, ID.unique(), payload);
              return { ...courseData, id: doc.$id, config: payload.config };
          }
      } catch (error) {
          console.error("Lỗi lưu Khóa học:", error);
          throw error;
      }
  },

  async deleteCourse(courseId: string) {
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, courseId);
      } catch (error) {
          console.error("Lỗi xóa Khóa học:", error);
          throw error;
      }
  },

  // --- SCHEDULE (LỊCH CÔNG TÁC) ---
  async fetchSchedules(classId?: string): Promise<any[]> {
    try {
        const queries: any[] = [Query.orderDesc('$createdAt'), Query.limit(500)];
        if (classId) {
            // Lấy cả lịch riêng của lớp và lịch chung (Global Events)
            queries.push(Query.equal('class_id', [classId, 'all', '']));
        }
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.schedules, queries);
        return response.documents.map((doc: any) => ({
            id: doc.$id,
            title: doc.title,
            description: doc.description || '',
            date: doc.startDate?.split('T')[0] || doc.date || '',
            startDate: doc.startDate || doc.date || '',
            endDate: doc.endDate || doc.startDate || doc.date || '',
            isAllDay: doc.isAllDay ?? true,
            color: doc.color || '#3b82f6',
            reminderMinutes: doc.reminderMinutes ?? 0,
            class_id: doc.class_id,
            creator_id: doc.creator_id,
            createdAt: doc.$createdAt ? new Date(doc.$createdAt).getTime() : Date.now()
        }));
    } catch (error: any) {
        return handleFetchError('fetchSchedules', error);
    }
  },

  async saveSchedule(data: any) {
    try {
        const payload: any = {
            title: data.title,
            description: data.description || '',
            startDate: data.startDate || data.date || '',
            endDate: data.endDate || data.startDate || data.date || '',
            isAllDay: data.isAllDay ?? true,
            color: data.color || '#3b82f6',
            reminderMinutes: data.reminderMinutes ?? 0,
            class_id: data.class_id,
            creator_id: data.creator_id
        };
        const doc = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.schedules, ID.unique(), payload);
        return {
            id: doc.$id,
            title: doc.title,
            description: doc.description,
            startDate: doc.startDate,
            endDate: doc.endDate,
            isAllDay: doc.isAllDay,
            color: doc.color,
            reminderMinutes: doc.reminderMinutes,
            class_id: doc.class_id,
            creator_id: doc.creator_id,
            createdAt: new Date(doc.$createdAt).getTime()
        };
    } catch (error) {
        console.error("Lỗi tạo lịch:", error);
        throw error;
    }
  },

  async updateSchedule(id: string, data: any) {
    try {
        const payload: any = {};
        if (data.title !== undefined) payload.title = data.title;
        if (data.description !== undefined) payload.description = data.description;
        if (data.startDate !== undefined) {
            payload.startDate = data.startDate;
        }
        if (data.endDate !== undefined) payload.endDate = data.endDate;
        if (data.isAllDay !== undefined) payload.isAllDay = data.isAllDay;
        if (data.color !== undefined) payload.color = data.color;
        if (data.reminderMinutes !== undefined) payload.reminderMinutes = data.reminderMinutes;
        if (data.class_id !== undefined) payload.class_id = data.class_id;

        await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.schedules, id, payload);
    } catch (error) {
        console.error("Lỗi cập nhật lịch:", error);
        throw error;
    }
  },

  async deleteSchedule(id: string) {
    try {
        await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.schedules, id);
    } catch (error) {
        console.error("Lỗi xóa lịch:", error);
        throw error;
    }
  }
};
// --- FOLDER MANAGEMENT (Appwrite-based) ---

export const fetchCustomFolders = async (moduleName: 'question' | 'exam'): Promise<string[]> => {
    try {
        const res = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.folders, [
            Query.equal('module', moduleName),
            Query.limit(100)
        ]);
        return res.documents.map(doc => doc.name);
    } catch (error) { console.error("Lỗi tải thư mục:", error); return []; }
};

export const createCustomFolder = async (name: string, moduleName: 'question' | 'exam') => {
    try {
        await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.folders, ID.unique(), {
            name: name,
            module: moduleName
        });
    } catch (error) { console.error("Lỗi tạo thư mục:", error); throw error; }
};

export const deleteCustomFolder = async (name: string, moduleName: 'question' | 'exam') => {
    try {
        const res = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.folders, [
            Query.equal('name', name),
            Query.equal('module', moduleName)
        ]);
        if (res.documents.length > 0) {
            for (const doc of res.documents) {
                await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.folders, doc.$id);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    } catch (error) { console.error("Lỗi xóa thư mục:", error); throw error; }
};

// --- EXAM RESULTS ---
export const submitExamResult = async (resultData: any) => {
    try {
        return await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.examResults,
            ID.unique(),
            resultData
        );
    } catch (error) { console.error("Lỗi lưu điểm thi:", error); throw error; }
};

export const updateExamResult = async (id: string, resultData: any) => {
    try {
        return await databases.updateDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.examResults,
            id,
            resultData
        );
    } catch (error) { console.error("Lỗi cập nhật điểm thi:", error); throw error; }
};

export const fetchLatestExamAttempt = async (examId: string, studentId: string): Promise<any | null> => {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.examResults,
            [
                Query.equal('exam_id', examId),
                Query.equal('student_id', studentId),
                Query.orderDesc('$createdAt'),
                Query.limit(1)
            ]
        );
        if (response.documents.length > 0) {
            const doc = response.documents[0];
            return {
                ...doc,
                id: doc.$id,
                createdAt: doc.$createdAt
            };
        }
        return null;
    } catch (error) {
        console.error("Lỗi tải lần thi gần nhất:", error);
        return null;
    }
};

export const fetchExamResults = async (examId: string): Promise<any[]> => {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.examResults,
            [
                Query.equal('exam_id', examId),
                Query.orderDesc('$createdAt'),
                Query.limit(500)
            ]
        );
        return response.documents.map((doc: any) => ({
            ...doc,
            id: doc.$id,
            createdAt: doc.$createdAt
        }));
    } catch (error) {
        console.error("Lỗi tải kết quả thi:", error);
        return [];
    }
};

export const fetchStudentAttemptCount = async (examId: string, studentId: string): Promise<number> => {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.examResults,
            [
                Query.equal('exam_id', examId),
                Query.equal('student_id', studentId),
                Query.limit(1)
            ]
        );
        return response.total;
    } catch (error) {
        console.error("Lỗi đếm số lần thi:", error);
        return 0;
    }
};