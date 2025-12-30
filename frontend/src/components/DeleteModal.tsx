import { AlertTriangle, X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteModal({ isOpen, onClose, onConfirm }: DeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Yellow Warning Icon */}
          <div className="w-12 h-12 rounded-full bg-lime-400/10 flex items-center justify-center text-lime-400">
            <AlertTriangle size={24} />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Delete this shot?</h3>
            <p className="text-sm text-zinc-400">
              This action cannot be undone.
            </p>
          </div>

          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-all"
            >
              Cancel
            </button>
            {/* BRANDED DELETE BUTTON */}
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-lime-400 hover:bg-lime-500 transition-all shadow-[0_0_20px_rgba(163,230,53,0.3)]"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
