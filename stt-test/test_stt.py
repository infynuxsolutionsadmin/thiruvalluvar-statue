import time
import os
import sys

print("================================")
print("AI4BHARAT INDICCONFORMER STT TEST")
print("================================")
print(f"Python: {sys.version}")

print("\nImporting NeMo...")
try:
    import nemo
    import nemo.collections.asr as nemo_asr
    import torch
    print(f"NeMo: {nemo.__version__}")
except ImportError as e:
    print("Import Error:", e)
    sys.exit(1)

model_name = "ai4bharat/indicconformer_stt_ta_hybrid_ctc_rnnt_large"
print(f"\nModel:\n{model_name}")

try:
    # Load model
    print("\nLoading local model...")
    start_load = time.time()
    
    model_path = "patched.nemo"
    
    print(f"Local model:\n{model_path}")
    
    if not os.path.isfile(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
        
    asr_model = nemo_asr.models.ASRModel.restore_from(model_path)
    
    load_time = time.time() - start_load
    print(f"Model loaded successfully in {load_time:.2f} seconds.")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    asr_model.freeze()
    asr_model = asr_model.to(device)
    
    audio_file = "test_input.wav"
    
    print(f"\nInput:\n{audio_file}")
    
    try:
        # Check if hybrid and supports change_decoding_strategy
        if hasattr(asr_model, 'change_decoding_strategy'):
            # Default to RNNT or whatever is set, but let's try RNNT first
            asr_model.change_decoding_strategy(decoder_type='rnnt')
            start_inf = time.time()
            transcription = asr_model.transcribe([audio_file])
            inf_time = time.time() - start_inf
            
            if isinstance(transcription, tuple):
                res = transcription[0][0]
            else:
                res = transcription[0]
            print(f"\nTranscript (RNNT):\n{res}")
            print(f"\nInference time:\n{inf_time:.4f} seconds")
        else:
            start_inf = time.time()
            transcription = asr_model.transcribe([audio_file])
            inf_time = time.time() - start_inf
            if isinstance(transcription, tuple):
                res = transcription[0][0]
            else:
                res = transcription[0]
            print(f"\nTranscript:\n{res}")
            print(f"\nInference time:\n{inf_time:.4f} seconds")
            
    except Exception as e:
        print("Error during inference:", e)

except Exception as e:
    print("Error loading model:", e)

print("\n================================")
