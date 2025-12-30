import base64
import os
import sqlite3
import time
import shutil
import asyncio
from typing import Optional, List, Union

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
import fal_client
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv()

UPLOAD_DIR = "uploads"
GENERATED_DIR = "generated"
DB_NAME = "cinema_studio.db"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(GENERATED_DIR, exist_ok=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute(
        """
        CREATE TABLE IF NOT EXISTS generated_content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            prompt TEXT,
            url TEXT NOT NULL,
            camera TEXT,
            lens TEXT,
            focal_length TEXT,
            is_favorite INTEGER DEFAULT 0,
            is_proxy INTEGER DEFAULT 0,
            parent_id INTEGER,
            created_at REAL
        )
        """
    )
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base64_data TEXT NOT NULL,
            created_at REAL
        )
        """
    )
    conn.commit()
    conn.close()

init_db()

# --- PYDANTIC MODELS ---
class GenerateImageRequest(BaseModel):
    prompt: str
    camera: str
    lens: str
    focal_length: str
    aspect_ratio: str  # e.g., "16:9", "21:9", "9:16", "1:1"
    reference_images: List[str] = []
    image_strength: float = 0.75

class MultishotRequest(BaseModel):
    source_image_id: int

class UpscaleRequest(BaseModel):
    proxy_ids: List[int]

class UploadRequest(BaseModel):
    base64_data: str

class FavoriteRequest(BaseModel):
    is_favorite: bool

class GenerateVideoRequest(BaseModel):
    image_url: str
    prompt: str
    camera: str
    lens: str
    focal_length: str

# --- HELPER FUNCTIONS ---
def get_db_item(item_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM generated_content WHERE id = ?", (item_id,))
    item = c.fetchone()
    conn.close()
    return item

def calculate_image_size(aspect_ratio: str):
    """
    Maps UI aspect ratios to Recraft V3 specific resolutions.
    """
    # Recraft supports dictionary sizes {width: x, height: y}
    if aspect_ratio == "21:9":
        return {"width": 1440, "height": 616} # Ultra-Wide Cinematic
    elif aspect_ratio == "16:9":
        return {"width": 1440, "height": 810} # Standard HD
    elif aspect_ratio == "4:3":
        return {"width": 1440, "height": 1080}
    elif aspect_ratio == "1:1":
        return {"width": 1024, "height": 1024} # Square
    elif aspect_ratio == "9:16":
        return {"width": 810, "height": 1440} # Vertical
    else:
        return "landscape_16_9" # Default fallback

async def generate_recraft_shot(
    prompt: str,
    angle_label: str,
    ui_label: str,
    ref_url: str,
    parent_id: int,
    semaphore: asyncio.Semaphore,
):
    full_prompt = f"{angle_label}. {prompt}. Cinematic lighting, photorealistic 8k, highly detailed."
    
    # Multishots always default to 16:9 for the storyboard grid, 
    # but we could match the source AR if we wanted. 
    # For now, 16:9 is best for the grid layout.
    image_size = {"width": 1440, "height": 810} 

    async with semaphore:
        try:
            handler = fal_client.submit(
                "fal-ai/recraft/v3/text-to-image",
                arguments={
                    "prompt": full_prompt,
                    "image_size": image_size,
                    "style": "realistic_image",
                    "images": [{"url": ref_url}], 
                },
            )
            result = handler.get()
            image_url = result["images"][0]["url"]

            conn = sqlite3.connect(DB_NAME)
            c = conn.cursor()
            c.execute(
                "INSERT INTO generated_content (type, prompt, url, camera, lens, focal_length, is_proxy, parent_id, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ("image", full_prompt, image_url, ui_label, "Recraft V3", "Cinematic", 1, parent_id, time.time()),
            )
            new_id = c.lastrowid
            conn.commit()
            conn.close()
            return new_id
        except Exception as e:
            print(f"Recraft generation failed for {ui_label}: {e}")
            return None

# --- ENDPOINTS ---

# 1. GENERATE IMAGE (SOURCE)
@app.post("/generate-image")
async def generate_image(req: GenerateImageRequest):
    print(f"Generating Source ({req.aspect_ratio}): {req.prompt}")

    full_prompt = f"{req.prompt}, cinematic shot, {req.camera}, {req.lens} lens, {req.focal_length}, 8k masterpiece"
    
    # NEW: Calculate exact dimensions based on user selection
    target_size = calculate_image_size(req.aspect_ratio)

    try:
        handler = fal_client.submit(
            "fal-ai/recraft/v3/text-to-image",
            arguments={
                "prompt": full_prompt,
                "image_size": target_size, # Pass the dynamic size
                "style": "realistic_image",
                "images": [{"url": req.reference_images[0]}] if req.reference_images else []
            },
        )

        result = handler.get()
        image_url = result["images"][0]["url"]

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute(
            "INSERT INTO generated_content (type, prompt, url, camera, lens, focal_length, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("image", req.prompt, image_url, req.camera, req.lens, req.focal_length, time.time()),
        )
        conn.commit()
        conn.close()

        return {"status": "success", "image_url": image_url}

    except Exception as e:
        print(f"Fal/Recraft Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 2. MULTISHOT
@app.post("/generate-multishot")
async def generate_multishot(req: MultishotRequest):
    source_item = get_db_item(req.source_image_id)
    if not source_item:
        raise HTTPException(status_code=404, detail="Source image not found")

    angles = [
        {"label": "Low Angle Hero", "suffix": "Low angle medium shot looking up at subject, heroic stature, epic sky background"},
        {"label": "Action Medium", "suffix": "Dynamic action shot, subject moving through environment, motion blur, intensity"},
        {"label": "Profile Close-Up", "suffix": "Strict Side Profile Close-Up, contemplative expression, sharp focus on features"},
        {"label": "Sun Flare / Backlight", "suffix": "Cinematic silhouette shot, strong backlighting, lens flare, atmospheric mood"},
        {"label": "High Angle (God's Eye)", "suffix": "High angle camera looking straight down from above (bird's eye view), subject far below"},
        {"label": "Side Profile Wide", "suffix": "Wide angle side profile, subject walking through environment, rule of thirds composition"},
        {"label": "Over-The-Shoulder", "suffix": "Over-the-shoulder shot from behind the subject, looking at the horizon, narrative perspective"},
        {"label": "Dynamic Low Angle", "suffix": "Dutch Angle (tilted camera), dynamic composition, intense expression, dramatic atmosphere"},
        {"label": "Extreme Close-Up", "suffix": "Extreme Close-Up (ECU) on eyes and face, highly detailed skin texture, intense emotion"}
    ]

    base_prompt = source_item["prompt"]
    clean_prompt = base_prompt
    for word in ["looking at camera", "facing camera", "front view", "portrait", "close up", "wide shot"]:
        clean_prompt = clean_prompt.replace(word, "").replace(word.title(), "")

    semaphore = asyncio.Semaphore(3)
    tasks = []
    for angle_data in angles:
        tasks.append(generate_recraft_shot(clean_prompt, angle_data['suffix'], angle_data['label'], source_item["url"], req.source_image_id, semaphore))

    print(f"Starting Recraft multishot generation...")
    proxy_ids = await asyncio.gather(*tasks)
    successful_ids = [pid for pid in proxy_ids if pid is not None]

    return {"status": "success", "proxy_ids": successful_ids}

# 3. GET PROXIES (For your new 'View Storyboard' button)
@app.get("/proxies/{source_id}")
async def get_proxies(source_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        "SELECT * FROM generated_content WHERE parent_id = ? AND is_proxy = 1 ORDER BY created_at ASC",
        (source_id,),
    )
    rows = c.fetchall()
    conn.close()
    return rows

# 4. HISTORY & UTILS
@app.get("/history")
async def get_history():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM generated_content WHERE is_proxy = 0 ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    return rows

@app.post("/upload")
async def upload_image(req: UploadRequest):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO uploads (base64_data, created_at) VALUES (?, ?)", (req.base64_data, time.time()))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/uploads")
async def get_uploads():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM uploads ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    return rows

@app.delete("/history/{item_id}")
async def delete_item(item_id: int):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM generated_content WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

@app.put("/history/{item_id}/favorite")
async def toggle_favorite(item_id: int, req: FavoriteRequest):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("UPDATE generated_content SET is_favorite = ? WHERE id = ?", (1 if req.is_favorite else 0, item_id))
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.post("/upscale-proxies")
async def upscale_proxies(req: UpscaleRequest):
    return {"status": "skipped", "message": "Recraft output is already high quality"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)