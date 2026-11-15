#!/usr/bin/env python3
"""
setup_models.py
────────────────────────────────────────────────────────────────────────
Automated Model Setup & Downloader for Thiruvalluvar Voice AI
────────────────────────────────────────────────────────────────────────
Downloads and verifies required AI models:
  1. AI4Bharat IndicConformer Tamil STT Model (~500 MB) from Hugging Face
  2. Piper TTS Neural Voice Model (ta_IN-ValluvarNeural)
"""

import os
import sys
import shutil
import urllib.request

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(BASE_DIR, "models")
STT_DIR = os.path.join(MODELS_DIR, "stt")
TTS_DIR = os.path.join(MODELS_DIR, "tts")

STT_MODEL_NAME = "indicconformer_stt_ta_hybrid_rnnt_large.nemo"
STT_HF_REPO = "ai4bharat/indicconformer_stt_ta_hybrid_ctc_rnnt_large"

TTS_ONNX_NAME = "ta_IN-ValluvarNeural-medium.onnx"
TTS_JSON_NAME = "ta_IN-ValluvarNeural-medium.onnx.json"

def ensure_dirs():
    os.makedirs(STT_DIR, exist_ok=True)
    os.makedirs(TTS_DIR, exist_ok=True)

def setup_stt_model():
    target_path = os.path.join(STT_DIR, STT_MODEL_NAME)
    if os.path.exists(target_path):
        size_mb = os.path.getsize(target_path) / (1024 * 1024)
        print(f"[OK] STT Model already exists: {target_path} ({size_mb:.1f} MB)")
        return target_path

    # Check common fallback locations
    fallback = r"D:\hf\hub\models--ai4bharat--indicconformer_stt_ta_hybrid_ctc_rnnt_large\snapshots\8c31aa8d04964b8fc87e4eaaee7916f7d2c024da\indicconformer_stt_ta_hybrid_rnnt_large.nemo"
    if os.path.exists(fallback):
        print(f"[INFO] Copying existing STT model from local cache: {fallback}")
        shutil.copy2(fallback, target_path)
        print(f"[OK] STT Model copied to: {target_path}")
        return target_path

    print(f"\n[DOWNLOAD] Fetching STT Model from Hugging Face ({STT_HF_REPO})...")
    print("This is ~500 MB and might take 1-3 minutes depending on your connection.")
    try:
        from huggingface_hub import hf_hub_download
        downloaded = hf_hub_download(repo_id=STT_HF_REPO, filename=STT_MODEL_NAME)
        shutil.copy2(downloaded, target_path)
        print(f"[OK] STT Model downloaded successfully to: {target_path}")
        return target_path
    except ImportError:
        print("[ERROR] 'huggingface_hub' is not installed. Run: pip install huggingface-hub")
        return None
    except Exception as exc:
        print(f"[ERROR] Failed to download STT model: {exc}")
        return None

def setup_tts_model():
    onnx_target = os.path.join(TTS_DIR, TTS_ONNX_NAME)
    json_target = os.path.join(TTS_DIR, TTS_JSON_NAME)

    if os.path.exists(onnx_target) and os.path.exists(json_target):
        size_mb = os.path.getsize(onnx_target) / (1024 * 1024)
        print(f"[OK] Piper TTS Model already exists: {onnx_target} ({size_mb:.1f} MB)")
        return

    # Check fallback in extra/src/models
    extra_onnx = os.path.abspath(os.path.join(BASE_DIR, "..", "extra", "src", "models", TTS_ONNX_NAME))
    extra_json = os.path.abspath(os.path.join(BASE_DIR, "..", "extra", "src", "models", TTS_JSON_NAME))
    if os.path.exists(extra_onnx) and os.path.exists(extra_json):
        print(f"[INFO] Copying TTS model from {extra_onnx}...")
        shutil.copy2(extra_onnx, onnx_target)
        shutil.copy2(extra_json, json_target)
        print(f"[OK] Piper TTS Model copied to: {onnx_target}")
        return

    print("[WARNING] Local Piper model not found in extra/src/models.")
    print("Please ensure the Piper ONNX model files are placed in: " + TTS_DIR)

def check_piper_executable():
    piper_cmd = shutil.which("piper")
    if piper_cmd:
        print(f"[OK] Piper TTS executable found: {piper_cmd}")
    else:
        print("\n[NOTE] 'piper' command was not found in PATH.")
        print("To install Piper TTS CLI, run:  pip install piper-tts")
        print("Or set PIPER_EXECUTABLE_PATH in your .env file.")

def main():
    print("=" * 60)
    print(" Thiruvalluvar Voice AI — Automated Model Setup")
    print("=" * 60)
    ensure_dirs()
    setup_stt_model()
    setup_tts_model()
    check_piper_executable()
    print("\n[DONE] Model verification and setup complete!")

if __name__ == "__main__":
    main()

