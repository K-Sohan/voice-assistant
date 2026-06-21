import os
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import whisper
import edge_tts
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading Whisper model...")
model = whisper.load_model("base", device="cuda")
print("Whisper ready.")

class TTSRequest(BaseModel):
    text: str
    voice: str = "en-IN-NeerjaNeural"

@app.post("/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name
    try:
        result = model.transcribe(tmp_path, language="en", fp16=True)
        return {"text": result["text"].strip(), "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: os.unlink(tmp_path)
        except: pass

@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    # Strip non-ASCII characters that break edge-tts
    clean_text = req.text.encode('ascii', 'ignore').decode('ascii').strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Empty text after cleaning")
    req = TTSRequest(text=clean_text, voice=req.voice)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp_path = tmp.name
    try:
        await edge_tts.Communicate(req.text, req.voice).save(tmp_path)
        with open(tmp_path, "rb") as f:
            data = f.read()
        return Response(content=data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: os.unlink(tmp_path)
        except: pass

@app.get("/health")
def health():
    return {"status": "ok"}