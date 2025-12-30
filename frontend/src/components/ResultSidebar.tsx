import { useState, useEffect, useRef } from "react";
import {
  X,
  Video,
  Camera,
  Aperture,
  Maximize2,
  Settings,
  ChevronDown,
  ChevronUp,
  Share,
  Download,
  Edit,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ResultSidebar({
  isOpen,
  onClose,
  prompt,
  selectedGear,
  onRecreate,
  resultUrl,
  loading,
}: any) {
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);

  // Local state for the editable prompt
  const [localPrompt, setLocalPrompt] = useState(prompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local state if the parent prompt changes (e.g. new generation from main input)
  useEffect(() => {
    setLocalPrompt(prompt);
  }, [prompt]);

  // Auto-resize the textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [localPrompt, isOpen]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!resultUrl) return;
    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cinema-studio-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download image.");
    }
  };

  const ActionButton = ({ icon: Icon, label, onClick, danger }: any) => (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border bg-zinc-900/50 transition-all group",
        danger
          ? "border-red-900/30 hover:border-red-500 hover:bg-red-950/30"
          : "border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800"
      )}
    >
      <Icon
        size={20}
        className={cn(
          "transition-colors",
          danger
            ? "text-red-500 group-hover:text-red-400"
            : "text-zinc-400 group-hover:text-white"
        )}
      />
      <span
        className={cn(
          "text-xs font-medium",
          danger ? "text-red-500" : "text-zinc-500 group-hover:text-zinc-300"
        )}
      >
        {label}
      </span>
    </button>
  );

  const SettingItem = ({ icon: Icon, label, value }: any) => (
    <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-zinc-900 rounded-lg text-zinc-500">
          <Icon size={16} />
        </div>
        <span className="text-sm font-medium text-zinc-400">{label}</span>
      </div>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );

  return (
    <div className="w-[400px] bg-zinc-900/90 backdrop-blur-xl border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-start shrink-0">
        <div className="w-full mr-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
            Prompt (Editable)
          </h3>
          {/* EDITABLE TEXT AREA */}
          <textarea
            ref={textareaRef}
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-white font-medium text-sm resize-none p-0 focus:ring-0 leading-relaxed placeholder:text-zinc-600"
            rows={1}
            placeholder="Edit your prompt here..."
          />
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors -mt-1 -mr-1 p-2"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
        <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-xl border border-zinc-800">
          <span className="text-sm font-medium text-zinc-400">Feature</span>
          <span className="text-sm font-bold text-white">
            Cinematic Studio Image
          </span>
        </div>

        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Camera size={14} /> Camera Settings
          </h3>
          <div className="space-y-2">
            <SettingItem
              icon={Video}
              label="Camera"
              value={selectedGear.camera.name}
            />
            <SettingItem
              icon={Aperture}
              label="Lens"
              value={selectedGear.lens.name}
            />
            <SettingItem
              icon={Maximize2}
              label="Focal Length"
              value={selectedGear.focalLength}
            />
          </div>
        </div>

        <div>
          <button
            onClick={() => setIsAdditionalOpen(!isAdditionalOpen)}
            className="w-full flex justify-between items-center text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 group"
          >
            <span className="flex items-center gap-2">
              <Settings size={14} /> Additional
            </span>
            {isAdditionalOpen ? (
              <ChevronUp size={14} className="group-hover:text-white" />
            ) : (
              <ChevronDown size={14} className="group-hover:text-white" />
            )}
          </button>
          {isAdditionalOpen && (
            <div className="p-3 bg-zinc-950/30 rounded-xl border border-zinc-800/50 text-sm text-zinc-500 text-center">
              No additional settings applied.
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 space-y-4 shrink-0">
        {/* UPDATED: Pass localPrompt to onRecreate */}
        <button
          onClick={() => onRecreate(localPrompt)}
          disabled={loading}
          className="w-full py-3 rounded-xl font-black text-sm text-black flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(163,230,53,0.1)] hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 bg-gradient-to-r from-[#D2FF44] to-[#E7FF86]"
        >
          {loading ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <>
              <RefreshCw size={18} /> Recreate
            </>
          )}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton
            icon={Share}
            label="Publish"
            onClick={() => alert("Publish feature coming soon!")}
          />
          <ActionButton
            icon={Video}
            label="Video"
            onClick={() => alert("Video generation from image coming soon!")}
          />
          <ActionButton
            icon={Download}
            label="Download"
            onClick={handleDownload}
          />
          <ActionButton
            icon={Maximize2}
            label="Upscale"
            onClick={() => alert("Upscale feature coming soon!")}
          />
          <ActionButton
            icon={Edit}
            label="Edit"
            onClick={() => alert("Edit feature coming soon!")}
          />
          <ActionButton
            icon={Trash2}
            label="Delete"
            danger
            onClick={() => onClose()}
          />
        </div>
      </div>
    </div>
  );
}
