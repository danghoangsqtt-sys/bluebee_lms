
import React, { useState, useEffect } from 'react';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
  link: string;
}

const NewsSection: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hàm làm sạch HTML và cắt ngắn văn bản
  const cleanDescription = (html: string): string => {
    const text = html.replace(/<[^>]*>?/gm, ''); // Regex xóa tag HTML
    return text.length > 80 ? text.substring(0, 77) + '...' : text;
  };

  // Hàm định dạng ngày DD/MM/YYYY
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${d}/${m}`;
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true);
      setError(null);
      
      const vnExpressUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://vnexpress.net/rss/khoa-hoc.rss`;
      const danTriUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://dantri.com.vn/rss/khoa-hoc-cong-nghe.rss`;

      try {
        const [vnRes, dtRes] = await Promise.all([
          fetch(vnExpressUrl).then(res => res.json()),
          fetch(danTriUrl).then(res => res.json())
        ]);

        const vnArticles = (vnRes.items || []).map((item: any) => ({
          id: item.guid || item.link,
          title: item.title,
          summary: cleanDescription(item.description),
          date: item.pubDate,
          source: 'VnE',
          link: item.link
        }));

        const dtArticles = (dtRes.items || []).map((item: any) => ({
          id: item.guid || item.link,
          title: item.title,
          summary: cleanDescription(item.description),
          date: item.pubDate,
          source: 'DT',
          link: item.link
        }));

        // Gộp, sắp xếp theo thời gian và lấy 4 tin mới nhất
        const combined = [...vnArticles, ...dtArticles]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 4)
          .map(item => ({
            ...item,
            date: formatDate(item.date)
          }));

        setArticles(combined);
      } catch (err) {
        console.error("[NEWS-FETCH-ERROR]", err);
        setError("Không thể nạp tin tức.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
          <i className="fas fa-rss text-orange-500"></i> Tin Công nghệ
        </h3>
        <button 
          onClick={() => window.open('https://vnexpress.net/khoa-hoc', '_blank')}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white transition-all"
        >
          <i className="fas fa-external-link-alt text-xs"></i>
        </button>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
        {isLoading ? (
          // Skeleton Loading
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse flex gap-4 p-4 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-slate-200 rounded-xl shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-2 bg-slate-200 w-3/4"></div>
                <div className="h-2 bg-slate-200 w-full"></div>
              </div>
            </div>
          ))
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-60 py-10">
            <i className="fas fa-wifi text-2xl"></i>
            <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
          </div>
        ) : (
          articles.map((item) => (
            <a 
              key={item.id} 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group p-4 rounded-xl bg-slate-50 border border-transparent hover:border-blue-600/20 hover:bg-white hover:shadow-md transition-all flex flex-col relative"
            >
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${item.source === 'VnE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-700'}`}>
                  <span className="text-[10px] font-black">{item.source}</span>
                </div>
                <div className="space-y-1 overflow-hidden flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      {item.date}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                    {item.title}
                  </h4>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
};

export default NewsSection;
