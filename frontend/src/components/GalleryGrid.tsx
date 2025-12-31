import {
  Film,
  Layers,
  LayoutTemplate,
  ArrowRightCircle,
  ArrowLeftCircle,
  Heart,
  Copy,
  Download,
  Share2,
  Trash2,
  Scan,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GalleryGridProps {
  items: any[];
  onSelect: (item: any) => void;
  onAction: (e: React.MouseEvent, action: string, item: any) => void;
}

export function GalleryGrid({ items, onSelect, onAction }: GalleryGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 max-w-[98%] mx-auto animate-in fade-in duration-500">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative aspect-video overflow-hidden bg-zinc-900 hover:z-10 transition-all cursor-pointer"
          onClick={() => onSelect(item)}
        >
          {item.type === "video" ? (
            <div className="w-full h-full relative">
              <video
                src={item.url}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                <Film size={32} className="text-white/30" />
              </div>
            </div>
          ) : (
            <img
              src={item.url}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500"
            />
          )}

          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
            <div className="flex items-start justify-end content-start gap-1 flex-wrap w-full">
              {/* BUTTON 1: View Storyboard */}
              <button
                onClick={(e) => onAction(e, "view_proxies", item)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md transition-all"
              >
                <LayoutTemplate size={13} /> View
              </button>

              {/* BUTTON 2: Generate Multishot (Renamed back to Multishot) */}
              <button
                onClick={(e) => onAction(e, "multishot", item)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md transition-all"
              >
                <Layers size={13} /> Multishot
              </button>

              {/* --------------------------- */}

              <button
                onClick={(e) => onAction(e, "ref", item)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md transition-all"
              >
                <Scan size={13} /> Ref
              </button>
              <button
                onClick={(e) => onAction(e, "start", item)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md transition-all"
              >
                <ArrowRightCircle size={13} /> Start
              </button>
              <button
                onClick={(e) => onAction(e, "end", item)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md transition-all"
              >
                <ArrowLeftCircle size={13} /> End
              </button>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex-1 pr-4">
                <p className="text-[9px] tracking-widest uppercase text-white/50 font-bold mb-0.5">
                  Cinematic Studio
                </p>
                <p className="text-[11px] text-zinc-200 font-medium line-clamp-1 text-left leading-tight">
                  {item.prompt}
                </p>
              </div>

              <div className="flex items-center gap-0 shrink-0">
                <button
                  onClick={(e) => onAction(e, "like", item)}
                  className={cn(
                    "p-1.5 rounded-full transition-all hover:bg-white/10",
                    item.is_favorite
                      ? "text-red-500 fill-current"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  <Heart
                    size={14}
                    fill={item.is_favorite ? "currentColor" : "none"}
                  />
                </button>

                <button
                  onClick={(e) => onAction(e, "copy", item)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={(e) => onAction(e, "download", item)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={(e) => onAction(e, "share", item)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                >
                  <Share2 size={14} />
                </button>
                <button
                  onClick={(e) => onAction(e, "delete", item)}
                  className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
