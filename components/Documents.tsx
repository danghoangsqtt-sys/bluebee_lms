import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentFile, KnowledgeDocument } from '../types';
import { extractTextFromPDF } from '../services/documentProcessor';
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import { databaseService } from '../services/databaseService';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Extend DocumentFile locally to include fileId for cloud operations
interface CloudDocumentFile extends DocumentFile {
    fileId?: string;
    userId?: string;
    isGlobal?: boolean;
}

// Kiểm tra an toàn sự tồn tại của require (Electron) để tránh lỗi Runtime trên Browser
const ipcRenderer = typeof window !== 'undefined' && window.require 
  ? window.require('electron').ipcRenderer 
  : null;

interface DocumentsProps {
  onUpdateKnowledgeBase: (doc: KnowledgeDocument) => void;
  onDeleteDocumentData: (docId: string) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const PdfViewer: React.FC<{ url: string; isFullScreen: boolean; onToggleFullScreen: () => void }> = ({ url, isFullScreen, onToggleFullScreen }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);
    const [pdf, setPdf] = useState<any>(null);
    const [pageNum, setPageNum] = useState(1);
    const [total, setTotal] = useState(0);
    const [scale, setScale] = useState(1.2); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument(url);
        loadingTask.promise.then((pdfDoc: any) => {
            setPdf(pdfDoc);
            setTotal(pdfDoc.numPages);
            setPageNum(1); 
            setLoading(false);
        }).catch(() => setLoading(false));

        return () => {
            loadingTask.destroy();
        };
    }, [url]);

    useEffect(() => {
        if (!pdf || !canvasRef.current) return;

        // Cancel any in-progress render to avoid "Cannot use the same canvas during multiple render() operations"
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
            renderTaskRef.current = null;
        }
        
        let cancelled = false;

        pdf.getPage(pageNum).then((page: any) => {
            if (cancelled || !canvasRef.current) return;

            const viewport = page.getViewport({ scale: scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            context!.clearRect(0, 0, canvas.width, canvas.height);

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            const task = page.render(renderContext);
            renderTaskRef.current = task;

            task.promise.then(() => {
                renderTaskRef.current = null;
            }).catch((err: any) => {
                if (err?.name !== 'RenderingCancelledException') {
                    console.error('PDF render error:', err);
                }
                renderTaskRef.current = null;
            });
        });

        return () => {
            cancelled = true;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
                renderTaskRef.current = null;
            }
        };
    }, [pdf, pageNum, scale]);

    // Fix M-05: Thêm keyboard navigation cho PDF viewer
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                setPageNum(prev => Math.max(1, prev - 1));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                setPageNum(prev => Math.min(total, prev + 1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [total]);

    return (
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative group">
            {/* PDF Toolbar — Command Center style */}
            <div className="bg-slate-800 p-3 border-b-2 border-blue-900 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-700 rounded-sm p-0.5 border border-slate-600">
                        <button onClick={() => setPageNum(Math.max(1, pageNum - 1))} className="w-8 h-8 rounded-sm hover:bg-slate-600 text-white transition flex items-center justify-center" title="Trang trước">
                            <i className="fas fa-chevron-left text-xs"></i>
                        </button>
                        <div className="px-4 flex items-center gap-2 text-[10px] font-mono font-bold text-white border-x border-slate-600">
                            <span className="text-slate-400 uppercase tracking-wider">Page</span>
                            <span className="bg-blue-900 px-2 py-0.5 rounded-sm border border-blue-700">{pageNum}</span>
                            <span className="text-slate-500">/ {total}</span>
                        </div>
                        <button onClick={() => setPageNum(Math.min(total, pageNum + 1))} className="w-8 h-8 rounded-sm hover:bg-slate-600 text-white transition flex items-center justify-center" title="Trang sau">
                            <i className="fas fa-chevron-right text-xs"></i>
                        </button>
                    </div>

                    <div className="flex bg-slate-700 rounded-sm p-0.5 border border-slate-600">
                        <button onClick={() => setScale(Math.max(0.5, scale - 0.2))} className="w-8 h-8 text-white hover:bg-slate-600 rounded-sm transition" title="Thu nhỏ">
                            <i className="fas fa-search-minus text-xs"></i>
                        </button>
                        <button onClick={() => setScale(1.2)} className="px-3 text-[10px] font-mono font-bold text-slate-300 hover:text-white transition border-x border-slate-600" title="Reset zoom">
                            {Math.round(scale * 100)}%
                        </button>
                        <button onClick={() => setScale(Math.min(3, scale + 0.2))} className="w-8 h-8 text-white hover:bg-slate-600 rounded-sm transition" title="Phóng to">
                            <i className="fas fa-search-plus text-xs"></i>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={onToggleFullScreen} className="w-9 h-9 rounded-sm bg-blue-900 text-yellow-400 border border-blue-700 hover:bg-blue-800 transition-all flex items-center justify-center" title="Toàn màn hình">
                        <i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'} text-sm`}></i>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8 flex justify-center custom-scrollbar bg-slate-900">
                {loading ? (
                    <div className="flex flex-col items-center justify-center text-blue-400 gap-4">
                        <i className="fas fa-circle-notch fa-spin text-4xl"></i>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">Loading Document...</span>
                    </div>
                ) : (
                    <div className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white rounded-sm mb-10 border border-slate-700">
                        <canvas ref={canvasRef} className="max-w-full h-auto" />
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-blue-900/90 text-[9px] font-mono font-bold text-yellow-400 px-4 py-2 rounded-sm border border-blue-700 uppercase tracking-wider">
                    Sử dụng phím mũi tên để chuyển trang
                </div>
            </div>
        </div>
    );
};

const Documents: React.FC<DocumentsProps> = ({ onUpdateKnowledgeBase, onDeleteDocumentData, onNotify }) => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<CloudDocumentFile[]>([]);

  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // TASK 1: Fetch User Documents from Cloud (UPDATED with Role-based Service)
  useEffect(() => {
      const fetchUserDocuments = async () => {
          if (!user?.id) return;
          try {
              // Use centralized service logic with role
              const documents = await databaseService.fetchUserDocuments(user.id, user.role);
              
              const mappedDocs: CloudDocumentFile[] = documents.map((doc: any) => ({
                  id: doc.$id,
                  name: doc.name,
                  type: 'PDF',
                  url: doc.file_url,
                  uploadDate: new Date(doc.$createdAt).toLocaleDateString('vi-VN'),
                  isProcessed: doc.is_processed,
                  fileId: doc.file_id,
                  metadata: { title: doc.name },
                  userId: doc.user_id,
                  isGlobal: doc.is_global
              }));
              
              setDocs(mappedDocs);
          } catch (error) {
              console.error("Lỗi tải tài liệu cá nhân:", error);
          }
      };

      fetchUserDocuments();
  }, [user]);

  // Đã gỡ bỏ logic fetchLectures để tránh lẫn lộn với Bài giảng số đa phương tiện.
  // Thư viện RAG giờ đây chỉ tập trung vào các tài liệu PDF được upload riêng cho AI.
  const allDocs = [...docs];

  // TASK 2: Upload File Logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    const fileName = file.name.toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.some(ext => fileName.endsWith(ext))) {
      return onNotify("Chỉ hỗ trợ tệp PDF, Word (.docx) hoặc Văn bản (.txt).", "error");
    }

    if (!user?.id) return onNotify("Vui lòng đăng nhập.", "warning");

    setIsProcessing(true);
    setProgress(5);

    try {
        // 1. Upload to Storage
        const uploadResponse = await storage.createFile(
            APPWRITE_CONFIG.buckets.lectures,
            ID.unique(),
            file
        );
        const fileId = uploadResponse.$id;
        const fileUrl = storage.getFileView(APPWRITE_CONFIG.buckets.lectures, fileId);

        // 2. Create DB Entry (Pending status)
        const isGlobal = user.role === 'admin';
        const docType = fileName.endsWith('.pdf') ? 'PDF' : fileName.endsWith('.docx') ? 'WORD' : 'TXT';
        
        const docRecord = await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.user_documents,
            ID.unique(),
            {
                user_id: user.id,
                name: file.name,
                file_id: fileId,
                file_url: fileUrl,
                is_processed: false,
                is_global: isGlobal,
                type: docType
            }
        );

        const newDocId = docRecord.$id;
        setProcessingDocId(newDocId);

        // Update UI immediately
        const newLocalDoc: CloudDocumentFile = {
            id: newDocId,
            name: file.name,
            type: docType,
            url: fileUrl,
            fileId: fileId,
            uploadDate: new Date().toLocaleDateString('vi-VN'),
            isProcessed: false,
            metadata: { title: file.name },
            userId: user.id,
            isGlobal: isGlobal
        };
        setDocs(prev => [newLocalDoc, ...prev]);
        setSelectedDoc(newLocalDoc);

        // 3. Extract Text & Update Knowledge Base
        const extractedText = await extractTextFromPDF(file);
        setProgress(100);

        // 4. Update DB Entry (Processed status)
        await databases.updateDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.user_documents,
            newDocId,
            { is_processed: true }
        );

        if (extractedText) {
            const knowledgeDoc: KnowledgeDocument = {
                id: newDocId,
                name: file.name,
                text: extractedText
            };
            onUpdateKnowledgeBase(knowledgeDoc);
            setDocs(prev => prev.map(d => d.id === newDocId ? { ...d, isProcessed: true } : d));
            onNotify("Đã nạp tri thức thành công!", "success");
        } else {
            onNotify("Đã lưu tài liệu. (Cảnh báo: Không trích xuất được văn bản)", "warning");
        }

    } catch (error: any) {
        console.error(error);
        onNotify(`Lỗi: ${error.message}`, "error");
    } finally {
        setIsProcessing(false);
        setProcessingDocId(null);
        setProgress(0);
    }
  };

  // TASK 3: Delete File Logic
  const deleteDoc = async (doc: CloudDocumentFile) => {
      // Fix L-04: Kiểm tra xem tài liệu có ID hợp lệ không (không phải temp/cloud)
      if (!doc.id || doc.id.startsWith('temp_')) return;
      if (!window.confirm(`Xóa tài liệu "${doc.name}"?`)) return;

      try {
          // 1. Delete from DB
          await databases.deleteDocument(
              APPWRITE_CONFIG.dbId, 
              APPWRITE_CONFIG.collections.user_documents, 
              doc.id
          );

          // 2. Delete from Storage (if fileId exists)
          if (doc.fileId) {
              await storage.deleteFile(APPWRITE_CONFIG.buckets.lectures, doc.fileId);
          }

          // 3. Update UI & Knowledge Base
          setDocs(prev => prev.filter(d => d.id !== doc.id));
          onDeleteDocumentData(doc.id);
          
          if (selectedDoc?.id === doc.id) setSelectedDoc(null);
          onNotify("Đã xóa tài liệu.", "info");

      } catch (error: any) {
          console.error(error);
          onNotify(`Lỗi xóa tài liệu: ${error.message}`, "error");
      }
  };

  return (
    <div className="h-full flex flex-col p-6 md:p-8 bg-slate-50 font-[Roboto]">
      {/* Page Header — Command Center */}
      <div className="flex justify-between items-center mb-5 bg-blue-900 p-6 rounded-sm border-b-4 border-yellow-500">
         <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-[9px] font-mono font-bold text-green-400 uppercase tracking-[0.2em]">KNOWLEDGE HUB ACTIVE</span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider">Thư viện Tri thức RAG</h2>
            <p className="text-[10px] font-mono text-blue-300 mt-1 uppercase tracking-wider">Knowledge Base — AI Document Processing Center</p>
         </div>
         {user?.role !== 'student' && (
             <label className={`cursor-pointer bg-yellow-500 text-blue-900 px-6 py-3 rounded-sm font-black text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all hover:bg-yellow-400 border border-yellow-600 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-upload"></i>}
                {isProcessing ? "ĐANG HỌC..." : "TẢI TÀI LIỆU"}
                <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFileUpload} />
             </label>
         )}
      </div>

      <div className="flex-1 flex gap-5 min-h-0">
        {/* Sidebar — Document List */}
        <div className="w-80 bg-white rounded-sm border border-slate-300 flex flex-col overflow-hidden shrink-0">
            {/* Sidebar header */}
            <div className="p-4 border-b-2 border-blue-900 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-sm bg-blue-900 flex items-center justify-center text-yellow-400">
                        <i className="fas fa-folder-open text-[10px]"></i>
                    </div>
                    <span className="text-[10px] font-black text-blue-900 uppercase tracking-wider">Giáo trình ({allDocs.length})</span>
                </div>
            </div>
            {/* Document entries */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {allDocs.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        <i className="fas fa-inbox text-3xl mb-3 block text-slate-300"></i>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wider">Chưa có tài liệu</p>
                    </div>
                )}
                {allDocs.map((doc) => {
                    const isCloud = doc.id.startsWith('cloud_');
                    const typedDoc = doc as CloudDocumentFile;
                    return (
                        <div key={doc.id} onClick={() => setSelectedDoc(doc)} className={`p-3 rounded-sm border cursor-pointer transition-all relative group ${selectedDoc?.id === doc.id ? 'bg-blue-50 border-blue-900 border-l-4 border-l-yellow-500' : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-blue-900'}`}>
                            {!isCloud && (user?.role === 'admin' || typedDoc.userId === user?.id) && (
                                <button onClick={(e) => {e.stopPropagation(); deleteDoc(typedDoc)}} className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-sm bg-red-50 text-red-500 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 transition-all flex items-center justify-center" title="Xóa tài liệu"><i className="fas fa-trash-alt text-[10px]"></i></button>
                            )}
                            <div className="flex gap-3">
                                <div className={`w-10 h-10 rounded-sm flex items-center justify-center shrink-0 border ${doc.id === processingDocId ? 'bg-amber-50 text-amber-600 border-amber-200' : typedDoc.type === 'WORD' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : typedDoc.type === 'TXT' ? 'bg-slate-50 text-slate-600 border-slate-200' : isCloud ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-blue-900 border-slate-300'}`}>
                                    <i className={`fas ${doc.id === processingDocId ? 'fa-circle-notch fa-spin' : typedDoc.type === 'WORD' ? 'fa-file-word' : typedDoc.type === 'TXT' ? 'fa-file-alt' : isCloud ? 'fa-cloud' : 'fa-file-pdf'} text-sm`}></i>
                                </div>
                                <div className="overflow-hidden flex-1">
                                    <p className="font-bold text-xs text-slate-800 truncate flex items-center gap-2">
                                        {doc.name}
                                        {typedDoc.isGlobal && <span className="bg-blue-900 text-yellow-400 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm border border-blue-700 uppercase">Global</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider border ${doc.isProcessed || isCloud ? 'bg-green-50 text-green-700 border-green-200' : doc.id === processingDocId ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                            {doc.isProcessed || isCloud ? '● INDEXED' : doc.id === processingDocId ? `◉ ${progress}%` : '○ PENDING'}
                                        </span>
                                        {doc.uploadDate && <span className="text-[8px] font-mono text-slate-400">{doc.uploadDate}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Main Content — PDF Viewer (Only for PDF) */}
        <div className="flex-1 bg-slate-900 rounded-sm border-2 border-blue-900 overflow-hidden flex flex-col relative">
            {selectedDoc ? (
                selectedDoc.type === 'PDF' ? (
                    <PdfViewer url={selectedDoc.url} isFullScreen={isFullScreen} onToggleFullScreen={() => setIsFullScreen(!isFullScreen)} />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-sm bg-slate-800 flex items-center justify-center mx-auto mb-4 border border-slate-700">
                                <i className={`fas ${selectedDoc.type === 'WORD' ? 'fa-file-word' : 'fa-file-alt'} text-2xl text-slate-600`}></i>
                            </div>
                            <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">{selectedDoc.name}</p>
                            <p className="text-[9px] font-mono text-slate-600 mt-2 italic px-10">Tài liệu "{selectedDoc.type}" đã được AI trích xuất và nạp vào tri thức. <br/> Hiện chưa hỗ trợ xem trực tiếp định dạng này trên web.</p>
                        </div>
                    </div>
                )
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-sm bg-slate-800 flex items-center justify-center mx-auto mb-4 border border-slate-700">
                            <i className="fas fa-file-pdf text-2xl text-slate-600"></i>
                        </div>
                        <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">Chọn tài liệu để xem</p>
                        <p className="text-[9px] font-mono text-slate-600 mt-1">Select a document from the panel</p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Documents;