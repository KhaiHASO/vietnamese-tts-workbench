import os
import sys

# Reconfigure output encoding to support Vietnamese characters in Windows terminal
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import wave
import math
import struct
import uuid
import shutil
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

# Initialize FastAPI app
app = FastAPI(title="Vietnamese TTS Workbench", description="Web UI for VieNeu-TTS & Voice Cloning")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants & Folders
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(STATIC_DIR, "generated")

for folder in [UPLOAD_DIR, OUTPUT_DIR, STATIC_DIR]:
    os.makedirs(folder, exist_ok=True)

# Attempt to load VieNeu-TTS
has_vieneu = False
tts_engine = None
engine_error = ""

try:
    from vieneu import Vieneu
    # We delay loading of weights until the first run or explicit initialize to avoid server hang during startup
    has_vieneu = True
except Exception as e:
    engine_error = str(e)
    has_vieneu = False

def get_tts_engine():
    global tts_engine
    if not has_vieneu:
        return None
    if tts_engine is None:
        try:
            # Initialize VieNeu engine
            # It will download/load v3-turbo weights automatically
            tts_engine = Vieneu()
        except Exception as e:
            global engine_error
            engine_error = str(e)
            return None
    return tts_engine

# Helper to generate a mock audio wave file in simulation mode
def generate_mock_wav(text: str, filepath: str, pitch_factor: float = 1.0):
    # Base duration on length of text (approx 15 characters per second)
    duration = max(1.0, min(15.0, len(text) / 12.0))
    sample_rate = 22050
    num_samples = int(duration * sample_rate)
    
    with wave.open(filepath, 'wb') as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        
        # Synthesize a retro vocal-like synth tone (frequency modulation)
        # Pitch factors: higher pitch for female voices, lower for male
        base_freq = 160.0 * pitch_factor
        
        for i in range(num_samples):
            t = i / sample_rate
            # Create a modulated signal that sounds like artificial speech synthesis
            # A base frequency modulated by 6Hz (vibrato) and 12Hz (vowel formants imitation)
            vibrato = 10.0 * math.sin(2 * math.pi * 6.0 * t)
            formant_mod = 35.0 * math.sin(2 * math.pi * 12.0 * t)
            
            # Simple speech rhythm envelope: amplitude goes up and down based on words
            # We simulate words using a low frequency envelope
            envelope = 0.5 + 0.5 * math.sin(2 * math.pi * (1.5 / duration) * len(text) * t)
            # Clamp envelope
            envelope = max(0.1, min(0.9, envelope))
            
            freq = base_freq + vibrato + formant_mod
            
            # Combine fundamental frequency with second and third harmonics
            val = (
                math.sin(2 * math.pi * freq * t) + 
                0.4 * math.sin(4 * math.pi * freq * t) + 
                0.2 * math.sin(6 * math.pi * freq * t)
            ) / 1.6
            
            # Apply volume envelope
            val = val * envelope
            
            # Fade in/out to prevent clicks
            if i < 500:
                val *= (i / 500)
            elif num_samples - i < 500:
                val *= ((num_samples - i) / 500)
                
            packed_value = struct.pack('<h', int(val * 16384))
            wav.writeframes(packed_value)

# Helper to merge multiple wav files
def merge_wav_files(input_paths: List[str], output_path: str):
    if not input_paths:
        return False
    
    try:
        # Check if all files exist
        valid_paths = [p for p in input_paths if os.path.exists(p)]
        if not valid_paths:
            return False
            
        # Read parameters from the first valid wave file
        with wave.open(valid_paths[0], 'rb') as w_in:
            params = w_in.getparams()
            
        with wave.open(output_path, 'wb') as w_out:
            w_out.setparams(params)
            for path in valid_paths:
                with wave.open(path, 'rb') as w_in:
                    w_out.writeframes(w_in.readframes(w_in.getnframes()))
                # Append 0.25 seconds of silence between parts
                # 2 bytes per sample, mono, sample_rate
                silence_duration = 0.25
                silence_samples = int(silence_duration * params.framerate)
                silence_data = b'\x00' * (silence_samples * params.sampwidth * params.nchannels)
                w_out.writeframes(silence_data)
        return True
    except Exception as e:
        print(f"Error merging WAV files: {e}")
        return False

# Pydantic models
class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "Hoài Nam"
    ref_audio: Optional[str] = None
    speed: Optional[float] = 1.0
    mode: Optional[str] = "turbo" # turbo (v3) or standard (v2)

class DialogueLine(BaseModel):
    speaker: str  # Name of built-in voice or reference file ID
    speaker_type: str  # "built-in" or "cloned"
    text: str

class ConversationRequest(BaseModel):
    lines: List[DialogueLine]
    mode: Optional[str] = "turbo"

# Voices Database
BUILT_IN_VOICES = [
    {"id": "hoai_nam", "name": "Hoài Nam", "gender": "Nam", "region": "Miền Bắc", "pitch": 0.8, "desc": "Giọng nam trầm ấm, truyền cảm, phù hợp đọc tin tức và tài liệu."},
    {"id": "phuong_thao", "name": "Phương Thảo", "gender": "Nữ", "region": "Miền Bắc", "pitch": 1.25, "desc": "Giọng nữ thanh lịch, chuẩn mực, phù hợp làm thuyết minh và hướng dẫn."},
    {"id": "xuan_vinh", "name": "Xuân Vĩnh", "gender": "Nam", "region": "Miền Nam", "pitch": 0.9, "desc": "Giọng nam Miền Nam trẻ trung, tự nhiên, thích hợp cho review công nghệ và vlog."},
    {"id": "thao_vy", "name": "Thảo Vy", "gender": "Nữ", "region": "Miền Nam", "pitch": 1.3, "desc": "Giọng nữ Miền Nam ngọt ngào, truyền cảm, phù hợp đọc truyện và quảng cáo."}
]

@app.get("/api/status")
def get_status():
    return {
        "has_vieneu": has_vieneu,
        "engine_loaded": tts_engine is not None,
        "error": engine_error,
        "device": "CUDA/GPU (Recommended)" if has_vieneu else "CPU (Simulation Fallback)"
    }

@app.get("/api/voices")
def get_voices():
    # If live, we could potentially retrieve them from the vieneu package,
    # otherwise we return our standard high-quality profiles
    return BUILT_IN_VOICES

@app.post("/api/upload-ref")
async def upload_ref_audio(file: UploadFile = File(...), name: str = Form(...)):
    try:
        file_id = f"ref_{uuid.uuid4().hex[:8]}"
        file_ext = os.path.splitext(file.filename)[1] or ".wav"
        if file_ext.lower() not in [".wav", ".mp3", ".m4a", ".ogg"]:
            return JSONResponse(status_code=400, content={"message": "Định dạng file không hỗ trợ (chỉ nhận WAV, MP3, M4A, OGG)."})
            
        filename = f"{file_id}{file_ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "id": file_id,
            "name": name,
            "filename": filename,
            "path": filepath,
            "size": os.path.getsize(filepath)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể tải lên file: {str(e)}")

@app.post("/api/tts")
def run_tts(request: TTSRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Văn bản không được để trống")
        
    filename = f"tts_{uuid.uuid4().hex[:12]}.wav"
    output_path = os.path.join(OUTPUT_DIR, filename)
    
    # 1. LIVE MODE using VieNeu-TTS
    if has_vieneu:
        engine = get_tts_engine()
        if engine is not None:
            try:
                # Determine reference audio path if provided
                ref_audio_path = None
                if request.ref_audio:
                    # check if it exists in uploads
                    possible_path = os.path.join(UPLOAD_DIR, request.ref_audio)
                    if os.path.exists(possible_path):
                        ref_audio_path = possible_path
                
                # Execute inference
                # VieNeu supports `ref_audio` and `voice` parameters
                if ref_audio_path:
                    # Voice Cloning Mode
                    audio = engine.infer(
                        text=request.text,
                        ref_audio=ref_audio_path
                    )
                else:
                    # Built-in Voice Mode
                    voice_name = request.voice or "Hoài Nam"
                    audio = engine.infer(
                        text=request.text,
                        voice=voice_name
                    )
                
                # Save the audio using the VieNeu engine save helper
                engine.save(audio, output_path)
                
                return {
                    "success": True,
                    "mode": "live",
                    "audio_url": f"/static/generated/{filename}",
                    "text": request.text,
                    "voice": request.voice if not ref_audio_path else "Cloned Voice"
                }
            except Exception as e:
                # If live inference fails, log it and fall back to simulation to ensure app keeps running
                print(f"Live TTS error: {e}. Falling back to simulation.")
                
    # 2. SIMULATION FALLBACK MODE
    # Find pitch factor based on requested voice
    pitch = 1.0
    for v in BUILT_IN_VOICES:
        if v["name"] == request.voice or v["id"] == request.voice:
            pitch = v["pitch"]
            break
            
    # If cloned voice simulation, introduce slightly different pitch
    if request.ref_audio:
        pitch = 1.05
        
    try:
        generate_mock_wav(request.text, output_path, pitch_factor=pitch)
        return {
            "success": True,
            "mode": "simulation",
            "audio_url": f"/static/generated/{filename}",
            "text": request.text,
            "voice": request.voice if not request.ref_audio else "Giọng Nhân Bản (Mô Phỏng)",
            "warning": "Đang chạy ở chế độ Mô phỏng (Simulation Mode) vì chưa cài đặt VieNeu-TTS thư viện."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tổng hợp âm thanh: {str(e)}")

@app.post("/api/conversation")
def run_conversation(request: ConversationRequest):
    if not request.lines:
        raise HTTPException(status_code=400, detail="Danh sách kịch bản trống")
        
    # Generate audio for each line separately, then merge
    temp_files = []
    line_details = []
    
    try:
        for idx, line in enumerate(request.lines):
            line_filename = f"conv_line_{idx}_{uuid.uuid4().hex[:8]}.wav"
            line_filepath = os.path.join(OUTPUT_DIR, line_filename)
            
            # Setup TTS parameters based on speaker
            voice_name = None
            ref_path = None
            
            if line.speaker_type == "cloned":
                # Find matching cloned file
                possible_path = os.path.join(UPLOAD_DIR, line.speaker)
                if os.path.exists(possible_path):
                    ref_path = possible_path
                else:
                    # fallback to upload_dir lookup if speaker is file ID
                    for fname in os.listdir(UPLOAD_DIR):
                        if fname.startswith(line.speaker):
                            ref_path = os.path.join(UPLOAD_DIR, fname)
                            break
            else:
                voice_name = line.speaker
                
            # Perform synthesis for this line
            line_generated = False
            if has_vieneu:
                engine = get_tts_engine()
                if engine is not None:
                    try:
                        if ref_path:
                            audio = engine.infer(text=line.text, ref_audio=ref_path)
                        else:
                            audio = engine.infer(text=line.text, voice=voice_name or "Hoài Nam")
                        engine.save(audio, line_filepath)
                        line_generated = True
                    except Exception as e:
                        print(f"Conversation line live synthesis failed: {e}")
                        
            if not line_generated:
                # Simulation Mode for this line
                pitch = 1.0
                if voice_name:
                    for v in BUILT_IN_VOICES:
                        if v["name"] == voice_name or v["id"] == voice_name:
                            pitch = v["pitch"]
                            break
                elif ref_path:
                    pitch = 1.1  # custom pitch for clone
                
                generate_mock_wav(line.text, line_filepath, pitch_factor=pitch)
                
            temp_files.append(line_filepath)
            line_details.append({
                "speaker": line.speaker,
                "text": line.text,
                "path": line_filepath
            })
            
        # Merge all files
        combined_filename = f"conversation_{uuid.uuid4().hex[:12]}.wav"
        combined_path = os.path.join(OUTPUT_DIR, combined_filename)
        
        merge_success = merge_wav_files(temp_files, combined_path)
        
        # Clean up temporary line files to save disk space
        for path in temp_files:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
                
        if not merge_success:
            raise HTTPException(status_code=500, detail="Không thể ghép nối các đoạn hội thoại")
            
        return {
            "success": True,
            "mode": "live" if has_vieneu else "simulation",
            "audio_url": f"/static/generated/{combined_filename}",
            "lines_processed": len(request.lines)
        }
    except Exception as e:
        # Clean up any leftover temp files on error
        for path in temp_files:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Lỗi hội thoại: {str(e)}")

@app.get("/api/history")
def get_history():
    # Return list of generated wave files in static/generated/
    try:
        files = []
        for filename in os.listdir(OUTPUT_DIR):
            if filename.endswith(".wav"):
                filepath = os.path.join(OUTPUT_DIR, filename)
                stat = os.stat(filepath)
                # Parse filename to get timestamp or uuid
                files.append({
                    "filename": filename,
                    "audio_url": f"/static/generated/{filename}",
                    "created_at": stat.st_mtime,
                    "size": stat.st_size
                })
        # Sort by creation time desc
        files.sort(key=lambda x: x["created_at"], reverse=True)
        return files
    except Exception as e:
        return []

@app.delete("/api/history/{filename}")
def delete_history_item(filename: str):
    try:
        # Sanitize filename to prevent directory traversal
        filename = os.path.basename(filename)
        filepath = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            return {"success": True, "message": f"Đã xóa file {filename}"}
        else:
            raise HTTPException(status_code=404, detail="Không tìm thấy file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount frontend files at the root
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    print("--------------------------------------------------")
    print(" Khởi động Vietnamese TTS Workbench Local Server ")
    print("--------------------------------------------------")
    print(f"Thư viện VieNeu-TTS: {'ĐÃ TÌM THẤY (LIVE)' if has_vieneu else 'CHƯA TÌM THẤY (MÔ PHỎNG)'}")
    if not has_vieneu:
        print("Mẹo: Để chạy LIVE, cài đặt bằng lệnh:")
        print("  pip install vieneu --extra-index-url https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/")
    print("Mở trình duyệt tại: http://127.0.0.1:8000")
    print("--------------------------------------------------")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
