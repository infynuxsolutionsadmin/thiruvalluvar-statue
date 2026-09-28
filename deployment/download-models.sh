#!/bin/bash
set -e

echo "=================================================="
echo " DOWNLOADING MODELS FOR ORACLE A1 (ARM64)"
echo "=================================================="

BASE_DIR="/opt/thiruvalluvar"
MODELS_DIR="$BASE_DIR/models"
STT_DIR="$MODELS_DIR/stt"
TTS_DIR="$MODELS_DIR/tts"
PIPER_DIR="$BASE_DIR/piper"

mkdir -p "$STT_DIR"
mkdir -p "$TTS_DIR"
mkdir -p "$PIPER_DIR"

# --------------------------------------------------
# 1. Download Piper TTS for Linux aarch64 (ARM64)
# --------------------------------------------------
echo "-> Checking Piper TTS (ARM64)..."
if [ ! -f "$PIPER_DIR/piper" ]; then
    echo "Downloading Piper..."
    wget -qO piper.tar.gz "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_aarch64.tar.gz"
    
    mkdir -p "$BASE_DIR/piper_temp"
    tar -xzf piper.tar.gz -C "$BASE_DIR/piper_temp"
    rm piper.tar.gz
    
    PIPER_EXEC=$(find "$BASE_DIR/piper_temp" -type f -name "piper" | head -n 1)
    
    if [ -n "$PIPER_EXEC" ]; then
        PIPER_EXTRACT_DIR=$(dirname "$PIPER_EXEC")
        mv "$PIPER_EXTRACT_DIR"/* "$PIPER_DIR/"
        rm -rf "$BASE_DIR/piper_temp"
        chmod +x "$PIPER_DIR/piper"
        
        # Verify ARM64 architecture
        if ! file "$PIPER_DIR/piper" | grep -qiE "aarch64|ARM aarch64|ARM64"; then
            echo "ERROR: Downloaded Piper executable is not an ARM64 binary."
            echo "File output: $(file "$PIPER_DIR/piper")"
            exit 1
        fi
        
        echo "Piper extracted and verified successfully."
    else
        echo "ERROR: Could not find 'piper' executable in the downloaded archive."
        rm -rf "$BASE_DIR/piper_temp"
        exit 1
    fi
else
    echo "Piper already exists. Skipping."
fi

# --------------------------------------------------
# 2. Piper Tamil Model
# --------------------------------------------------
echo "-> Checking Piper TTS Model..."
if [ ! -f "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.onnx" ]; then
    echo "Downloading Piper TTS Tamil voice (ta_IN-ValluvaNeural-medium)..."
    wget -qO "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.onnx" "https://huggingface.co/Jeyaram-K/piper-tamil-voices/resolve/main/ta_IN-ValluvaNeural-medium/ta_IN-ValluvaNeural-medium.onnx.onnx"
    wget -qO "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.json" "https://huggingface.co/Jeyaram-K/piper-tamil-voices/resolve/main/ta_IN-ValluvaNeural-medium/ta_IN-ValluvaNeural-medium.onnx.json"
    
    # Verify non-empty files
    if [ ! -s "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.onnx" ] || grep -q "<!DOCTYPE html>" "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.onnx"; then
        echo "ERROR: Piper TTS model download failed (file empty or HTML returned)."
        rm -f "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.onnx"
        rm -f "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.json"
        exit 1
    fi
    
    if [ ! -s "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.json" ] || grep -q "<!DOCTYPE html>" "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.json"; then
        echo "ERROR: Piper TTS JSON config download failed (file empty or HTML returned)."
        rm -f "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.onnx"
        rm -f "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.json"
        exit 1
    fi
    
    # Piper inherently appends .json to the model path when -c is not provided.
    # To ensure it correctly finds the downloaded JSON without modifying application behavior, symlink it:
    ln -sf "ta_IN-ValluvaNeural-medium.onnx.json" "$TTS_DIR/ta_IN-ValluvaNeural-medium.onnx.onnx.json"
    
    echo "Piper TTS Model downloaded and verified successfully."
else
    echo "Piper TTS Model exists. Skipping."
fi

# --------------------------------------------------
# 3. IndicConformer STT Model
# --------------------------------------------------
echo "-> Checking IndicConformer STT Model..."
STT_NEMO_FILE="$STT_DIR/indicconformer_stt_ta_hybrid_rnnt_large.nemo"

if [ ! -f "$STT_NEMO_FILE" ]; then
    echo "Downloading IndicConformer STT model from Hugging Face..."
    # We use huggingface-cli if available, otherwise direct wget
    if command -v huggingface-cli &> /dev/null; then
        if ! huggingface-cli download ai4bharat/indicconformer_stt_ta_hybrid_ctc_rnnt_large indicconformer_stt_ta_hybrid_rnnt_large.nemo --local-dir "$STT_DIR"; then
            echo "ERROR: The AI4Bharat Tamil IndicConformer model is gated or requires authentication."
            echo "Authenticate Hugging Face on this machine and rerun download-models.sh."
            exit 1
        fi
    else
        if ! wget -qO "$STT_NEMO_FILE" "https://huggingface.co/ai4bharat/indicconformer_stt_ta_hybrid_ctc_rnnt_large/resolve/main/indicconformer_stt_ta_hybrid_rnnt_large.nemo"; then
            echo "ERROR: The AI4Bharat Tamil IndicConformer model is gated."
            echo "Authenticate Hugging Face on this machine (e.g. use huggingface-cli login) and rerun download-models.sh."
            rm -f "$STT_NEMO_FILE"
            exit 1
        fi
    fi
    
    if [ ! -s "$STT_NEMO_FILE" ] || grep -q "<!DOCTYPE html>" "$STT_NEMO_FILE"; then
        echo "ERROR: STT model download failed (empty file or HTML). The repository may be gated."
        echo "Authenticate Hugging Face on this machine and rerun download-models.sh."
        rm -f "$STT_NEMO_FILE"
        exit 1
    fi
    echo "STT Model downloaded successfully."
else
    echo "STT Model already exists. Skipping."
fi

# Set up the symlink expected by the stt-test code ONLY if needed
APP_DIR="$BASE_DIR/app"
if [ -f "$APP_DIR/stt-test/voice_knowledge_test.py" ] && grep -q "patched.nemo" "$APP_DIR/stt-test/voice_knowledge_test.py"; then
    echo "Linking STT model for local testing..."
    ln -sf "$STT_NEMO_FILE" "$APP_DIR/stt-test/patched.nemo"
fi

# --------------------------------------------------
# 4. BGE-M3 Embeddings
# --------------------------------------------------
echo "-> BGE-M3 Model is handled automatically by Transformers.js during NestJS startup."

echo "=================================================="
echo " MODEL DOWNLOAD COMPLETE"
echo "=================================================="
