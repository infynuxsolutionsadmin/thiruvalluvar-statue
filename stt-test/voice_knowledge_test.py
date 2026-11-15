"""
voice_knowledge_test.py
────────────────────────────────────────────────────────────────────
Mic  →  AI4Bharat Tamil STT  →  NestJS Knowledge API  →  Answer
────────────────────────────────────────────────────────────────────
Run:
    python voice_knowledge_test.py

Prerequisites:
  - .venv311 environment with all STT deps installed
  - NestJS backend running on http://localhost:3000
    (npm run start:prod  or  node dist/main)
"""

import argparse
import time
import threading
import os
import sys
import json

import torch
import sounddevice as sd
import soundfile as sf
import numpy as np
import urllib.request
import urllib.error

import nemo.collections.asr as nemo_asr

# ─── Configuration ────────────────────────────────────────────────────────────
def resolve_checkpoint_path() -> str:
    # 1. Check environment variable
    if os.environ.get("STT_CHECKPOINT_PATH") and os.path.exists(os.environ["STT_CHECKPOINT_PATH"]):
        return os.environ["STT_CHECKPOINT_PATH"]

    # 2. Check standard local paths
    candidate_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "stt", "indicconformer_stt_ta_hybrid_rnnt_large.nemo")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "indicconformer_stt_ta_hybrid_rnnt_large.nemo")),
        r"D:\hf\hub\models--ai4bharat--indicconformer_stt_ta_hybrid_ctc_rnnt_large\snapshots\8c31aa8d04964b8fc87e4eaaee7916f7d2c024da\indicconformer_stt_ta_hybrid_rnnt_large.nemo"
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            return p

    # 3. Auto-download from Hugging Face if not found
    try:
        print("STT model checkpoint not found locally. Downloading from Hugging Face...")
        from huggingface_hub import hf_hub_download
        downloaded = hf_hub_download(
            repo_id="ai4bharat/indicconformer_stt_ta_hybrid_ctc_rnnt_large",
            filename="indicconformer_stt_ta_hybrid_rnnt_large.nemo"
        )
        return downloaded
    except Exception as e:
        print(f"Warning: Auto-download failed: {e}")
        return candidate_paths[0]

CHECKPOINT = resolve_checkpoint_path()
SAMPLERATE   = 16000
CHANNELS     = 1
TEMP_WAV     = "temp_voice_recording.wav"
TRANSCRIPT   = "transcript.txt"
LANGUAGE     = "ta"
KE_URL       = "http://localhost:3000/api/v1/knowledge/query"


# ─── Recording ────────────────────────────────────────────────────────────────

def record_until_enter() -> np.ndarray | None:
    """Stream mic audio until user presses ENTER. Returns float32 array or None."""
    frames = []

    def callback(indata, frame_count, time_info, status):
        frames.append(indata.copy())

    stream = sd.InputStream(
        samplerate=SAMPLERATE,
        channels=CHANNELS,
        dtype="float32",
        callback=callback,
    )
    try:
        with stream:
            print("Recording... Press ENTER to stop.")
            input()
    except Exception as exc:
        print(f"  [Error] Microphone: {exc}")
        return None

    if not frames:
        print("  [Warning] No audio captured.")
        return None

    return np.concatenate(frames, axis=0)


def save_wav(audio: np.ndarray, path: str):
    sf.write(path, audio, SAMPLERATE)


def cleanup(path: str):
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception as exc:
            print(f"  [Warning] Could not delete {path}: {exc}")


# ─── STT ─────────────────────────────────────────────────────────────────────

def transcribe(model, wav_path: str) -> str:
    """Run the already-loaded model. Returns raw transcript string."""
    result = model.transcribe([wav_path], batch_size=1, language_id=LANGUAGE)[0]
    if isinstance(result, (list, tuple)):
        result = result[0][0] if result and isinstance(result[0], (list, tuple)) else result[0]
    return str(result).strip()


TTS_URL      = "http://localhost:3000/api/v1/tts/synthesize"


# ─── Knowledge Engine & TTS HTTP calls ────────────────────────────────────────

def query_knowledge_engine(question: str) -> dict:
    """
    POST /api/v1/knowledge/query  { "query": question }
    Returns the parsed JSON response dict or raises on error.
    """
    payload = json.dumps({"query": question}).encode("utf-8")
    req = urllib.request.Request(
        KE_URL,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)


def query_tts(text: str) -> bytes:
    """
    POST /api/v1/tts/synthesize { "text": text }
    Returns WAV bytes.
    """
    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        TTS_URL,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def print_ke_result(result: dict, ke_elapsed: float) -> str:
    """Pretty-print the Knowledge Engine response. Returns the answer text if found."""
    parsed = result.get("parsed", {})
    answer = result.get("answer", {})

    print()
    print("-" * 40)
    reference = answer.get("reference") or parsed.get("reference") or "?"
    dataset   = answer.get("dataset")   or parsed.get("dataset")   or "?"
    intent    = answer.get("intent")    or parsed.get("intent")    or "?"
    found     = answer.get("found", False)
    ans_text  = answer.get("answer")

    print(f"Reference : {reference}")
    print(f"Dataset   : {dataset}")
    print(f"Intent    : {intent}")
    print(f"Found     : {found}")
    print()
    if found and ans_text:
        print("Answer:")
        try:
            print(ans_text)
        except UnicodeEncodeError:
            print(repr(ans_text))
    else:
        print("Answer: (no authoritative answer found)")
    print(f"  Knowledge Engine: {ke_elapsed:.3f}s")
    print("-" * 40)
    return ans_text if found else None


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    global KE_URL
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--checkpoint", default=CHECKPOINT)
    parser.add_argument("-d", "--device",     default="cpu")
    parser.add_argument("--ke-url",           default=KE_URL,
                        help="Knowledge Engine base URL")
    args = parser.parse_args()

    KE_URL = args.ke_url

    # ── Header ──────────────────────────────────────────────────────────────
    print()
    print("=" * 40)
    print(" Thiruvalluvar Voice AI Test")
    print("=" * 40)

    # ── Load STT model ONCE ─────────────────────────────────────────────────
    print("\nLoading AI4Bharat STT model...")
    t0 = time.time()
    try:
        model = nemo_asr.models.ASRModel.restore_from(args.checkpoint)
        model.freeze()
        model = model.to(torch.device(args.device))
        model.cur_decoder = "rnnt"
    except Exception as exc:
        print(f"\n[Error] Failed to load STT model: {exc}")
        sys.exit(1)
    load_time = time.time() - t0
    print(f"STT model loaded in {load_time:.2f} seconds.")

    # ── Verify Knowledge Engine is reachable ────────────────────────────────
    print("\nChecking Knowledge Engine...")
    try:
        test_resp = query_knowledge_engine("test")
        print(f"Knowledge Engine ready  ({KE_URL})")
    except Exception as exc:
        print(f"\n[Warning] Knowledge Engine not reachable: {exc}")
        print("  Start the NestJS backend with:  node dist/main")
        print("  Continuing — STT will work but KE calls will fail.\n")

    print("\nReady.")

    # ── Interactive loop ─────────────────────────────────────────────────────
    while True:
        print()
        print("-" * 40)
        print("Press ENTER to start recording.")
        print("Press Q + ENTER to quit.")
        print("-" * 40)

        user_input = input().strip().lower()
        if user_input == "q":
            print("Goodbye.")
            break

        # ── Record ──────────────────────────────────────────────────────────
        audio = record_until_enter()
        if audio is None:
            continue

        print("\nProcessing...")
        save_wav(audio, TEMP_WAV)

        # ── STT ─────────────────────────────────────────────────────────────
        stt_err = None
        recognized = ""
        try:
            print("Transcribing...")
            t_stt = time.time()
            recognized = transcribe(model, TEMP_WAV)
            stt_elapsed = time.time() - t_stt
        except Exception as exc:
            stt_err = exc
            stt_elapsed = time.time() - t_stt
        finally:
            cleanup(TEMP_WAV)

        if stt_err:
            print(f"\n[STT Error] {stt_err}")
            continue

        if not recognized:
            print("\nNo speech recognized.")
            continue

        print("\nRecognized:")
        try:
            print(recognized)
        except UnicodeEncodeError:
            print(repr(recognized))
        print(f"  STT: {stt_elapsed:.3f}s")

        # ── Save STT output ─────────────────────────────────────────────────
        with open(TRANSCRIPT, "w", encoding="utf-8") as f:
            f.write(recognized)

        # ── Knowledge Engine & TTS ──────────────────────────────────────────
        try:
            print("\nQuerying Knowledge Engine...")
            t_ke = time.time()
            ke_result = query_knowledge_engine(recognized)
            ke_elapsed = time.time() - t_ke

            ans_text = print_ke_result(ke_result, ke_elapsed)
            
            if ans_text:
                print("\nSynthesizing TTS...")
                t_tts = time.time()
                wav_bytes = query_tts(ans_text)
                tts_elapsed = time.time() - t_tts
                
                output_wav = "output_answer.wav"
                with open(output_wav, "wb") as f:
                    f.write(wav_bytes)
                
                print(f"  TTS generated and saved to {output_wav}")
                print(f"  STT: {stt_elapsed:.3f}s  |  KE: {ke_elapsed:.3f}s  |  TTS: {tts_elapsed:.3f}s  |  Total: {stt_elapsed+ke_elapsed+tts_elapsed:.3f}s")
                
                # ── Play the audio directly ──
                print("  Playing answer...")
                try:
                    data, fs = sf.read(output_wav)
                    sd.play(data, fs)
                    sd.wait()
                except Exception as exc:
                    print(f"  [Warning] Could not play audio: {exc}")
            else:
                print(f"  STT: {stt_elapsed:.3f}s  |  KE: {ke_elapsed:.3f}s  |  Total: {stt_elapsed+ke_elapsed:.3f}s")

        except urllib.error.URLError as exc:
            print(f"\n[HTTP Error] Cannot reach API: {exc}")
            print("  (Is the NestJS backend running?  node dist/main)")
        except Exception as exc:
            print(f"\n[Error] {exc}")


if __name__ == "__main__":
    main()
