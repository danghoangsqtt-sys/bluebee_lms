import React, { createContext, useContext, useEffect, useState } from 'react';
import { account, databases, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { UserProfile, UserRole, UserStatus } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string, classId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // 1. Kiểm tra session hiện tại
      const sessionUser = await account.get();
      // 2. Lấy thông tin chi tiết từ collection profiles
      await fetchProfile(sessionUser.$id, sessionUser.email);
    } catch (error) {
      // Không có session
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const profile = await databases.getDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        userId
      );

      if (profile) {
        setUser({
          id: userId,
          email: email,
          fullName: profile.full_name || 'User',
          role: profile.role as UserRole,
          // Sử dụng avatar URL từ DB hoặc tạo mới nếu chưa có
          avatarUrl: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'User')}&background=random`,
          classId: profile.class_id,
          status: (profile.status as UserStatus) || 'active',
          updatedAt: profile.$updatedAt ? new Date(profile.$updatedAt).getTime() : undefined
        });
      }
    } catch (err) {
      console.error("Không tìm thấy profile, sử dụng thông tin mặc định...", err);
      // Kiểm tra nếu là tài khoản Admin tạo thủ công trên backend (không có profile)
      const isAdminEmail = email.startsWith('admin@');
      setUser({
        id: userId,
        email: email,
        fullName: isAdminEmail ? 'Super Admin' : 'Người dùng',
        role: isAdminEmail ? 'admin' : 'student',
        status: 'active',
        avatarUrl: `https://ui-avatars.com/api/?name=${isAdminEmail ? 'Admin' : 'User'}&background=random`
      });
    }
  };

  const login = async (email: string, pass: string) => {
    await account.createEmailPasswordSession(email, pass);
    await checkSession();
  };

  const register = async (email: string, pass: string, name: string, classId?: string) => {
    // 1. Tạo tài khoản Appwrite Identity
    const userId = ID.unique();
    await account.create(userId, email, pass, name);
    
    // 2. Đăng nhập ngay lập tức để lấy session
    await account.createEmailPasswordSession(email, pass);

    // 3. Logic "Hồ sơ chờ" (Pre-registration)
    // Kiểm tra xem đã có profile nào được tạo trước bởi Admin với email này chưa
    let finalRole = 'student';
    let finalClassId = classId || null;
    let finalStatus = 'pending'; // Tự đăng ký thì phải chờ Admin duyệt

    try {
      const existingProfiles = await databases.listDocuments(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        [Query.equal('email', email)]
      );

      if (existingProfiles.documents.length > 0) {
        // Tìm thấy hồ sơ chờ, lấy quyền hạn và lớp học đã gán
        const oldProfile = existingProfiles.documents[0];
        finalRole = oldProfile.role;
        finalClassId = oldProfile.class_id;
        // Xóa hồ sơ chờ (rác) vì ta sẽ tạo hồ sơ chính thức gắn với ID của Auth User
        await databases.deleteDocument(
          APPWRITE_CONFIG.dbId,
          APPWRITE_CONFIG.collections.profiles,
          oldProfile.$id
        );
      }
    } catch (e) {
      console.warn("Lỗi kiểm tra hồ sơ chờ:", e);
    }

    // 4. Tạo Document Profile Chính thức (Quan trọng: ID document trùng với ID User)
    const autoAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;

    await databases.createDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        (await account.get()).$id, // Lấy ID chính xác từ session vừa tạo
        {
            full_name: name,
            role: finalRole, 
            status: finalStatus,
            email: email,
            class_id: finalClassId,
            avatar_url: autoAvatarUrl
        }
    );

    await checkSession();
  };

  const signOut = async () => {
    await account.deleteSession('current');
    setUser(null);
  };

  const refreshProfile = async () => {
    if (user?.id && user?.email) {
      setLoading(true);
      await fetchProfile(user.id, user.email);
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const value = {
    user,
    loading,
    login,
    register,
    signOut,
    refreshProfile,
    isAdmin,
    isTeacher,
    isStudent
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};