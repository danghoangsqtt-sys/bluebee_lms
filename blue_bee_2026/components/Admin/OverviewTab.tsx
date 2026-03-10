
import React, { useState, useEffect } from 'react';
import { databases, APPWRITE_CONFIG, ID, Query } from '../../lib/appwrite';

interface ScheduleItem {
  id: string;
  content: string;
  date: string;
}

interface TacticalTask {
  id: string;
  task: string;
  assignee: string;
  completed: boolean;
}

const OverviewTab: React.FC = () => {
  // --- LỊCH LÀM VIỆC STATE ---
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [newScheduleContent, setNewScheduleContent] = useState('');
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);

  // --- NHIỆM VỤ STATE ---
  const [tasks, setTasks] = useState<TacticalTask[]>([]);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  // --- TARGETING STATE ---
  const [targetType, setTargetType] = useState('all');
  const [targetId, setTargetId] = useState('');
  const [taskTargetType, setTaskTargetType] = useState('all');
  const [taskTargetId, setTaskTargetId] = useState('');

  useEffect(() => {
    fetchSchedules();
    fetchTasks();
  }, []);

  const fetchSchedules = async () => {
    try {
        setIsLoadingSchedules(true);
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.schedules,
            [Query.orderAsc('startDate'), Query.limit(50)]
        );
        setSchedules(response.documents.map(doc => ({
            id: doc.$id,
            content: doc.title || doc.content || 'Không có tiêu đề',
            date: doc.startDate || doc.date || ''
        })));
    } catch (error) {
        console.error('Error fetching schedules:', error);
    } finally {
        setIsLoadingSchedules(false);
    }
  };

  const fetchTasks = async () => {
    try {
        setIsLoadingTasks(true);
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.tasks,
            [Query.orderDesc('$createdAt'), Query.limit(50)]
        );
        setTasks(response.documents.map(doc => ({
            id: doc.$id,
            task: doc.content,
            assignee: doc.assignee,
            completed: doc.isCompleted
        })));
    } catch (error) {
        console.error('Error fetching tasks:', error);
    } finally {
        setIsLoadingTasks(false);
    }
  };

  const addSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleContent || !newScheduleDate) return;
    try {
        await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.schedules,
            ID.unique(),
            { 
              title: newScheduleContent, // Sử dụng field title làm chuẩn chính
              content: newScheduleContent, // Giữ lại content để tương thích ngược
              startDate: newScheduleDate,
              endDate: newScheduleDate, 
              class_id: targetType === 'class' ? targetId : 'all',
              targetType,
              targetId
            }
        );
        setNewScheduleContent('');
        setNewScheduleDate('');
        setTargetId('');
        fetchSchedules();
    } catch (error) {
        console.error('Error adding schedule:', error);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskContent || !newTaskAssignee) return;
    try {
        await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.tasks,
            ID.unique(),
            { 
              content: newTaskContent, 
              assignee: newTaskAssignee, 
              isCompleted: false,
              targetType: taskTargetType,
              targetId: taskTargetId
            }
        );
        setNewTaskContent('');
        setNewTaskAssignee('');
        setTaskTargetId('');
        fetchTasks();
    } catch (error) {
        console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    try {
        await databases.updateDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.tasks,
            id,
            { isCompleted: !currentStatus }
        );
        fetchTasks();
    } catch (error) {
        console.error('Error toggling task:', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
        await databases.deleteDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.tasks,
            id
        );
        fetchTasks();
    } catch (error) {
        console.error('Error deleting task:', error);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
        await databases.deleteDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.schedules,
            id
        );
        fetchSchedules();
    } catch (error) {
        console.error('Error deleting schedule:', error);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* WIDGET: LỊCH TRÌNH & KẾ HOẠCH */}
        <div className="bg-white border-2 border-slate-200 rounded-sm overflow-hidden flex flex-col h-full">
            <div className="bg-blue-900 px-4 py-3 border-b-2 border-yellow-500 flex items-center gap-2">
                <i className="fas fa-calendar-alt text-yellow-400"></i>
                <h3 className="font-black text-white text-[11px] uppercase tracking-wider">Lịch trình & Kế hoạch</h3>
            </div>
            
            <div className="p-4 flex-1 space-y-4">
                <form onSubmit={addSchedule} className="grid grid-cols-1 gap-2 border-b border-slate-100 pb-4">
                    <div className="flex gap-2">
                        <select 
                            value={targetType}
                            onChange={e => setTargetType(e.target.value)}
                            title="Đối tượng đích"
                            className="w-1/3 p-2.5 bg-slate-50 border border-slate-300 rounded-sm text-[10px] font-black uppercase focus:border-blue-900 outline-none"
                        >
                            <option value="all">Tất cả</option>
                            <option value="teacher">Giáo viên</option>
                            <option value="student">Học viên</option>
                            <option value="class">Lớp</option>
                        </select>
                        {targetType !== 'all' && (
                            <input 
                                type="text" 
                                value={targetId}
                                onChange={e => setTargetId(e.target.value)}
                                placeholder="Mã/ID..." 
                                title="Mã hoặc ID đối tượng"
                                className="flex-1 p-2.5 bg-slate-100 border border-slate-300 rounded-sm text-xs font-bold text-blue-900 focus:border-blue-900 outline-none"
                            />
                        )}
                    </div>
                    <input 
                        type="text" 
                        value={newScheduleContent}
                        onChange={e => setNewScheduleContent(e.target.value)}
                        placeholder="Nội dung kế hoạch..." 
                        title="Nội dung kế hoạch mới"
                        className="p-2.5 bg-slate-50 border border-slate-300 rounded-sm text-xs focus:border-blue-900 outline-none font-bold"
                    />
                    <div className="flex gap-2">
                        <input 
                            type="date" 
                            title="Ngày thực hiện"
                            value={newScheduleDate}
                            onChange={e => setNewScheduleDate(e.target.value)}
                            className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-sm text-xs focus:border-blue-900 outline-none font-bold"
                        />
                        <button type="submit" title="Thêm lịch trình" className="bg-blue-900 text-white px-4 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                            Thêm
                        </button>
                    </div>
                </form>

                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                   {isLoadingSchedules ? (
                       <div className="py-10 text-center"><i className="fas fa-spinner fa-spin text-blue-900"></i></div>
                   ) : schedules.map(item => (
                       <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 border-l-4 border-blue-900 rounded-sm group hover:bg-slate-100 transition-colors">
                           <div className="space-y-1">
                               <p className="text-xs font-bold text-slate-700">{item.content}</p>
                               <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                                   <i className="fas fa-clock mr-1"></i> {item.date}
                               </p>
                           </div>
                           <button onClick={() => deleteSchedule(item.id)} title="Xóa lịch" className="text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                               <i className="fas fa-trash-alt text-xs"></i>
                           </button>
                       </div>
                   ))}
                   {!isLoadingSchedules && schedules.length === 0 && <p className="text-center py-10 text-slate-400 text-[10px] uppercase font-bold">Chưa có lịch làm việc</p>}
                </div>
            </div>
        </div>

        {/* WIDGET: NHIỆM VỤ HỌC TẬP */}
        <div className="bg-white border-2 border-slate-200 rounded-sm overflow-hidden flex flex-col h-full">
            <div className="bg-blue-900 px-4 py-3 border-b-2 border-yellow-500 flex items-center gap-2">
                <i className="fas fa-tasks text-yellow-400"></i>
                <h3 className="font-black text-white text-[11px] uppercase tracking-wider">Nhiệm vụ học tập</h3>
            </div>

            <div className="p-4 flex-1 space-y-4">
                <form onSubmit={addTask} className="space-y-2 border-b border-slate-100 pb-4">
                    <div className="flex gap-2">
                        <select 
                            value={taskTargetType}
                            onChange={e => setTaskTargetType(e.target.value)}
                            title="Đối tượng giao việc"
                            className="w-1/3 p-2.5 bg-slate-50 border border-slate-300 rounded-sm text-[10px] font-black uppercase focus:border-blue-900 outline-none"
                        >
                            <option value="all">Tất cả</option>
                            <option value="teacher">Giáo viên</option>
                            <option value="student">Học viên</option>
                        </select>
                        {taskTargetType !== 'all' && (
                            <input 
                                type="text" 
                                value={taskTargetId}
                                onChange={e => setTaskTargetId(e.target.value)}
                                placeholder="Mã/ID..." 
                                title="Mã hoặc ID đối tượng"
                                className="flex-1 p-2.5 bg-slate-100 border border-slate-300 rounded-sm text-xs font-bold text-blue-900 focus:border-blue-900 outline-none"
                            />
                        )}
                    </div>
                    <input 
                        type="text" 
                        value={newTaskContent}
                        title="Nội dung nhiệm vụ"
                        onChange={e => setNewTaskContent(e.target.value)}
                        placeholder="Nội dung nhiệm vụ..." 
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-sm text-xs focus:border-blue-900 outline-none font-bold"
                    />
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newTaskAssignee}
                            title="Người phụ trách"
                            onChange={e => setNewTaskAssignee(e.target.value)}
                            placeholder="Người phụ trách..." 
                            className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-sm text-xs focus:border-blue-900 outline-none font-bold"
                        />
                        <button type="submit" title="Giao nhiệm vụ" className="bg-blue-900 text-white px-4 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                            Giao việc
                        </button>
                    </div>
                </form>

                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {isLoadingTasks ? (
                        <div className="py-10 text-center"><i className="fas fa-spinner fa-spin text-blue-900"></i></div>
                    ) : tasks.map(task => (
                        <div key={task.id} className={`flex items-start gap-3 p-3 border rounded-sm transition-all group ${task.completed ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-blue-200'}`}>
                            <input 
                                type="checkbox" 
                                checked={task.completed} 
                                title={`Đánh dấu hoàn thành: ${task.task}`}
                                onChange={() => toggleTask(task.id, task.completed)}
                                className="mt-1 w-4 h-4 border-2 border-blue-900 rounded-sm text-blue-900 focus:ring-0 cursor-pointer"
                            />
                            <div className="flex-1 space-y-1">
                                <p className={`text-xs font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                    {task.task}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-mono bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded-sm border border-blue-100 uppercase font-black">
                                        <i className="fas fa-user mr-1"></i> {task.assignee}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => deleteTask(task.id)} title="Xóa nhiệm vụ" className="text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                                <i className="fas fa-times text-xs"></i>
                            </button>
                        </div>
                    ))}
                    {!isLoadingTasks && tasks.length === 0 && <p className="text-center py-10 text-slate-400 text-[10px] uppercase font-bold">Chưa có nhiệm vụ phân công</p>}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default OverviewTab;
