import argparse
import time
import torch
import nemo.collections.asr as nemo_asr

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--checkpoint", required=True, help="Path to local .nemo checkpoint")
    parser.add_argument("-f", "--file", required=True, help="Path to 16kHz wav file")
    parser.add_argument("-d", "--device", default="cpu", help="Device to use (cpu/cuda)")
    parser.add_argument("-l", "--language", required=True, help="Language code")
    args = parser.parse_args()

    print("\nLoading model...")
    start_load = time.time()
    
    # Official AI4Bharat loading logic from their documentation
    model = nemo_asr.models.ASRModel.restore_from(args.checkpoint)
    
    device = torch.device(args.device)
    model.freeze()
    model = model.to(device)
    
    print(f"Model loaded successfully in {time.time() - start_load:.2f} seconds.")

    print("\nTranscribing...")
    
    # Set to RNNT decoding as per their documentation for the hybrid model
    model.cur_decoder = "rnnt"
    
    # Transcribe using their documented signature
    transcript = model.transcribe([args.file], batch_size=1, language_id=args.language)[0]
    
    # In some versions, transcribe returns a tuple/list of lists
    if isinstance(transcript, (list, tuple)):
        if len(transcript) > 0 and isinstance(transcript[0], (list, tuple)):
            transcript = transcript[0][0]
        else:
            transcript = transcript[0]

    with open('transcript.txt', 'w', encoding='utf-8') as f:
        f.write(str(transcript))
        
    print("\nTranscript written to transcript.txt successfully!")

if __name__ == "__main__":
    main()
