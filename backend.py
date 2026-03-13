from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from pathlib import Path
import asyncio
from typing import List
import threading
import re

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the base directory
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "3D Models"

# Global state for speech recognition
stt_active = False
stt_command = None
active_connections: List[WebSocket] = []


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass


manager = ConnectionManager()


@app.get("/")
async def read_root():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/app.js")
async def read_app_js():
    return FileResponse(BASE_DIR / "app.js", media_type="application/javascript")


@app.get("/handTracking.js")
async def read_hand_tracking_js():
    return FileResponse(BASE_DIR / "handTracking.js", media_type="application/javascript")


@app.get("/api/models")
async def get_models():
    """Get list of all available 3D models"""
    models = []
    try:
        for item in MODELS_DIR.iterdir():
            if item.is_dir():
                # Check if the directory contains model files (recursively)
                obj_files = list(item.rglob("*.obj"))
                if obj_files:
                    models.append({
                        "name": item.name,
                        "path": str(item.relative_to(BASE_DIR)).replace("\\", "/")
                    })
    except Exception as e:
        print(f"Error reading models: {e}")
    
    return JSONResponse(content={"models": sorted(models, key=lambda x: x["name"])})


@app.get("/api/model/{model_name}")
async def get_model_files(model_name: str):
    """Get all files for a specific model"""
    model_path = MODELS_DIR / model_name
    
    if not model_path.exists():
        return JSONResponse(content={"error": "Model not found"}, status_code=404)
    
    files = {
        "obj": None,
        "mtl": None,
        "textures": []
    }
    
    # Find .obj file (recursively)
    obj_files = list(model_path.rglob("*.obj"))
    if obj_files:
        # Get the relative path from the model directory
        obj_relative = obj_files[0].relative_to(MODELS_DIR).as_posix()
        files["obj"] = f"/models/{obj_relative}"
    
    # Find .mtl file (recursively)
    mtl_files = list(model_path.rglob("*.mtl"))
    if mtl_files:
        mtl_relative = mtl_files[0].relative_to(MODELS_DIR).as_posix()
        files["mtl"] = f"/models/{mtl_relative}"
    
    # Find texture files (recursively)
    texture_extensions = [".png", ".jpg", ".jpeg"]
    for ext in texture_extensions:
        for texture_file in model_path.rglob(f"*{ext}"):
            texture_relative = texture_file.relative_to(MODELS_DIR).as_posix()
            files["textures"].append(f"/models/{texture_relative}")
    
    return JSONResponse(content=files)


@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for speech-to-text commands"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast the command to all connected clients
            await manager.broadcast({"command": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/api/stt/start")
async def start_stt():
    """Start speech recognition in a background thread"""
    global stt_active
    
    if not stt_active:
        stt_active = True
        thread = threading.Thread(target=run_stt_loop, daemon=True)
        thread.start()
        return {"status": "started"}
    return {"status": "already_running"}


@app.post("/api/stt/stop")
async def stop_stt():
    """Stop speech recognition"""
    global stt_active
    stt_active = False
    return {"status": "stopped"}


def run_stt_loop():
    """Run speech recognition loop and broadcast commands"""
    global stt_active
    
    try:
        # Import the speech recognition module
        import sys
        sys.path.append(str(BASE_DIR))
        from SpeechToText import SpeechRecognition
        
        while stt_active:
            try:
                text = SpeechRecognition()
                if text and stt_active:
                    # Parse command and broadcast to all clients
                    command = parse_voice_command(text)
                    asyncio.run(manager.broadcast(command))
            except Exception as e:
                print(f"STT Error: {e}")
                
    except ImportError:
        print("Could not import SpeechToText module")


def parse_voice_command(text: str) -> dict:
    """Parse voice command into action.

    Normalizes text to lowercase, strips punctuation and whitespace, and applies
    small corrections for common mis-hearings (for example 'hollow' -> 'holo').
    Returns a dict with an action key and optional parameters.
    """
    if not isinstance(text, str):
        return {"action": "unknown", "text": str(text)}

    # Normalize to lowercase and remove punctuation
    text_lower = text.lower()
    normalized = re.sub(r"[^\w\s]", ' ', text_lower)  # remove punctuation
    normalized = re.sub(r"\s+", ' ', normalized).strip()
        

    # Common corrections for mis-heard words
    corrections = {
        'hollow': 'holo',
        'holomode': 'holo mode',
        'holo-mode': 'holo mode',
        'holo_mode': 'holo mode',
        'hologrammode': 'hologram mode',
    }
    for wrong, right in corrections.items():
        normalized = normalized.replace(wrong, right)

    # Quick token checks (use contains after normalization)
    if 'reset' in normalized:
        return {"action": "reset"}

    if 'auto rotate' in normalized or 'start rotating' in normalized or 'start rotate' in normalized:
        return {"action": "auto_rotate", "value": True}

    if 'stop rotating' in normalized or 'stop rotation' in normalized or 'stop rotate' in normalized:
        return {"action": "auto_rotate", "value": False}

    # Holo / hologram detection (accept common variants)
    if 'holo' in normalized or 'hologram' in normalized or 'holo mode' in normalized or 'hologram mode' in normalized:
        return {"action": "holo_mode"}

    # Wireframe detection
    if 'wireframe' in normalized or 'wire frame' in normalized:
        return {"action": "wireframe"}

    # HARM detection
    if 'harm' in normalized:
        return {"action": "harm_mode"}

    # Exit/close
    if 'exit' in normalized or 'close' in normalized or 'quit' in normalized:
        return {"action": "exit"}

    # Load model - look for a folder name inside the normalized text
    if 'load' in normalized or 'open' in normalized or 'show' in normalized:
        models_dir = MODELS_DIR
        for item in models_dir.iterdir():
            if not item.is_dir():
                continue
            folder_name = item.name.lower()
            # Normalize folder name for comparison
            folder_norm = re.sub(r"[^\w\s]", ' ', folder_name)
            folder_norm = re.sub(r"\s+", ' ', folder_norm).strip()

            # If the folder name appears in the recognized phrase, return it
            if folder_norm and folder_norm in normalized:
                return {"action": "load_model", "model": item.name}

    # No known command matched; return unknown with normalized text
    return {"action": "unknown", "text": normalized}


# Mount static files
app.mount("/models", StaticFiles(directory=str(MODELS_DIR)), name="models")
app.mount("/assets", StaticFiles(directory=str(BASE_DIR / "assets")), name="assets")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
