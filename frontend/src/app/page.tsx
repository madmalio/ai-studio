"use client";

import { useState, useRef, useEffect } from "react";
import {
  Image as ImageIcon,
  Video,
  Settings,
  X,
  Plus,
  Zap,
  Film,
  Clock,
  ChevronLeft,
  LayoutTemplate,
  Ratio,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { CAMERAS, LENSES, FOCAL_LENGTHS, MOVEMENTS } from "@/lib/constants";
import { GearModal } from "@/components/GearModal";
import { MovementsModal } from "@/components/MovementsModal";
import { SourceModal } from "@/components/SourceModal";
import { ResultSidebar } from "@/components/ResultSidebar";
import { GalleryGrid } from "@/components/GalleryGrid";
import { DeleteModal } from "@/components/DeleteModal";
import { MultishotModal } from "@/components/MultishotModal";
import { MultishotConfirmModal } from "@/components/MultishotConfirmModal"; // <--- NEW IMPORT

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ASPECT_RATIOS = ["21:9", "16:9", "4:3", "1:1", "9:16"];

export default function CinemaStudioPage() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"empty" | "gallery">("empty");
  const [galleryFilter, setGalleryFilter] = useState<"image" | "video">(
    "image"
  );
  const [history, setHistory] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [imageStrength, setImageStrength] = useState(0.75);
  const [aspectRatio, setAspectRatio] = useState("21:9"); // <--- NEW STATE

  const [isGearModalOpen, setIsGearModalOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // MULTISHOT STATE
  const [isMultishotModalOpen, setIsMultishotModalOpen] = useState(false);
  const [isMultishotConfirmOpen, setIsMultishotConfirmOpen] = useState(false); // <--- NEW STATE
  const [itemForMultishot, setItemForMultishot] = useState<any>(null); // <--- NEW STATE
  const [multishotSourceId, setMultishotSourceId] = useState<number | null>(
    null
  );

  const [selectedGear, setSelectedGear] = useState({
    camera: CAMERAS[0],
    lens: LENSES[0],
    focalLength: FOCAL_LENGTHS[0],
  });
  const [selectedMovement, setSelectedMovement] = useState(MOVEMENTS[0]);

  const promptRefWithImages = useRef<HTMLTextAreaElement>(null);
  const promptRefNoImages = useRef<HTMLTextAreaElement>(null);
  const autosizePrompt = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  const fetchData = async () => {
    try {
      const historyRes = await fetch("http://127.0.0.1:8000/history");
      const uploadsRes = await fetch("http://127.0.0.1:8000/uploads");
      setHistory(await historyRes.json());
      setUploads(await uploadsRes.json());
    } catch (e) {
      console.error("Data fetch failed", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    autosizePrompt(promptRefWithImages.current);
    autosizePrompt(promptRefNoImages.current);
  }, [prompt, referenceImages.length, activeTab]);

  const handleGearSelect = (type: string, value: any) =>
    setSelectedGear((prev) => ({ ...prev, [type]: value }));

  const handleNewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading("Uploading reference image...");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      setReferenceImages((prev) => [...prev, base64data]);
      try {
        await fetch("http://127.0.0.1:8000/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64_data: base64data }),
        });
        fetchData();
        toast.success("Upload complete", { id: toastId });
      } catch (e) {
        console.error("Upload save failed", e);
        toast.error("Upload failed", { id: toastId });
      }
    };
    reader.readAsDataURL(file);
    setIsSourceModalOpen(false);
  };
  const removeReferenceImage = (index: number) =>
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));

  const handleSelectReference = (urlData: string) => {
    if (!referenceImages.includes(urlData)) {
      setReferenceImages((prev) => [...prev, urlData]);
      toast.success("Added to reference images");
      setIsSourceModalOpen(false);
    }
  };

  // --- VIEW LOGIC ---

  const clearDock = () => {
    setPrompt("");
    setReferenceImages([]);
  };

  const goHome = () => {
    setResultUrl(null);
    setViewMode("empty");
    clearDock();
  };
  const openGallery = (type: "image" | "video") => {
    setResultUrl(null);
    setViewMode("gallery");
    setGalleryFilter(type);
    clearDock();
  };
  const selectFromGallery = (item: any) => {
    setResultUrl(item.url);
    if (item.prompt) setPrompt(item.prompt);
    const cameraObj = CAMERAS.find((c) => c.name === item.camera) || CAMERAS[0];
    const lensObj = LENSES.find((l) => l.name === item.lens) || LENSES[0];
    const focalLengthVal = item.focal_length || FOCAL_LENGTHS[0];

    setSelectedGear({
      camera: cameraObj,
      lens: lensObj,
      focalLength: focalLengthVal,
    });
    setIsSidebarOpen(true);
    setActiveTab(item.type);
  };

  const closeFocusMode = () => {
    setResultUrl(null);
    setIsSidebarOpen(false);
    clearDock();
  };

  const handleGenerate = async (overridePrompt?: any) => {
    const promptToUse =
      typeof overridePrompt === "string" ? overridePrompt : prompt;

    if (!promptToUse && referenceImages.length === 0 && activeTab === "image") {
      toast.error("Please enter a prompt or add an image.");
      return;
    }
    if (activeTab === "video" && !resultUrl) {
      toast.error("Please select an image first to animate.");
      return;
    }

    if (typeof overridePrompt === "string") {
      setPrompt(overridePrompt);
    }

    setLoading(true);
    setResultUrl(null);
    setIsSidebarOpen(false);

    const toastId = toast.loading("Developing your shot...", {
      description: `Using ${selectedGear.camera.name}`,
    });
    try {
      const endpoint =
        activeTab === "image" ? "/generate-image" : "/generate-video";
      const payload: any = {
        prompt: promptToUse,
        camera: selectedGear.camera.name,
        lens: selectedGear.lens.name,
        focal_length: selectedGear.focalLength,
        aspect_ratio: aspectRatio, // <--- USE SELECTED RATIO
      };
      if (activeTab === "image") {
        payload.reference_images = referenceImages;
        payload.image_strength = imageStrength;
      }

      if (activeTab === "video") {
        if (!resultUrl) {
          setLoading(false);
          return;
        }
        payload.image_url = resultUrl;
      }

      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === "success") {
        setResultUrl(activeTab === "image" ? data.image_url : data.video_url);
        fetchData();
        if (activeTab === "image") {
          setIsSidebarOpen(true);
        }
        toast.success("Shot developed successfully!", { id: toastId });
      } else {
        throw new Error(data.detail || "Generation failed");
      }
    } catch (e: any) {
      toast.error(`Generation failed: ${e.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS HANDLER ---
  const handleAction = async (
    e: React.MouseEvent,
    action: string,
    item: any
  ) => {
    e.stopPropagation();
    switch (action) {
      // VIEW PROXIES
      case "view_proxies":
        if (item.type !== "image") {
          toast.error("Storyboards are only for images.");
          return;
        }

        try {
          const res = await fetch(`http://127.0.0.1:8000/proxies/${item.id}`);
          const data = await res.json();

          if (data && data.length > 0) {
            setMultishotSourceId(item.id);
            setIsMultishotModalOpen(true);
            toast.success("Opening storyboard...");
          } else {
            toast("No storyboard found.", {
              description: "Click 'Multishot' to create one.",
              action: {
                label: "Generate",
                onClick: () => handleAction(e, "multishot", item),
              },
            });
          }
        } catch (err) {
          console.error(err);
          toast.error("Failed to load storyboard.");
        }
        break;

      // MULTISHOT (TRIGGER CONFIRMATION)
      case "multishot":
        if (item.type !== "image") {
          toast.error("Multishot is only for images.");
          return;
        }
        // OPEN CONFIRMATION MODAL INSTEAD OF GENERATING IMMEDIATELY
        setItemForMultishot(item);
        setIsMultishotConfirmOpen(true);
        break;

      case "delete":
        setItemToDelete(item);
        setIsDeleteModalOpen(true);
        break;

      case "like":
        try {
          const newVal = !item.is_favorite;
          setHistory((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, is_favorite: newVal } : i
            )
          );
          await fetch(`http://127.0.0.1:8000/history/${item.id}/favorite`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_favorite: newVal }),
          });
        } catch (e) {
          toast.error("Failed to update favorite");
        }
        break;

      case "copy":
        try {
          await fetch(`http://127.0.0.1:8000/history/${item.id}/duplicate`, {
            method: "POST",
          });
          fetchData();
          toast.success("Shot duplicated to library");
        } catch (e) {
          toast.error("Failed to duplicate");
        }
        break;

      case "download":
        try {
          const response = await fetch(item.url);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `cinema_studio_${item.id}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast.success("Saved to downloads");
        } catch (e) {
          toast.error("Download failed");
        }
        break;

      case "share":
        if (navigator.share) {
          navigator
            .share({
              title: "Cinematic Studio Shot",
              text: item.prompt,
              url: item.url,
            })
            .catch(console.error);
        } else {
          navigator.clipboard.writeText(item.url);
          toast.success("Link copied to clipboard");
        }
        break;

      default:
        toast("Feature coming soon!");
    }
  };

  // ACTUAL MULTISHOT GENERATION (Called after confirmation)
  const executeMultishotGeneration = async () => {
    if (!itemForMultishot) return;
    setIsMultishotConfirmOpen(false);

    const msToastId = toast.loading("Generating 9 alternative angles...", {
      description: "This takes about 15-20 seconds.",
    });

    try {
      const res = await fetch("http://127.0.0.1:8000/generate-multishot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_image_id: itemForMultishot.id }),
      });
      const data = await res.json();

      if (data.status === "success" && data.proxy_ids.length > 0) {
        toast.success("Angles generated!", { id: msToastId });
        setMultishotSourceId(itemForMultishot.id);
        setIsMultishotModalOpen(true);
      } else {
        throw new Error("Failed to generate proxies");
      }
    } catch (e) {
      toast.error("Multishot generation failed.", { id: msToastId });
      console.error(e);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await fetch(`http://127.0.0.1:8000/history/${itemToDelete.id}`, {
        method: "DELETE",
      });
      setHistory((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      toast.success("Shot deleted permanently");
    } catch (e) {
      toast.error("Failed to delete shot");
    }
  };

  const galleryItems = history.filter((i: any) => i.type === galleryFilter);

  return (
    <main className="flex flex-col h-screen bg-black text-white font-sans selection:bg-lime-500/30 overflow-hidden relative">
      {/* --- TOP LEFT: NAVIGATION --- */}
      <div className="fixed top-6 left-6 z-50 flex gap-2">
        {resultUrl ? (
          <button
            onClick={closeFocusMode}
            className="bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold backdrop-blur-xl border border-zinc-800 shadow-xl transition-all flex items-center gap-2 animate-in slide-in-from-left-2"
          >
            <ChevronLeft size={14} /> Back to Library
          </button>
        ) : (
          <div className="bg-zinc-900/90 backdrop-blur-xl p-1.5 rounded-xl border border-zinc-800 shadow-xl flex gap-1 animate-in slide-in-from-top-2">
            <button
              onClick={goHome}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                viewMode === "empty"
                  ? "bg-zinc-800 text-lime-400 shadow-sm border border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <LayoutTemplate size={14} /> Studio
            </button>

            <div className="w-px bg-zinc-800 my-1"></div>

            <button
              onClick={() => openGallery("image")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                viewMode === "gallery" && galleryFilter === "image"
                  ? "bg-zinc-800 text-lime-400 shadow-sm border border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <ImageIcon size={14} /> Images
            </button>
            <button
              onClick={() => openGallery("video")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                viewMode === "gallery" && galleryFilter === "video"
                  ? "bg-zinc-800 text-lime-400 shadow-sm border border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <Video size={14} /> Videos
            </button>
          </div>
        )}
      </div>

      {/* --- MAIN CONTENT LAYERS --- */}

      {/* LAYER 1: GALLERY GRID */}
      {viewMode === "gallery" && !resultUrl && (
        <div className="absolute inset-0 z-0 overflow-y-auto custom-scrollbar p-6 pt-24 pb-48 animate-in fade-in duration-300">
          <GalleryGrid
            items={galleryItems}
            onSelect={selectFromGallery}
            onAction={handleAction}
          />
          <div className="fixed bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none z-10"></div>
        </div>
      )}

      {/* LAYER 2: EMPTY STATE (Logo) */}
      {viewMode === "empty" && !resultUrl && (
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
          <div className="text-center space-y-4 opacity-30">
            <Zap size={80} className="mx-auto text-zinc-500" />
            <h1 className="text-3xl font-bold tracking-[0.2em] text-zinc-600 uppercase">
              Cinema Studio
            </h1>
          </div>
        </div>
      )}

      {/* LAYER 3: FOCUS MODE */}
      {resultUrl && (
        <div
          className={cn(
            "absolute inset-0 z-20 flex items-center justify-center p-4 pb-40 transition-all duration-500 ease-in-out",
            isSidebarOpen ? "pr-[420px]" : ""
          )}
        >
          <div
            className={cn(
              "relative w-full max-w-[90%] bg-black overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300",
              // DYNAMIC ASPECT RATIO FOR VIEWER
              aspectRatio === "9:16"
                ? "aspect-[9/16] h-[90vh]"
                : aspectRatio === "1:1"
                ? "aspect-square h-[90vh]"
                : "aspect-[21/9]"
            )}
          >
            {resultUrl.endsWith(".mp4") ? (
              <video
                src={resultUrl}
                autoPlay
                loop
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={resultUrl}
                alt="Result"
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <div className="fixed top-0 right-0 h-full z-50">
        <ResultSidebar
          isOpen={isSidebarOpen && resultUrl}
          onClose={() => setIsSidebarOpen(false)}
          prompt={prompt}
          selectedGear={selectedGear}
          onRecreate={handleGenerate}
          resultUrl={resultUrl}
          loading={loading}
        />
      </div>

      {/* --- BOTTOM DOCK --- */}
      <div
        className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-6xl z-40 px-6 flex items-end gap-3 transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          isSidebarOpen
            ? "opacity-0 scale-95 translate-y-4 pointer-events-none"
            : "opacity-100 scale-100 translate-y-0"
        )}
      >
        {/* 1. TABS */}
        <div className="bg-zinc-900/80 backdrop-blur-xl px-2 py-3.5 rounded-2xl border border-zinc-800/80 shadow-2xl flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("image")}
            className={cn(
              "p-3 rounded-xl transition-all",
              activeTab === "image"
                ? "bg-zinc-800 text-lime-400"
                : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            <ImageIcon size={20} />
          </button>
          <button
            onClick={() => setActiveTab("video")}
            className={cn(
              "p-3 rounded-xl transition-all",
              activeTab === "video"
                ? "bg-zinc-800 text-lime-400"
                : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            <Video size={20} />
          </button>
        </div>

        {/* 2. MAIN DOCK */}
        <div className="flex-1 bg-zinc-900/80 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800/80 shadow-2xl flex items-stretch gap-3 h-auto">
          <div className="flex-1 flex flex-col gap-2 p-1">
            {referenceImages.length > 0 ? (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center gap-2 flex-wrap animate-in slide-in-from-bottom-2">
                  {referenceImages.map((img, index) => (
                    <div
                      key={index}
                      className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-700 group/thumb shrink-0"
                    >
                      <img src={img} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeReferenceImage(index)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setIsSourceModalOpen(true)}
                    className="w-10 h-10 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-500 hover:text-white transition-all shrink-0 hover:bg-zinc-800"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <textarea
                  ref={promptRefWithImages}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    autosizePrompt(e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder="Describe the scene..."
                  className="w-full bg-transparent border-none outline-none text-white placeholder:text-zinc-600 text-sm font-medium resize-none min-h-[3rem] p-3 custom-scrollbar leading-relaxed"
                  rows={1}
                />
              </div>
            ) : (
              <div className="flex items-start gap-3 w-full">
                <button
                  onClick={() => setIsSourceModalOpen(true)}
                  className="mt-1.5 w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-500 hover:text-white transition-all shrink-0 hover:bg-zinc-800"
                >
                  <Plus size={18} />
                </button>
                <textarea
                  ref={promptRefNoImages}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    autosizePrompt(e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder={
                    activeTab === "image"
                      ? "Upload image as a prompt or Describe the scene..."
                      : "Describe the motion..."
                  }
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-zinc-600 text-sm font-medium resize-none min-h-[3.5rem] p-2.5 custom-scrollbar leading-relaxed pl-0"
                  rows={1}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              {activeTab === "video" ? (
                <>
                  <button
                    onClick={() => setIsMovementsModalOpen(true)}
                    className="flex items-center gap-1.5 bg-zinc-900/50 px-2.5 py-1 rounded-lg text-xs font-medium text-lime-400 border border-lime-500/20 hover:border-lime-500/40 transition-all"
                  >
                    <Film size={12} /> {selectedMovement.name}
                  </button>
                  <div className="h-3 w-px bg-zinc-800 mx-1"></div>
                  <button className="flex items-center gap-1.5 bg-zinc-900/50 px-2 py-1 rounded-lg text-xs font-medium text-zinc-500 border border-zinc-800 hover:text-zinc-300">
                    <Clock size={12} /> 5s
                  </button>
                </>
              ) : (
                // --- ASPECT RATIO SELECTOR (IMAGE MODE) ---
                <div className="flex items-center gap-1">
                  <span className="text-zinc-600 mr-1">
                    <Ratio size={12} />
                  </span>
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-bold border transition-all",
                        aspectRatio === ratio
                          ? "bg-zinc-800 text-white border-zinc-600"
                          : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/50"
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 h-auto">
            {activeTab === "image" && (
              <button
                onClick={() => setIsGearModalOpen(true)}
                className="group relative flex flex-col items-start w-40 h-[6rem] p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 transition-all text-left justify-center"
              >
                <Settings
                  size={16}
                  className="absolute top-3 right-3 text-zinc-600 group-hover:text-zinc-400 transition-colors"
                />
                <div className="text-[11px] font-bold text-white truncate w-[85%] leading-tight">
                  {selectedGear.camera.name}
                </div>
                <div className="text-[10px] text-zinc-500 truncate w-[85%] mt-1">
                  {selectedGear.lens.name}, {selectedGear.focalLength}
                </div>
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={
                loading ||
                (!prompt &&
                  referenceImages.length === 0 &&
                  activeTab === "image") ||
                (activeTab === "video" && !resultUrl)
              }
              className={cn(
                "w-40 h-[6rem] px-4 rounded-2xl font-black text-sm text-black flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(163,230,53,0.1)] hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shrink-0 bg-gradient-to-r from-[#D2FF44] to-[#E7FF86]"
              )}
            >
              {loading ? (
                <Zap size={20} className="animate-pulse" />
              ) : (
                <>
                  <span>GENERATE</span>
                  <Zap size={16} fill="currentColor" className="ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <GearModal
        isOpen={isGearModalOpen}
        onClose={() => setIsGearModalOpen(false)}
        selectedGear={selectedGear}
        onSelectGear={handleGearSelect}
        imageStrength={imageStrength}
        onSetImageStrength={setImageStrength}
      />
      <SourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onNewUpload={handleNewUpload}
        history={history}
        uploads={uploads}
        onSelectReference={handleSelectReference}
      />
      <MovementsModal
        isOpen={isMovementsModalOpen}
        onClose={() => setIsMovementsModalOpen(false)}
        selectedMovement={selectedMovement}
        onSelectMovement={setSelectedMovement}
      />

      {/* --- MODALS --- */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
      />

      <MultishotModal
        isOpen={isMultishotModalOpen}
        onClose={() => setIsMultishotModalOpen(false)}
        sourceItemId={multishotSourceId}
        onUpscaleComplete={fetchData}
      />

      <MultishotConfirmModal
        isOpen={isMultishotConfirmOpen}
        onClose={() => setIsMultishotConfirmOpen(false)}
        onConfirm={executeMultishotGeneration}
      />
    </main>
  );
}
