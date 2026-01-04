import os
import json
import random
import time
import sqlite3
import urllib.request
import urllib.parse
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
import websocket # pip install websocket-client
import requests # pip install requests
import base64

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

# --- COMFYUI BRIDGE (RunPod Optimized) ---
class ComfyBridge:
    def __init__(self, server_address):
        # Cleans the address to handle both "127.0.0.1:8188" and "https://xyz.runpod.net"
        self.original_address = server_address.rstrip('/')
        self.client_id = str(random.randint(100000, 999999))
        
        # Determine protocols based on input
        if "runpod.net" in self.original_address:
            # RUNPOD MODE (Secure)
            if not self.original_address.startswith("https://"):
                self.base_url = f"https://{self.original_address}"
                self.ws_url = f"wss://{self.original_address}"
            else:
                self.base_url = self.original_address
                self.ws_url = self.original_address.replace("https://", "wss://")
        else:
            # LOCAL MODE (Standard)
            clean_addr = self.original_address.replace("http://", "").replace("https://", "")
            self.base_url = f"http://{clean_addr}"
            self.ws_url = f"ws://{clean_addr}"

        print(f"🌉 Bridge Initialized to: {self.base_url}")

    def upload_image(self, file_path):
        """Uploads the local source image to ComfyUI"""
        url = f"{self.base_url}/upload/image"
        try:
            with open(file_path, "rb") as file:
                files = {"image": file}
                data = {"overwrite": "true"}
                headers = {"User-Agent": "Mozilla/5.0"} 
                response = requests.post(url, files=files, data=data, headers=headers)
                return response.json()
        except Exception as e:
            print(f"❌ Upload Error: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload to RunPod")

    def queue_prompt(self, workflow):
        url = f"{self.base_url}/prompt"
        p = {"prompt": workflow, "client_id": self.client_id}
        data = json.dumps(p).encode('utf-8')
        try:
            req = urllib.request.Request(url, data=data)
            req.add_header("User-Agent", "Mozilla/5.0") 
            return json.loads(urllib.request.urlopen(req).read())
        except Exception as e:
            print(f"❌ Queue Error: {e}")
            raise HTTPException(status_code=500, detail="Failed to queue prompt")

    def get_image(self, workflow):
        ws = websocket.WebSocket()
        try:
            # Connect to WebSocket
            connect_url = f"{self.ws_url}/ws?clientId={self.client_id}"
            print(f"🔌 Connecting to: {connect_url}")
            ws.connect(connect_url)
        except Exception as e:
            print(f"❌ WebSocket Error: {e}")
            raise HTTPException(status_code=500, detail="Could not connect to ComfyUI Stream")
            
        prompt_response = self.queue_prompt(workflow)
        prompt_id = prompt_response['prompt_id']
        print(f"⏳ Job Started: {prompt_id}")
        
        while True:
            out = ws.recv()
            if isinstance(out, str):
                message = json.loads(out)
                if message['type'] == 'executing':
                    data = message['data']
                    if data['node'] is None and data['prompt_id'] == prompt_id:
                        break # Execution is done
        
        # Fetch history
        history_url = f"{self.base_url}/history/{prompt_id}"
        req = urllib.request.Request(history_url)
        req.add_header("User-Agent", "Mozilla/5.0")
        
        with urllib.request.urlopen(req) as response:
            history = json.loads(response.read())
            
        history_data = history[prompt_id]
        outputs = history_data['outputs']
        
        for node_id in outputs:
            node_output = outputs[node_id]
            if 'images' in node_output:
                for image in node_output['images']:
                    return image['filename']
        return None

# --- INITIALIZATION ---
# Your specific RunPod Address
comfy = ComfyBridge(server_address="https://mt7wsv4h5cnn07-8188.proxy.runpod.net/")

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
class GenerateRequest(BaseModel):
    prompt: str
    camera: str
    lens: str
    focal_length: str
    aspect_ratio: str = "21:9"
    reference_images: Optional[List[str]] = []
    image_strength: Optional[float] = 0.75

class MultishotRequest(BaseModel):
    source_image_id: int

# --- HELPERS ---
def get_dimensions(ratio: str):
    if ratio == "21:9": return 1536, 640
    if ratio == "16:9": return 1344, 768
    if ratio == "4:3":  return 1152, 864
    if ratio == "1:1":  return 1024, 1024
    if ratio == "9:16": return 768, 1344
    return 1344, 768 

def load_workflow(filename):
    try:
        with open(filename, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def get_db_item(item_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM generated_content WHERE id = ?", (item_id,))
    item = c.fetchone()
    conn.close()
    return item

# --- ENDPOINTS ---

@app.post("/generate-image")
async def generate_image(req: GenerateRequest):
    print(f"🎬 Generating: {req.prompt} | Camera: {req.camera} | Ratio: {req.aspect_ratio}")

    # 1. Determine Switch: Standard vs InstantID
    has_reference = req.reference_images and len(req.reference_images) > 0
    
    if has_reference:
        print(f"   ↳ 👤 Reference Image Detected! Using InstantID.")
        workflow = load_workflow("workflow_multishot.json")
        target_workflow = "instantid"
    else:
        print(f"   ↳ 🎨 No Reference. Using Standard Text-to-Image.")
        workflow = load_workflow("workflow_txt2img.json")
        target_workflow = "standard"

    if not workflow:
        raise HTTPException(status_code=500, detail="Workflow file missing")

    # 2. Upload Reference Image (If needed)
    comfy_filename = None
    if has_reference:
        ref_data = req.reference_images[0]
        
        # Handle Base64 (New Uploads)
        if "base64," in ref_data:
            header, encoded = ref_data.split(",", 1)
            file_data = base64.b64decode(encoded)
            temp_filename = f"ref_{int(time.time())}.jpg"
        else:
            # Handle URL (Existing Gallery items)
            temp_filename = os.path.basename(ref_data)
            local_check_path = os.path.join(UPLOAD_DIR, temp_filename)
            if not os.path.exists(local_check_path):
                 local_check_path = os.path.join(GENERATED_DIR, temp_filename)
            
            if os.path.exists(local_check_path):
                with open(local_check_path, "rb") as f:
                    file_data = f.read()
            else:
                 try:
                    r = requests.get(ref_data)
                    file_data = r.content
                 except:
                    print("Failed to download ref URL")
                    file_data = None

        if file_data:
            temp_path = os.path.join(UPLOAD_DIR, temp_filename)
            with open(temp_path, "wb") as f:
                f.write(file_data)
                
            try:
                upload_resp = comfy.upload_image(temp_path)
                comfy_filename = upload_resp["name"]
            except Exception as e:
                print(f"Failed to upload reference: {e}")
                # We don't crash here; we might just fallback, but usually this is fatal for InstantID

    # 3. Construct Prompt
    tech_specs = f"shot on {req.camera}, {req.lens} {req.focal_length}, cinematic lighting, 8k, detailed"
    full_prompt = f"{req.prompt}, {tech_specs}"
    
    # 4. Inject Values (Using Common IDs: 3=Seed, 5=Dims, 6=Prompt)
    width, height = get_dimensions(req.aspect_ratio)
    
    if "5" in workflow:
        workflow["5"]["inputs"]["width"] = width
        workflow["5"]["inputs"]["height"] = height
    
    if "3" in workflow:
        workflow["3"]["inputs"]["seed"] = random.randint(1, 1000000000000)
    
    if "6" in workflow:
        workflow["6"]["inputs"]["text"] = full_prompt

    # Inject Image for InstantID
    if target_workflow == "instantid" and comfy_filename:
        # Find LoadImage Node dynamically
        for nid, node in workflow.items():
            if node["class_type"] == "LoadImage":
                workflow[nid]["inputs"]["image"] = comfy_filename
                break

    # 5. Execute
    try:
        output_filename = comfy.get_image(workflow)
        
        # Download Result
        runpod_url = f"{comfy.base_url}/view?filename={output_filename}&type=output"
        local_filename = f"cinematic_{int(time.time())}.png"
        local_path = os.path.join(GENERATED_DIR, local_filename)

        with requests.get(runpod_url, stream=True, headers={"User-Agent": "Mozilla/5.0"}) as r:
            r.raise_for_status()
            with open(local_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192): 
                    f.write(chunk)

        final_url = f"http://localhost:8000/generated/{local_filename}"
        
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute(
            "INSERT INTO generated_content (type, prompt, url, camera, lens, focal_length, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("image", full_prompt, final_url, req.camera, req.lens, req.focal_length, time.time())
        )
        conn.commit()
        conn.close()

        return {"status": "success", "image_url": final_url}

    except Exception as e:
        print(f"❌ Generation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-multishot")
async def generate_multishot(req: MultishotRequest):
    source_item = get_db_item(req.source_image_id)
    if not source_item:
        raise HTTPException(status_code=404, detail="Source image DB record not found")

    # Upload Source to ComfyUI
    source_filename = os.path.basename(source_item["url"])
    local_path = os.path.join(GENERATED_DIR, source_filename)
    if not os.path.exists(local_path):
        local_path = os.path.join(UPLOAD_DIR, source_filename)
        
    try:
        upload_resp = comfy.upload_image(local_path)
        comfy_filename = upload_resp["name"]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to upload source to ComfyUI")

    angles = [
        {"label": "Close Up", "prompt": "Extreme close-up portrait, detailed eyes, intense stare"},
        {"label": "Wide Action", "prompt": "Wide shot, full body action pose, dynamic environment"},
        {"label": "Side Profile", "prompt": "Side profile shot, looking left, sharp jawline"},
        {"label": "Low Angle", "prompt": "Low angle shot from below looking up, heroic stature"},
        {"label": "Dutch Angle", "prompt": "Dutch angle, tilted camera, tense atmosphere"},
        {"label": "Cinematic", "prompt": "Cinematic medium shot, perfect lighting"}
    ]

    base_workflow = load_workflow("workflow_multishot.json")
    generated_ids = []

    for angle in angles:
        print(f"🔄 Processing Angle: {angle['label']}...")
        workflow = json.loads(json.dumps(base_workflow))

        if "3" in workflow: workflow["3"]["inputs"]["seed"] = random.randint(1, 1000000000000)
        
        base_prompt = source_item['prompt'].split(', shot on')[0]
        full_angle_prompt = f"{angle['prompt']}, {base_prompt}, detailed, 8k"
        
        if "6" in workflow: workflow["6"]["inputs"]["text"] = full_angle_prompt

        for nid, node in workflow.items():
            if node["class_type"] == "LoadImage":
                workflow[nid]["inputs"]["image"] = comfy_filename
                break

        try:
            output_filename = comfy.get_image(workflow)
            
            runpod_url = f"{comfy.base_url}/view?filename={output_filename}&type=output"
            target_filename = f"multishot_{angle['label'].replace(' ', '')}_{int(time.time())}.png"
            target_path = os.path.join(GENERATED_DIR, target_filename)
            
            with requests.get(runpod_url, stream=True, headers={"User-Agent": "Mozilla/5.0"}) as r:
                r.raise_for_status()
                with open(target_path, "wb") as f:
                    f.write(r.content)
            
            final_url = f"http://localhost:8000/generated/{target_filename}"

            conn = sqlite3.connect(DB_NAME)
            c = conn.cursor()
            c.execute(
                "INSERT INTO generated_content (type, prompt, url, camera, lens, focal_length, is_proxy, parent_id, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ("image", full_angle_prompt, final_url, angle['label'], "InstantID", "N/A", 1, req.source_image_id, time.time()),
            )
            generated_ids.append(c.lastrowid)
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"❌ Failed to generate {angle['label']}: {e}")

    return {"status": "success", "proxy_ids": generated_ids}

@app.get("/history")
async def get_history():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM generated_content WHERE is_proxy = 0 ORDER BY id DESC")
    items = c.fetchall()
    conn.close()
    return items

@app.get("/proxies/{parent_id}")
async def get_proxies(parent_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM generated_content WHERE parent_id = ? ORDER BY id ASC", (parent_id,))
    items = c.fetchall()
    conn.close()
    return items

# --- GALLERY ENDPOINT (Fixes 404 on Uploads) ---
@app.get("/uploads")
async def get_uploads_list():
    if not os.path.exists(UPLOAD_DIR):
        return []
    
    files = []
    # Sort by time so newest are first
    for filename in sorted(os.listdir(UPLOAD_DIR), key=lambda f: os.path.getmtime(os.path.join(UPLOAD_DIR, f)), reverse=True):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            files.append({
                "id": int(os.path.getmtime(os.path.join(UPLOAD_DIR, filename))),
                "url": f"http://localhost:8000/uploads/{filename}",
                "type": "image",
                "base64_data": f"http://localhost:8000/uploads/{filename}" 
            })
    return files

app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)