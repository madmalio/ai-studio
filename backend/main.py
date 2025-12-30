import base64
import os
import sqlite3
import time
import shutil
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
import fal_client
from dotenv import load_dotenv

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
    
    # Added 'is_favorite' column
    c.execute('''
        CREATE TABLE IF NOT EXISTS generated_content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            prompt TEXT,
            url TEXT NOT NULL,
            camera TEXT,
            lens TEXT,
            focal_length TEXT,
            is_favorite INTEGER DEFAULT 0,
            created_at REAL
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base64_data TEXT NOT NULL,
            created_at REAL
        )
    ''')
    
    conn.commit()
    conn.close()

init_db()

# --- PYDANTIC MODELS ---
class GenerateImageRequest(BaseModel):
    prompt: str
    camera: str
    lens: str
    focal_length: str
    aspect_ratio: str
    reference_images: List[str] = []
    image_strength: float = 0.75

class GenerateVideoRequest(BaseModel):
    image_url: str
    prompt: str
    camera: str
    lens: str
    focal_length: str

class UploadRequest(BaseModel):
    base64_data: str

class FavoriteRequest(BaseModel):
    is_favorite: bool

# --- ENDPOINTS ---

@app.post("/generate-image")
async def generate_image(req: GenerateImageRequest):
    print(f"Generating with Fal.ai: {req.camera} + {req.lens} @ {req.focal_length}")
    full_prompt = f"{req.prompt}, cinematic shot on {req.camera}, {req.lens} lens, {req.focal_length}, 8k, highly detailed, photorealistic, masterpiece"

    try:
        handler = fal_client.submit(
            "fal-ai/flux/dev",
            arguments={
                "prompt": full_prompt,
                "image_size": {"width": 1536, "height": 640},
                "num_inference_steps": 28,
                "guidance_scale": 3.5,
                "enable_safety_checker": False
            },
        )
        result = handler.get()
        image_url = result['images'][0]['url']
        
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute(
            "INSERT INTO generated_content (type, prompt, url, camera, lens, focal_length, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("image", req.prompt, image_url, req.camera, req.lens, req.focal_length, time.time())
        )
        conn.commit()
        conn.close()
        
        return {"status": "success", "image_url": image_url}

    except Exception as e:
        print(f"Fal Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-video")
async def generate_video(req: GenerateVideoRequest):
    # Mock video for now
    mock_url = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "INSERT INTO generated_content (type, prompt, url, camera, lens, focal_length, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("video", req.prompt, mock_url, req.camera, req.lens, req.focal_length, time.time())
    )
    conn.commit()
    conn.close()
    return {"status": "success", "video_url": mock_url}

@app.post("/upload")
async def upload_image(req: UploadRequest):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO uploads (base64_data, created_at) VALUES (?, ?)", (req.base64_data, time.time()))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/history")
async def get_history():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM generated_content ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    return rows

@app.get("/uploads")
async def get_uploads():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM uploads ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    return rows

# --- NEW ACTIONS ---

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

@app.post("/history/{item_id}/duplicate")
async def duplicate_item(item_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # 1. Get original
    c.execute("SELECT * FROM generated_content WHERE id = ?", (item_id,))
    item = c.fetchone()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # 2. Insert copy
    c.execute('''
        INSERT INTO generated_content (type, prompt, url, camera, lens, focal_length, is_favorite, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (item['type'], item['prompt'], item['url'], item['camera'], item['lens'], item['focal_length'], 0, time.time())) # Reset favorite on copy
    
    conn.commit()
    conn.close()
    return {"status": "duplicated"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)