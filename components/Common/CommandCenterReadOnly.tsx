
import React, { useState, useEffect } from 'react';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';

interface DashboardWidgetProps {
    user: any;
    type: 'schedule' | 'task';
}

const CommandCenterReadOnly: React.FC<DashboardWidgetProps> = ({ user, type }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [user, type]);

    const fetchData = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const collectionId = type === 'schedule' 
                ? APPWRITE_CONFIG.collections.schedules 
                : APPWRITE_CONFIG.collections.tasks;

            const queries = [
                Query.orderDesc('$createdAt'),
                Query.limit(20)
            ];

            if (type === 'schedule') {
                // schedules collection uses class_id field (not targetType/targetId)
                if (user.role === 'student' && user.classId) {
                    queries.push(Query.equal('class_id', ['all', user.classId]));
                }
                // teachers and admins see all schedules
            } else {
                // tasks collection uses targetType/targetId
                if (user.role === 'teacher') {
                    queries.push(Query.equal('targetType', ['all', 'teacher']));
                    queries.push(Query.equal('targetId', ['', 'all', user.id]));
                } else if (user.role === 'student') {
                    const targetTypes = ['all', 'student'];
                    const targetIds = ['', 'all', user.id];

                    if (user.classId) {
                        targetTypes.push('class');
                        targetIds.push(user.classId);
                    }

                    queries.push(Query.equal('targetType', targetTypes));
                    queries.push(Query.equal('targetId', targetIds));
                }
            }

            const response = await databases.listDocuments(
                APPWRITE_CONFIG.dbId,
                collectionId,
                queries
            );

            setData(response.documents);
        } catch (error) {
            console.error(`Error fetching ${type}:`, error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTask = async (id: string, currentStatus: boolean) => {
        if (type !== 'task') return;
        try {
            await databases.updateDocument(
                APPWRITE_CONFIG.dbId,
                APPWRITE_CONFIG.collections.tasks,
                id,
                { isCompleted: !currentStatus }
            );
            fetchData();
        } catch (error) {
            console.error('Error toggling task:', error);
        }
    };

    if (type === 'schedule') {
        return (
            <div className="bg-white border-2 border-slate-200 rounded-sm overflow-hidden flex flex-col h-full">
                <div className="bg-blue-900 px-4 py-3 border-b-2 border-yellow-500 flex items-center gap-2">
                    <i className="fas fa-calendar-day text-yellow-400"></i>
                    <h3 className="font-black text-white text-[11px] uppercase tracking-wider">Lịch trình & Kế hoạch</h3>
                </div>
                <div className="p-4 flex-1">
                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {loading ? (
                            <div className="py-10 text-center"><i className="fas fa-spinner fa-spin text-blue-900"></i></div>
                        ) : data.length > 0 ? (
                            data.map(item => (
                                <div key={item.$id} className="p-3 bg-slate-50 border-l-4 border-blue-900 rounded-sm">
                                    <p className="text-xs font-bold text-slate-700">{item.title || item.content || 'Không có tiêu đề'}</p>
                                    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-1">
                                        <i className="fas fa-clock mr-1"></i> {item.startDate || item.date}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-10 text-slate-400 text-[10px] uppercase font-bold tracking-widest leading-loose">
                                Hiện không có lịch trình nào mới<br/>được giao cho bạn.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border-2 border-slate-200 rounded-sm overflow-hidden flex flex-col h-full">
            <div className="bg-blue-900 px-4 py-3 border-b-2 border-yellow-500 flex items-center gap-2">
                <i className="fas fa-tasks text-yellow-400"></i>
                <h3 className="font-black text-white text-[11px] uppercase tracking-wider">Nhiệm vụ học tập</h3>
            </div>
            <div className="p-4 flex-1">
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {loading ? (
                        <div className="py-10 text-center"><i className="fas fa-spinner fa-spin text-blue-900"></i></div>
                    ) : data.length > 0 ? (
                        data.map(task => (
                            <div key={task.$id} className={`flex items-start gap-3 p-3 border rounded-sm transition-all ${task.isCompleted ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-blue-200'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={task.isCompleted} 
                                    title={`Đánh dấu hoàn thành: ${task.content}`}
                                    onChange={() => toggleTask(task.$id, task.isCompleted)}
                                    className="mt-1 w-4 h-4 border-2 border-blue-900 rounded-sm text-blue-900 focus:ring-0 cursor-pointer"
                                />
                                <div className="flex-1 space-y-1">
                                    <p className={`text-xs font-bold ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                        {task.content}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded-sm border border-blue-100 uppercase font-black">
                                            <i className="fas fa-user-shield mr-1"></i> Hệ thống Phân công
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center py-10 text-slate-400 text-[10px] uppercase font-bold tracking-widest leading-loose">
                            Hiện tại không có nhiệm vụ cụ thể<br/>được phân công cho bạn.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandCenterReadOnly;
