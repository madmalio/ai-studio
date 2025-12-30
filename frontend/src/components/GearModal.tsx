import { X, User } from "lucide-react";
// REMOVED THE CONFLICTING IMPORT LINE HERE
import { CAMERAS, LENSES, FOCAL_LENGTHS } from "@/lib/constants";

// Inline utils
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function GearModal({
  isOpen,
  onClose,
  selectedGear,
  onSelectGear,
  imageStrength,
  onSetImageStrength,
}: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl h-[650px] flex flex-col relative shadow-2xl overflow-hidden">
        <div className="p-6 pb-4 flex justify-between items-center shrink-0 bg-zinc-900 z-10 border-b border-zinc-800/50">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
            Production Settings
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar space-y-8">
          <div className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <User size={14} /> Reference Likeness
            </h3>
            <div className="flex gap-2">
              {[
                { label: "High (Strict)", value: 0.45 },
                { label: "Balanced", value: 0.65 },
                { label: "Creative (New Scene)", value: 0.75 },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => onSetImageStrength(option.value)}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-xs font-bold border transition-all",
                    imageStrength === option.value
                      ? "bg-zinc-800 border-lime-500 text-white shadow-[0_0_15px_rgba(132,204,22,0.1)]"
                      : "bg-black/20 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 text-center">
              "Creative" is required to change the background, but may alter
              likeness.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Camera
              </h3>
              <div className="space-y-2">
                {CAMERAS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectGear("camera", c)}
                    className={cn(
                      "w-full p-4 rounded-2xl border text-center transition-all",
                      selectedGear.camera.id === c.id
                        ? "bg-zinc-800 border-lime-500 text-white"
                        : "bg-black/20 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                    )}
                  >
                    <div className="font-bold text-sm">{c.name}</div>
                    <div className="text-[10px] opacity-50 mt-1">{c.type}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Lens
              </h3>
              <div className="space-y-2">
                {LENSES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectGear("lens", l)}
                    className={cn(
                      "w-full p-4 rounded-2xl border text-center transition-all",
                      selectedGear.lens.id === l.id
                        ? "bg-zinc-800 border-lime-500 text-white"
                        : "bg-black/20 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                    )}
                  >
                    <div className="font-bold text-sm">{l.name}</div>
                    <div className="text-[10px] opacity-50 mt-1">{l.type}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Focal Length
              </h3>
              <div className="space-y-2">
                {FOCAL_LENGTHS.map((f) => (
                  <button
                    key={f}
                    onClick={() => onSelectGear("focalLength", f)}
                    className={cn(
                      "w-full p-4 rounded-2xl border text-center transition-all",
                      selectedGear.focalLength === f
                        ? "bg-zinc-800 border-lime-500 text-white"
                        : "bg-black/20 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                    )}
                  >
                    <div className="text-2xl font-bold">
                      {f.replace("mm", "")}
                    </div>
                    <div className="text-[10px] opacity-50 mt-1">mm</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
