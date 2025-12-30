import { useState, useRef } from "react";
import { X, UploadCloud, Library, History, Plus } from "lucide-react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function SourceModal({
  isOpen,
  onClose,
  onNewUpload,
  history,
  uploads,
  onSelectReference,
}: any) {
  const [activeTab, setActiveTab] = useState<"new" | "uploads" | "generated">(
    "new"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl h-[550px] flex flex-col relative shadow-2xl overflow-hidden">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex gap-1 bg-black/50 p-1 rounded-xl border border-zinc-800/50">
            {["new", "uploads", "generated"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 capitalize",
                  activeTab === tab
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {tab === "new" && <UploadCloud size={14} />}
                {tab === "uploads" && <Library size={14} />}
                {tab === "generated" && <History size={14} />}
                {tab === "new"
                  ? "New Upload"
                  : tab === "generated"
                  ? "Generated Images"
                  : "Your Uploads"}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-zinc-900/50">
          {activeTab === "new" && (
            <div
              className="h-full flex flex-col items-center justify-center gap-4 border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-950/50 hover:border-zinc-500 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={onNewUpload}
                className="hidden"
                accept="image/png, image/jpeg, image/jpg"
              />
              <div className="p-6 bg-zinc-800 rounded-full text-zinc-400 group-hover:text-white transition-colors">
                <UploadCloud size={32} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-zinc-300">
                  Click to upload image
                </p>
                <p className="text-xs text-zinc-500">
                  Will be saved to "Your Uploads"
                </p>
              </div>
            </div>
          )}
          {(activeTab === "uploads" || activeTab === "generated") && (
            <div className="grid grid-cols-4 gap-3">
              {(activeTab === "uploads"
                ? uploads
                : history.filter((i: any) => i.type === "image")
              ).map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectReference(
                      activeTab === "uploads" ? item.base64_data : item.url
                    );
                    onClose();
                  }}
                  className="aspect-square rounded-xl border border-zinc-800 overflow-hidden hover:border-lime-500 transition-all group relative"
                >
                  <img
                    src={activeTab === "uploads" ? item.base64_data : item.url}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Plus size={24} className="text-lime-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
