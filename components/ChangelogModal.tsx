import React, { useEffect, useState } from "react";

interface VersionData {
  version: string;
  releaseDate: string;
  changelog: string;
}

const ChangelogModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<VersionData | null>(null);

  useEffect(() => {
    const loadVersionData = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Không thể tải tệp phiên bản (${response.status})`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Phản hồi version.json không phải JSON hợp lệ");
        }

        const json: VersionData = await response.json();
        setData(json);

        const lastSeenVersion = localStorage.getItem("last_seen_version");
        const justUpdated = localStorage.getItem("just_updated");

        if (lastSeenVersion !== json.version || justUpdated === "true") {
          setIsOpen(true);
        }
      } catch (error) {
        console.warn("[DHSYSTEM] Không thể nạp thông tin phiên bản từ local:", error);
      }
    };

    loadVersionData();
  }, []);

  const handleClose = () => {
    if (data) {
      localStorage.setItem("last_seen_version", data.version);
    }
    localStorage.removeItem("just_updated");
    setIsOpen(false);
  };

  if (!isOpen || !data) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-xl">
      <div className="animate-fade-in-up flex w-full max-w-xl flex-col overflow-hidden rounded-[3.5rem] border border-white/20 bg-white shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-800 p-10 text-white">
          <div className="absolute right-0 top-0 -mr-24 -mt-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl" />
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/20 backdrop-blur-md">
                <i className="fas fa-sparkles text-2xl text-yellow-300" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-100 opacity-80">Nâng cấp thành công</span>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/60">AI Self Study System</h4>
              </div>
            </div>
            <h2 className="mb-2 text-4xl font-black leading-none tracking-tighter">Chào mừng bạn đến với v{data.version}!</h2>
            <div className="mt-4 flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-indigo-100">{data.releaseDate}</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-indigo-100">Build: BLUEBEE-PRO</span>
            </div>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[350px] flex-1 overflow-y-auto p-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-100" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Bản ghi cập nhật</h4>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="rounded-[2.5rem] border border-slate-100 bg-slate-50/50 p-8 text-[15px] italic leading-relaxed text-slate-700 shadow-inner whitespace-pre-line">
              {data.changelog}
            </div>
            <div className="flex items-center gap-4 rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <i className="fas fa-info-circle text-blue-600" />
              <p className="text-[10px] font-bold leading-relaxed text-blue-800">
                Hệ thống AI và ngân hàng đề của bạn đã được tối ưu theo phiên bản này. Bạn có thể tiếp tục buổi học ngay bây giờ.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center p-10 pt-0">
          <button
            onClick={handleClose}
            className="w-full rounded-3xl bg-slate-900 py-5 text-[13px] font-black uppercase tracking-[0.25em] text-white shadow-2xl shadow-slate-900/40 transition-all hover:bg-blue-600 active:scale-95"
          >
            Khám phá ngay <i className="fas fa-arrow-right ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
