

import React, { useState, useRef, useEffect } from 'react';
import { generateChatResponse } from '../services/geminiService';
import { ChatMessage, KnowledgeDocument } from '../types';
import { formatContent } from '../utils/textFormatter';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ChatbotProps {
  temperature?: number;
  maxTokens?: number;
  aiVoice?: string;
  knowledgeBase: KnowledgeDocument[];
  onNotify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ temperature, maxTokens, aiVoice = 'Kore', knowledgeBase, onNotify }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  
  const getInitialMessage = () => {
      if (user?.role === 'teacher') return `Xin chào Cán bộ quản lý ${user.fullName}. Tôi có thể hỗ trợ gì cho công việc của bạn hôm nay?`;
      if (user?.role === 'admin') return `Hệ thống sẵn sàng. Xin chào Quản trị viên ${user.fullName}.`;
      return `Chào ${user?.fullName || 'bạn'}. Tôi là trợ lý học tập AI. Bạn cần giải đáp thắc mắc gì về môn học?`;
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeModel, setActiveModel] = useState<string>(''); 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (user && messages.length === 0) {
          setMessages([{
              id: 'welcome',
              role: 'model',
              text: getInitialMessage(),
              timestamp: Date.now(),
          }]);
      }
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setActiveModel('');

    try {
        const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const response = await generateChatResponse(
            history, 
            userMsg.text, 
            { temperature, maxOutputTokens: maxTokens },
            knowledgeBase,
            user 
        );
        
        if (response.modelUsed) setActiveModel(response.modelUsed);

        const modelMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: response.text || "Lỗi: Không thể tạo phản hồi.",
            timestamp: Date.now(),
            sources: response.sources,
            isRAG: response.sources.some(s => s.title.includes('Giáo trình'))
        };
        
        setMessages((prev) => [...prev, modelMsg]);
    } catch (error: any) {
        setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: "Không thể xử lý yêu cầu. Vui lòng kiểm tra kết nối mạng.",
            timestamp: Date.now()
        }]);
    } finally {
        setIsLoading(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-0 right-0 z-[9999] flex flex-col items-end pointer-events-none font-[Roboto]">
      {isOpen && (
        <div className="bg-white w-[420px] max-w-[calc(100vw-1rem)] h-[650px] max-h-[calc(100vh-60px)] shadow-2xl flex flex-col pointer-events-auto animate-slide-up border-2 border-blue-900 rounded-md overflow-hidden mr-4 mb-4">
          
          {/* === HEADER — Command Center Style === */}
          <div className="bg-blue-900 shrink-0">
            {/* Top bar — Status line */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-blue-950 border-b border-blue-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-[9px] font-mono font-bold text-green-400 uppercase tracking-[0.2em]">SYSTEM ONLINE</span>
              </div>
              <span className="text-[9px] font-mono text-blue-400">
                {activeModel ? `MODEL: ${activeModel.toUpperCase()}` : 'STANDBY'}
              </span>
            </div>
            {/* Main header */}
            <div className="px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-yellow-500 rounded-sm flex items-center justify-center">
                  <i className="fas fa-terminal text-blue-900 text-sm"></i>
                </div>
                <div>
                  <h3 className="text-white font-black text-xs uppercase tracking-[0.15em]">Trợ Lý AI</h3>
                  <p className="text-[9px] text-blue-300 font-mono">{user?.fullName || 'OPERATOR'} — {user?.role === 'teacher' ? 'CÁN BỘ QUẢN LÝ' : user?.role?.toUpperCase() || 'USER'}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="w-8 h-8 flex items-center justify-center text-blue-400 hover:text-white hover:bg-blue-800 rounded-sm transition-all border border-transparent hover:border-blue-600"
                  title="Đóng panel"
                >
                    <i className="fas fa-times text-sm"></i>
                </button>
              </div>
            </div>
          </div>

          {/* === BODY === */}
          <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col relative">
                <div className="h-full flex flex-col overflow-hidden">
                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                {/* Sender label */}
                                <span className={`text-[9px] font-mono font-bold uppercase tracking-wider mb-1 px-0.5 ${
                                    msg.role === 'user' ? 'text-blue-500' : 'text-slate-400'
                                }`}>
                                    {msg.role === 'user' ? `> ${user?.fullName || 'YOU'}` : '< SYSTEM'}
                                    <span className="text-slate-300 ml-2">{formatTime(msg.timestamp)}</span>
                                </span>

                                {/* Message bubble */}
                                <div 
                                    className={`max-w-[88%] p-3.5 text-sm relative rounded-md ${
                                        msg.role === 'user' 
                                            ? 'bg-blue-800 text-white border border-blue-700' 
                                            : 'bg-white border border-slate-300 text-slate-800 shadow-sm'
                                    }`}
                                >
                                    {/* RAG indicator */}
                                    {msg.role === 'model' && msg.isRAG && (
                                        <div className="text-[9px] font-mono font-bold text-amber-600 mb-2 uppercase tracking-wider flex items-center gap-1.5 border-b border-amber-200 pb-1.5 bg-amber-50 -mx-3.5 -mt-3.5 px-3.5 pt-2 rounded-t-md">
                                            <i className="fas fa-database"></i> LOCAL KB MATCH
                                        </div>
                                    )}
                                    <div className="leading-relaxed whitespace-pre-wrap">
                                      {formatContent(msg.text)}
                                    </div>
                                    {/* Sources */}
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className={`mt-3 pt-2 border-t flex flex-wrap gap-1.5 ${msg.role === 'user' ? 'border-blue-700' : 'border-slate-200'}`}>
                                            {msg.sources.map((src, idx) => (
                                                <a 
                                                    key={idx} 
                                                    href={src.uri} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className={`text-[9px] font-mono font-bold px-2 py-1 rounded-sm transition-all hover:underline ${
                                                        msg.role === 'user' 
                                                            ? 'bg-blue-700 text-blue-200 hover:bg-blue-600' 
                                                            : 'bg-slate-100 border border-slate-200 text-blue-700 hover:bg-blue-50'
                                                    }`}
                                                >
                                                    <i className="fas fa-link mr-0.5"></i> {src.title || "REF"}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex items-start">
                                <div className="bg-white p-3.5 border border-slate-300 rounded-md shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="flex space-x-1">
                                            <div className="w-1.5 h-1.5 bg-blue-900 rounded-full animate-bounce"></div>
                                            <div className="w-1.5 h-1.5 bg-blue-900 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                            <div className="w-1.5 h-1.5 bg-blue-900 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Processing...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* === INPUT BAR === */}
                    <div className="p-3 bg-white border-t-2 border-blue-900">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center bg-slate-100 border border-slate-300 rounded-sm focus-within:border-blue-900 focus-within:bg-white focus-within:shadow-sm transition-all">
                                <span className="text-blue-900 font-mono font-bold text-xs pl-3 select-none">&gt;</span>
                                <input
                                  type="text"
                                  value={input}
                                  onChange={(e) => setInput(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                  placeholder="Nhập lệnh hoặc câu hỏi..."
                                  className="flex-1 bg-transparent border-none text-slate-800 text-sm outline-none placeholder:text-slate-400 px-2 py-2.5 font-medium"
                                  autoFocus
                                />
                            </div>
                            <button
                              onClick={handleSendMessage}
                              disabled={isLoading || !input.trim()}
                              className="w-10 h-10 bg-blue-900 text-white flex items-center justify-center rounded-sm hover:bg-blue-800 disabled:opacity-40 disabled:bg-slate-400 transition-all border border-blue-800 shadow-sm"
                              title="Gửi tin nhắn"
                            >
                              <i className="fas fa-paper-plane text-xs"></i>
                            </button>
                        </div>
                        {/* Footer status */}
                        <div className="flex items-center justify-between mt-2 px-1">
                            <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider">
                                {knowledgeBase.length > 0 ? `KB: ${knowledgeBase.length} DOCUMENTS LOADED` : 'KB: NO DATA'}
                            </span>
                            <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider">
                                {messages.length} MSG
                            </span>
                        </div>
                    </div>
                </div>
          </div>
        </div>
      )}

      {/* === TRIGGER TAB — Edge Strip === */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto flex items-center gap-2 bg-blue-900 text-white pl-4 pr-5 py-3 rounded-l-md shadow-lg hover:bg-blue-800 hover:shadow-xl transition-all border-l-4 border-yellow-500 group"
          title="Mở Trợ lý AI"
        >
          <i className="fas fa-terminal text-yellow-400 text-sm group-hover:animate-pulse"></i>
          <span className="text-[10px] font-black uppercase tracking-[0.15em]">Trợ Lý AI</span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(false)}
          className="pointer-events-auto flex items-center gap-2 bg-slate-800 text-white pl-4 pr-5 py-3 rounded-l-md shadow-lg hover:bg-red-700 transition-all border-l-4 border-red-500 mr-4 mb-2 group"
          title="Đóng Trợ lý AI"
        >
          <i className="fas fa-times text-red-400 text-sm"></i>
          <span className="text-[10px] font-black uppercase tracking-[0.15em]">Đóng Panel</span>
        </button>
      )}
    </div>
  );
};

export default Chatbot;