import { X, Film } from "lucide-react";
import { MOVEMENTS } from "@/lib/constants";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function MovementsModal({
  isOpen,
  onClose,
  selectedMovement,
  onSelectMovement,
}: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl p-8 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold text-white mb-6">Camera movement</h2>
        <div className="grid grid-cols-5 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {MOVEMENTS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onSelectMovement(m);
                onClose();
              }}
              className="group flex flex-col gap-2"
            >
              <div
                className={cn(
                  "aspect-video rounded-xl overflow-hidden border-2 transition-all relative bg-zinc-800",
                  selectedMovement.id === m.id
                    ? "border-lime-500"
                    : "border-transparent group-hover:border-zinc-700"
                )}
              >
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <Film size={24} />
                </div>
              </div>
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  selectedMovement.id === m.id
                    ? "text-lime-400"
                    : "text-zinc-500 group-hover:text-zinc-300"
                )}
              >
                {m.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
