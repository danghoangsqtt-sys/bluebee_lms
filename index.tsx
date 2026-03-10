import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Uncaught Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-900 flex items-center justify-center p-10 text-white font-sans">
          <div className="max-w-xl text-center">
            <i className="fas fa-bug text-5xl text-red-500 mb-6"></i>
            <h1 className="text-2xl font-black mb-4">Ối! Đã có lỗi xảy ra trong Runtime</h1>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">Ứng dụng gặp lỗi không mong muốn trong khi đang xử lý dữ liệu. Vui lòng tải lại hoặc liên hệ quản trị viên.</p>
            <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-left text-[10px] font-mono mb-8 overflow-auto max-h-40">
                {this.state.error?.toString()}
            </div>
            <button 
                onClick={() => window.location.reload()} 
                className="bg-blue-600 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs"
            >
                Khởi động lại
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </React.StrictMode>
  );

  // Thông báo cho index.html rằng app đã render thành công
  if ((window as any).markAppAsReady) {
    (window as any).markAppAsReady();
  }
} catch (e) {
  console.error("Mouting failed:", e);
}
