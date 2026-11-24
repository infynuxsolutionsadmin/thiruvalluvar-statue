#!/usr/bin/env python3
"""
voice_server.py
────────────────────────────────────────────────────────────────────────
Unified Voice API Server for Thiruvalluvar Voice AI
Accepts audio directly from ESP32 / Web Client / Mobile Apps:
  1. Receives Audio (WAV) via HTTP POST
  2. Transcribes with local AI4Bharat IndicConformer Tamil STT
  3. Queries NestJS Knowledge Engine (http://localhost:3000)
  4. Synthesizes Tamil answer with Piper TTS (http://localhost:3000)
  5. Returns spoken WAV audio stream directly to ESP32 speaker
────────────────────────────────────────────────────────────────────────
Run:
    python voice_server.py --port 8000
"""

import os
import sys
import time
import json
import tempfile
import argparse
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

import torch
import nemo.collections.asr as nemo_asr

# Configuration
PORT = 8000
NESTJS_BASE_URL = os.environ.get("NESTJS_BASE_URL", "http://localhost:3000")
KE_QUERY_URL = f"{NESTJS_BASE_URL}/api/v1/knowledge/query"
TTS_URL = f"{NESTJS_BASE_URL}/api/v1/tts/synthesize"

# Global ASR model
asr_model = None

def resolve_checkpoint_path() -> str:
    if os.environ.get("STT_CHECKPOINT_PATH") and os.path.exists(os.environ["STT_CHECKPOINT_PATH"]):
        return os.environ["STT_CHECKPOINT_PATH"]

    candidate_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "stt", "indicconformer_stt_ta_hybrid_rnnt_large.nemo")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "indicconformer_stt_ta_hybrid_rnnt_large.nemo")),
        r"D:\hf\hub\models--ai4bharat--indicconformer_stt_ta_hybrid_ctc_rnnt_large\snapshots\8c31aa8d04964b8fc87e4eaaee7916f7d2c024da\indicconformer_stt_ta_hybrid_rnnt_large.nemo"
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            return p

    # Auto download
    from huggingface_hub import hf_hub_download
    return hf_hub_download(
        repo_id="ai4bharat/indicconformer_stt_ta_hybrid_ctc_rnnt_large",
        filename="indicconformer_stt_ta_hybrid_rnnt_large.nemo"
    )

def load_stt_model():
    global asr_model
    checkpoint_path = resolve_checkpoint_path()
    print(f"[INIT] Loading AI4Bharat Tamil STT from: {checkpoint_path}")
    t0 = time.time()
    asr_model = nemo_asr.models.ASRModel.restore_from(checkpoint_path)
    asr_model.freeze()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    asr_model = asr_model.to(device)
    asr_model.cur_decoder = "rnnt"
    print(f"[INIT] STT Model loaded on {device} in {time.time() - t0:.2f}s")

def transcribe_wav(wav_path: str) -> str:
    global asr_model
    result = asr_model.transcribe([wav_path], batch_size=1, language_id="ta")[0]
    if isinstance(result, (list, tuple)):
        result = result[0][0] if result and isinstance(result[0], (list, tuple)) else result[0]
    return str(result).strip()

def query_knowledge_engine(query_text: str) -> str:
    payload = json.dumps({"query": query_text}).encode("utf-8")
    req = urllib.request.Request(
        KE_QUERY_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    answer_data = data.get("answer", {})
    answer_text = (
        answer_data.get("tamilExplanation") or
        answer_data.get("kural") or
        answer_data.get("text") or
        "மன்னிக்கவும், உங்கள் கேள்விக்கு விடை கிடைக்கவில்லை."
    )
    return answer_text

def synthesize_tts(text_to_speak: str) -> bytes:
    payload = json.dumps({"text": text_to_speak}).encode("utf-8")
    req = urllib.request.Request(
        TTS_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()

class VoiceRequestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # Handle CORS for browser / external clients
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health" or self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            response = json.dumps({
                "status": "online",
                "service": "Thiruvalluvar Voice AI Hardware Gateway",
                "endpoints": {
                    "talk": "POST /api/v1/voice/talk (Send WAV audio -> Receive WAV audio)",
                    "query": "POST /api/v1/voice/chat-text (Send JSON {text} -> Receive WAV audio)"
                }
            })
            self.wfile.write(response.encode("utf-8"))
        elif self.path == "/api/v1/voice/talk":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            response = json.dumps({
                "endpoint": "/api/v1/voice/talk",
                "method": "POST",
                "status": "active",
                "message": "This endpoint is active and ready! Send an HTTP POST request with 16kHz WAV audio from ESP32."
            })
            self.wfile.write(response.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/v1/voice/talk":
            self.handle_voice_talk()
        elif self.path == "/api/v1/voice/chat-text":
            self.handle_chat_text()
        else:
            self.send_response(404)
            self.end_headers()

    def handle_voice_talk(self):
        """Receives WAV from ESP32 -> STT -> Knowledge -> TTS -> Returns WAV"""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self.send_error(400, "Empty audio body")
            return

        audio_bytes = self.rfile.read(content_length)
        print(f"\n[INCOMING] Received {len(audio_bytes)} bytes audio from ESP32...")

        # Save to temporary file for STT
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
            tmp_wav.write(audio_bytes)
            tmp_path = tmp_wav.name

        try:
            # 1. Speech to Text
            t_stt = time.time()
            transcription = transcribe_wav(tmp_path)
            print(f"[STT] Transcribed ({time.time() - t_stt:.2f}s): {transcription}")

            if not transcription:
                transcription = "குரல் கேட்கவில்லை"
                answer_text = "மன்னிக்கவும், உங்கள் குரல் தெளிவாகக் கேட்கவில்லை. மீண்டும் பேசவும்."
            else:
                # 2. Knowledge Engine
                t_ke = time.time()
                answer_text = query_knowledge_engine(transcription)
                print(f"[KE] Answer ({time.time() - t_ke:.2f}s): {answer_text}")

            # 3. Piper TTS
            t_tts = time.time()
            tts_audio = synthesize_tts(answer_text)
            print(f"[TTS] Synthesized ({time.time() - t_tts:.2f}s): {len(tts_audio)} bytes audio")

            # 4. Stream Audio back to ESP32
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(tts_audio)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(tts_audio)
            print("[DONE] Streamed audio response back to ESP32 successfully!\n")

        except Exception as exc:
            print(f"[ERROR] Processing voice talk: {exc}")
            self.send_error(500, str(exc))
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def handle_chat_text(self):
        """Receives JSON { text } -> Knowledge -> TTS -> Returns WAV"""
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode("utf-8"))
        text_query = data.get("text", "")

        try:
            answer_text = query_knowledge_engine(text_query)
            tts_audio = synthesize_tts(answer_text)

            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(tts_audio)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(tts_audio)
        except Exception as exc:
            self.send_error(500, str(exc))

def main():
    global PORT
    parser = argparse.ArgumentParser(description="Thiruvalluvar Voice AI Hardware Gateway")
    parser.add_argument("-p", "--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    args = parser.parse_args()
    PORT = args.port

    load_stt_model()

    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, VoiceRequestHandler)
    print("=" * 65)
    print(f" Thiruvalluvar Voice AI Gateway listening on port {PORT}")
    print(f" Endpoint for ESP32: POST http://localhost:{PORT}/api/v1/voice/talk")
    print("=" * 65)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[STOP] Shutting down Voice AI Gateway...")
        httpd.server_close()

if __name__ == "__main__":
    main()

