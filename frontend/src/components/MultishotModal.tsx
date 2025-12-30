import { useState, useEffect } from "react";
import { X, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MultishotModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceItemId: number | null;
  onUpscaleComplete: () => void;
}

export function MultishotModal({
  isOpen,
  onClose,
  sourceItemId,
  onUpscaleComplete,
}: MultishotModalProps) {
  const [proxies, setProxies] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [upscaling, setUpscaling] = useState(false);

  useEffect(() => {
    if (isOpen && sourceItemId) {
      fetchProxies();
    } else {
      setProxies([]);
      setSelectedIds([]);
    }
  }, [isOpen, sourceItemId]);

  const fetchProxies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/proxies/${sourceItemId}`);
      const data = await res.json();
      setProxies(data);
      // FIXED: Do NOT auto-select images. Start with empty array.
      setSelectedIds([]);
    } catch (e) {
      console.error("Failed to fetch proxies", e);
      toast.error("Could not load multishot drafts.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleUpscale = async () => {
    if (selectedIds.length === 0) return;

    setUpscaling(true);
    const totalSteps = selectedIds.length * 30;
    const estimatedSeconds = Math.ceil(totalSteps * 0.05);
    const toastId = toast.loading(`Upscaling ${selectedIds.length} shots...`, {
      description: `Estimated time: ~${estimatedSeconds} seconds`,
    });

    try {
      const res = await fetch("http://127.0.0.1:8000/upscale-proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxy_ids: selectedIds }),
      });
      const data = await res.json();

      if (data.status === "success") {
        toast.success(
          `Successfully added ${data.upscaled_count} high-res shots to library!`,
          { id: toastId }
        );
        onUpscaleComplete();
        onClose();
      } else {
        throw new Error("Upscale failed backend check");
      }
    } catch (e) {
      console.error("Upscale failed", e);
      toast.error("Upscale process failed.", { id: toastId });
    } finally {
      setUpscaling(false);
    }
  };

  const estimatedCost = selectedIds.length * 5;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-black/50">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-lime-400" /> Multishot Selection
          </h2>
          <p className="text-sm text-zinc-400">
            Select varying angles to finalize in high resolution.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-900 hover:bg-zinc-800 transition-all"
        >
          <X size={20} />
        </button>
      </div>

      {/* GRID CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <Loader2 size={32} className="animate-spin text-lime-400" />
            <p>Generating 9 consistent angles...</p>
          </div>
        ) : proxies.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
            No drafts found. Try generating again.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto pb-24">
            {proxies.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelection(item.id)}
                  className={cn(
                    "group relative aspect-[21/9] rounded-lg overflow-hidden cursor-pointer transition-all outline-offset-2",
                    // FIXED: Outline is 0 (invisible) unless selected
                    isSelected
                      ? "outline-2 outline-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.3)]"
                      : "outline-0 opacity-80 hover:opacity-100"
                  )}
                >
                  <img
                    src={item.url}
                    className={cn(
                      "w-full h-full object-cover transition-all duration-500",
                      isSelected ? "opacity-100" : "group-hover:opacity-100"
                    )}
                  />

                  {/* CHECKMARK: Only visible when selected */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 animate-in zoom-in-50 duration-200">
                      <CheckCircle2
                        size={20}
                        className="text-lime-400 fill-black drop-shadow-lg"
                      />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p className="text-[9px] text-zinc-300 line-clamp-1 font-medium">
                      {item.prompt}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FLOATING UPSCALE BAR */}
      {!loading && proxies.length > 0 && selectedIds.length > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl p-2 pl-6 rounded-2xl border border-zinc-800 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 z-50">
          <p className="text-sm text-zinc-300 font-medium">
            <span className="text-lime-400 font-bold">
              {selectedIds.length}
            </span>{" "}
            shots selected
          </p>
          <button
            onClick={handleUpscale}
            disabled={upscaling}
            className="bg-lime-400 hover:bg-lime-500 text-black px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all disabled:opacity-50 disabled:hover:bg-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.2)] hover:shadow-[0_0_30px_rgba(163,230,53,0.4)]"
          >
            {upscaling ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Upscale <Sparkles size={16} fill="currentColor" />{" "}
                {estimatedCost}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
