
import React, { useState, useEffect } from 'react';
import { databases, APPWRITE_CONFIG, ID, Query } from '../../lib/appwrite';

interface MarqueeBannerProps {
    onNotify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    allowEdit?: boolean;
}

const MarqueeBanner: React.FC<MarqueeBannerProps> = ({ onNotify, allowEdit = false }) => {
    const [marqueeText, setMarqueeText] = useState('ĐANG TẢI THÔNG BÁO...');

    useEffect(() => {
        fetchNotification();
    }, []);

    const fetchNotification = async () => {
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.dbId,
                APPWRITE_CONFIG.collections.notifications,
                [Query.orderDesc('$createdAt'), Query.limit(1)]
            );
            if (response.documents.length > 0) {
                const doc = response.documents[0];
                setMarqueeText(doc.message || doc.content || '');
            } else {
                setMarqueeText('CHÀO MỪNG QUÝ ĐỒNG CHÍ ĐẾN VỚI HỆ THỐNG HỌC TẬP - HIỆU QUẢ, LINH HOẠT, BẢO MẬT.');
            }
        } catch (error) {
            console.error('Error fetching notification:', error);
            setMarqueeText('LỖI KẾT NỐI HỆ THỐNG THÔNG BÁO.');
        }
    };

    const handleEditMarquee = async () => {
        if (!allowEdit) return;
        const newText = window.prompt('Nhập nội dung thông báo mới:', marqueeText);
        if (newText && newText.trim() !== '') {
            try {
                await databases.createDocument(
                    APPWRITE_CONFIG.dbId,
                    APPWRITE_CONFIG.collections.notifications,
                    ID.unique(),
                    { message: newText }
                );
                setMarqueeText(newText);
                if (onNotify) onNotify('Cập nhật thông báo thành công', 'success');
            } catch (error) {
                console.error('Error updating notification:', error);
                if (onNotify) onNotify('Lỗi cập nhật thông báo', 'error');
            }
        }
    };

    return (
        <div className="bg-red-900 border-y-2 border-red-800 text-white h-10 flex items-center relative overflow-hidden group rounded-sm mb-4">
            <div className="bg-red-950 px-4 h-full flex items-center gap-2 border-r border-red-800 z-20 relative font-black text-[10px] uppercase tracking-widest shadow-[5px_0_10px_rgba(0,0,0,0.3)]">
                <i className="fas fa-bullhorn animate-bounce"></i> Thông báo
            </div>
            <div className="flex-1 overflow-hidden relative h-full flex items-center bg-red-900/50">
                <div className="animate-marquee font-bold text-sm uppercase tracking-widest text-yellow-400 whitespace-nowrap">
                    {marqueeText} &nbsp; • &nbsp; {marqueeText} &nbsp; • &nbsp; {marqueeText}
                </div>
            </div>
            {allowEdit && (
                <button 
                    onClick={handleEditMarquee}
                    title="Sửa nội dung thông báo"
                    className="absolute right-0 top-0 h-full bg-red-950 px-3 hover:bg-red-800 transition-colors z-20 opacity-0 group-hover:opacity-100 flex items-center border-l border-red-800"
                >
                    <i className="fas fa-edit text-xs"></i>
                </button>
            )}
        </div>
    );
};

export default MarqueeBanner;
