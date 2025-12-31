import os
import json
import random
import time
import sqlite3
import asyncio
import shutil
import urllib.request
import urllib.parse
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
import websocket # pip install websocket-client
import requests # pip install requests

# --- CONFIGURATION ---
load_dotenv()

# DIRECTORIES
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

# --- COMFYUI BRIDGE ---
class ComfyBridge:
    def __init__(self, server_address="127.0.0.1:8188"):
        self.server_address = server_address
        self.client_id = str(random.randint(100000, 999999))

    def upload_image(self, file_path):
        """Uploads the local source image to ComfyUI's input folder"""
        url = f"http://{self.server_address}/upload/image"
        with open(file_path, "rb") as file:
            files = {"image": file}
            data = {"overwrite": "true"}
            response = requests.post(url, files=files, data=data)
            return response.json()

    def queue_prompt(self, workflow):
        p = {"prompt": workflow, "client_id": self.client_id}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"http://{self.server_address}/prompt", data=data)
        return json.loads(urllib.request.urlopen(req).read())

    def get_image(self, workflow):
        ws = websocket.WebSocket()
        ws.connect(f"ws://{self.server_address}/ws?clientId={self.client_id}")
        prompt_id = self.queue_prompt(workflow)['prompt_id']
        
        while True:
            out = ws.recv()
            if isinstance(out, str):
                message = json.loads(out)
                if message['type'] == 'executing':
                    data = message['data']
                    if data['node'] is None and data['prompt_id'] == prompt_id:
                        break # Execution is done
        
        # Fetch history to get the filename
        with urllib.request.urlopen(f"http://{self.server_address}/history/{prompt_id}") as response:
            history = json.loads(response.read())
            
        # Extract filename from Node 9 (SaveImage)
        history_data = history[prompt_id]
        outputs = history_data['outputs']
        
        for node_id in outputs:
            node_output = outputs[node_id]
            if 'images' in node_output:
                for image in node_output['images']:
                    return image['filename']
        return None

comfy = ComfyBridge()

# --- DATABASE ---
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""
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
    """)
    conn.commit()
    conn.close()

init_db()

# --- MODELS ---
class MultishotRequest(BaseModel):
    source_image_id: int

# --- HELPERS ---
def get_db_item(item_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM generated_content WHERE id = ?", (item_id,))
    item = c.fetchone()
    conn.close()
    return item

def load_workflow_template():
    # Make sure workflow_api.json exists in the same folder!
    try:
        with open("workflow_api.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print("ERROR: workflow_api.json not found.")
        return {}

# --- ENDPOINTS ---

@app.get("/history")
async def get_history():
    """
    Returns the list of generated images, BUT hides the 'proxy' (multishot) 
    child images to prevent the gallery from getting flooded and slow.
    """
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # FIX: Added "WHERE is_proxy = 0" to filter out the clutter
    c.execute("SELECT * FROM generated_content WHERE is_proxy = 0 ORDER BY id DESC")
    
    items = c.fetchall()
    conn.close()
    return items

@app.get("/proxies/{parent_id}")
async def get_proxies(parent_id: int):
    """
    Fetches only the Multishot/Proxy images for a specific parent.
    """
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM generated_content WHERE parent_id = ? ORDER BY id ASC", (parent_id,))
    items = c.fetchall()
    conn.close()
    return items

@app.post("/generate-multishot")
async def generate_multishot(req: MultishotRequest):
    source_item = get_db_item(req.source_image_id)
    if not source_item:
        raise HTTPException(status_code=404, detail="Source image DB record not found")

    # --- SMART FILE RESOLUTION (Keep this part as is) ---
    source_url = source_item["url"]
    filename = os.path.basename(source_url)
    local_path = None
    potential_paths = [
        os.path.join(GENERATED_DIR, filename),
        os.path.join(UPLOAD_DIR, filename)
    ]
    for p in potential_paths:
        if os.path.exists(p):
            local_path = p
            break
            
    if not local_path:
        print(f"File not found locally. Attempting download from: {source_url}")
        try:
            response = requests.get(source_url, stream=True)
            if response.status_code == 200:
                temp_path = os.path.join(UPLOAD_DIR, filename)
                with open(temp_path, 'wb') as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
                local_path = temp_path
            else:
                print(f"Failed to download. Status: {response.status_code}")
        except Exception as e:
            print(f"Download error: {e}")

    if not local_path or not os.path.exists(local_path):
         raise HTTPException(status_code=404, detail=f"Source file not found: {filename}")

    # --- UPLOAD TO COMFYUI ---
    try:
        upload_resp = comfy.upload_image(local_path)
        comfy_filename = upload_resp["name"]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to connect to ComfyUI. Is it running?")

    # --- DEFINE ANGLES ---
    angles = [
        {"label": "Close Up Portrait", "prompt": "Extreme close-up portrait, detailed eyes, intense stare, front view"},
        {"label": "Wide Action", "prompt": "Wide shot, full body action pose, dynamic environment, running, motion blur"},
        {"label": "Side Profile", "prompt": "Side profile shot, looking left, sharp jawline, contemplative"},
        {"label": "Low Angle Hero", "prompt": "Low angle shot from below looking up, heroic stature, epic sky background"},
        {"label": "Over Shoulder", "prompt": "Over-the-shoulder shot, back of head visible, cinematic composition"},
        {"label": "Dutch Angle", "prompt": "Dutch angle, tilted camera, tense atmosphere, uneven horizon"}
    ]

    generated_ids = []

    # --- GENERATE LOOP ---
    base_workflow = load_workflow_template()
    if not base_workflow:
         raise HTTPException(status_code=500, detail="Workflow template not found")

    for angle in angles:
        print(f"Generating: {angle['label']}...")
        workflow = json.loads(json.dumps(base_workflow))

        # 1. Optimization & Handcuffs (Keep these settings)
        workflow["3"]["inputs"]["steps"] = 16 
        workflow["42"]["inputs"]["weight"] = 0.35
        workflow["5"]["inputs"]["width"] = 1024
        workflow["5"]["inputs"]["height"] = 1024
        workflow["3"]["inputs"]["seed"] = random.randint(1, 1500000000000)
        workflow["44"]["inputs"]["image"] = comfy_filename

        # --- THE FIX: DYNAMIC PROMPTING ---
        # Instead of hardcoding "wasteland scavenger", we combine:
        # 1. The Angle (e.g., "Side profile shot")
        # 2. The Original Prompt (e.g., "A cyberpunk hacker...")
        # 3. The Camera Metadata (e.g., "Sony A7RIII")
        
        original_prompt = source_item['prompt'] # <--- This comes from your DB
        camera_info = f"{source_item['camera']} {source_item['lens']}" if source_item['camera'] else ""
        
        # We strip "cinematic photo of..." from the original if it exists to avoid duplication
        # but simple concatenation works best for InstantID.
        full_prompt = f"{angle['prompt']}, {original_prompt}, {camera_info}, detailed, 8k"

        workflow["6"]["inputs"]["text"] = full_prompt
        
        # ----------------------------------

        # Execute
        try:
            output_filename = comfy.get_image(workflow)
            if output_filename:
                img_url = f"http://127.0.0.1:8188/view?filename={output_filename}&type=output"
                target_filename = f"multishot_{angle['label'].replace(' ', '_')}_{int(time.time())}.png"
                target_path = os.path.join(GENERATED_DIR, target_filename)
                
                r = requests.get(img_url)
                with open(target_path, "wb") as f:
                    f.write(r.content)
                
                final_url = f"http://localhost:8000/generated/{target_filename}"

                conn = sqlite3.connect(DB_NAME)
                c = conn.cursor()
                c.execute(
                    "INSERT INTO generated_content (type, prompt, url, camera, lens, focal_length, is_proxy, parent_id, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    ("image", full_prompt, final_url, angle['label'], "InstantID Fast", "Cinematic", 1, req.source_image_id, time.time()),
                )
                generated_ids.append(c.lastrowid)
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"Failed to generate {angle['label']}: {e}")

    return {"status": "success", "proxy_ids": generated_ids}

# --- STATIC FILES ---
from fastapi.staticfiles import StaticFiles
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)