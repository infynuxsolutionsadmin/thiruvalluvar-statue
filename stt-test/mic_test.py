import argparse
import time
import threading
import torch
import sounddevice as sd
import soundfile as sf
import numpy as np
import os
import sys
import nemo.collections.asr as nemo_asr

# ─── Constants ──────────────────────────────────────────────────────────────
CHECKPOINT = (
    r"D:\hf\hub\models--ai4bharat--indicconformer_stt_ta_hybrid_ctc_rnnt_large"
    r"\snapshots\8c31aa8d04964b8fc87e4eaaee7916f7d2c024da"
    r"\indicconformer_stt_ta_hybrid_rnnt_large.nemo"
)
SAMPLERATE  = 16000
CHANNELS    = 1
TEMP_WAV    = "temp_mic_recording.wav"
TRANSCRIPT  = "transcript.txt"
LANGUAGE    = "ta"


# ─── Recording helpers ──────────────────────────────────────────────────────

def record_until_enter():
    """
    Stream audio from the microphone until the user presses ENTER.
    Returns a numpy float32 array of audio samples, or None on error.
    """
    frames = []
    stop_event = threading.Event()

    def audio_callback(indata, frame_count, time_info, status):
        frames.append(indata.copy())

    stream = sd.InputStream(
        samplerate=SAMPLERATE,
        channels=CHANNELS,
        dtype="float32",
        callback=audio_callback,
    )

    try:
        with stream:
            print("Recording... Press ENTER to stop.")
            input()               # blocks here; audio continues in background thread
            stop_event.set()
    except Exception as e:
        print(f"  [Error] Microphone error: {e}")
        return None

    if not frames:
        print("  [Warning] No audio captured.")
        return None

    return np.concatenate(frames, axis=0)


def save_wav(audio, filename):
    sf.write(filename, audio, SAMPLERATE)


def cleanup(filename):
    if os.path.exists(filename):
        try:
            os.remove(filename)
        except Exception as e:
            print(f"  [Warning] Could not delete {filename}: {e}")


# ─── Transcription helper ────────────────────────────────────────────────────

def transcribe(model, wav_path):
    """Run the already-loaded model on wav_path. Returns transcript string."""
    result = model.transcribe([wav_path], batch_size=1, language_id=LANGUAGE)[0]

    # Normalise: model sometimes returns nested list/tuple
    if isinstance(result, (list, tuple)):
        if result and isinstance(result[0], (list, tuple)):
            result = result[0][0]
        else:
            result = result[0]

    return str(result)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--checkpoint", default=CHECKPOINT,
                        help="Path to local .nemo checkpoint")
    parser.add_argument("-d", "--device", default="cpu",
                        help="Device: cpu or cuda")
    args = parser.parse_args()

    # ── Header ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 40)
    print(" Tamil Speech -> AI4Bharat STT Test")
    print("=" * 40)

    # ── Load model ONCE ─────────────────────────────────────────────────────
    print("\nLoading AI4Bharat model...")
    start_load = time.time()
    try:
        model = nemo_asr.models.ASRModel.restore_from(args.checkpoint)
        device = torch.device(args.device)
        model.freeze()
        model = model.to(device)
        model.cur_decoder = "rnnt"
    except Exception as e:
        print(f"\n[Error] Failed to load model: {e}")
        sys.exit(1)

    load_time = time.time() - start_load
    print(f"\nModel loaded successfully in {load_time:.2f} seconds.")
    print("\nReady.\n")

    # ── Interactive loop ─────────────────────────────────────────────────────
    while True:
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

        # ── Transcribe (reuse already-loaded model) ──────────────────────────
        print("Transcribing...")
        try:
            t0 = time.time()
            text = transcribe(model, TEMP_WAV)
            elapsed = time.time() - t0

            print(f"\nRecognized text:")
            # Print safely; fall back to repr if console can't handle Tamil
            try:
                print(text)
            except UnicodeEncodeError:
                print(repr(text))

            print(f"  (transcription took {elapsed:.2f}s)")

            with open(TRANSCRIPT, "w", encoding="utf-8") as f:
                f.write(text)

        except Exception as e:
            print(f"\n[Error] Transcription failed: {e}")

        finally:
            cleanup(TEMP_WAV)

        print()


if __name__ == "__main__":
    main()
