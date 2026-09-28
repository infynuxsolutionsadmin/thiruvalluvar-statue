import time
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import json
import torch
import urllib.request
import nemo.collections.asr as nemo_asr

KE_URL = "http://localhost:3000/api/v1/knowledge/query"
TTS_URL = "http://localhost:3000/api/v1/tts/synthesize"
CHECKPOINT = r"D:\hf\hub\models--ai4bharat--indicconformer_stt_ta_hybrid_ctc_rnnt_large\snapshots\8c31aa8d04964b8fc87e4eaaee7916f7d2c024da\indicconformer_stt_ta_hybrid_rnnt_large.nemo"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def query_tts(text: str) -> bytes:
    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        TTS_URL,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()

def query_knowledge_engine(question: str) -> dict:
    payload = json.dumps({"query": question}).encode("utf-8")
    req = urllib.request.Request(
        KE_URL,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def transcribe(model, wav_path: str) -> str:
    result = model.transcribe([wav_path], batch_size=1, language_id="ta")[0]
    if isinstance(result, (list, tuple)):
        result = result[0][0] if result and isinstance(result[0], (list, tuple)) else result[0]
    return str(result).strip()

def main():
    print("Loading AI4Bharat STT model...")
    t0 = time.time()
    try:
        model = nemo_asr.models.ASRModel.restore_from(CHECKPOINT)
        model.freeze()
        model = model.to(torch.device(DEVICE))
        model.cur_decoder = "rnnt"
    except Exception as exc:
        print(f"Failed to load STT model: {exc}")
        sys.exit(1)
    print(f"STT model loaded in {time.time() - t0:.2f}s")

    questions = [
        "முதல் குறள் என்ன?",
        "திருவள்ளுவர் யார்?",
        "திருக்குறளில் மொத்தம் எத்தனை குறள்கள்?"
    ]

    for i, q in enumerate(questions):
        print(f"\n{'='*40}\nTest {i+1}: {q}\n{'='*40}")
        
        # 1. Generate audio for question using TTS
        q_wav_path = f"q_test_{i}.wav"
        print(f"Generating TTS for question...")
        q_wav_bytes = query_tts(q)
        with open(q_wav_path, "wb") as f:
            f.write(q_wav_bytes)

        # 2. STT
        print("Transcribing...")
        t_stt = time.time()
        recognized = transcribe(model, q_wav_path)
        stt_elapsed = time.time() - t_stt
        print(f"STT Recognized: {recognized} ({stt_elapsed:.3f}s)")

        # 3. Knowledge Engine
        print("Querying Knowledge Engine...")
        t_ke = time.time()
        ke_result = query_knowledge_engine(recognized)
        ke_elapsed = time.time() - t_ke
        
        parsed = ke_result.get("parsed", {})
        answer = ke_result.get("answer", {})
        ref = answer.get("reference") or parsed.get("reference")
        ans_text = answer.get("answer")
        
        print(f"Knowledge Reference: {ref}")
        print(f"Knowledge Answer: {ans_text}")
        print(f"Knowledge Latency: {ke_elapsed:.3f}s")

        # 4. TTS
        if ans_text:
            print("Synthesizing answer TTS...")
            t_tts = time.time()
            ans_wav_bytes = query_tts(ans_text)
            tts_elapsed = time.time() - t_tts
            
            ans_wav_path = f"ans_test_{i}.wav"
            with open(ans_wav_path, "wb") as f:
                f.write(ans_wav_bytes)
                
            is_valid = ans_wav_bytes[:4] == b'RIFF'
            print(f"TTS Latency: {tts_elapsed:.3f}s")
            print(f"Total Latency: {stt_elapsed+ke_elapsed+tts_elapsed:.3f}s")
            print(f"WAV Valid: {is_valid} (Saved to {ans_wav_path})")

if __name__ == "__main__":
    main()
