#!/bin/bash

echo "Checking Health of Thiruvalluvar Voice AI..."

# Check Systemd status
if systemctl is-active --quiet thiruvalluvar-backend; then
    echo "[OK] Systemd service is running"
else
    echo "[FAIL] Systemd service is NOT running"
fi

# Check HTTP endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health || echo "000")

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "[OK] API /api/v1/health is responding (HTTP 200)"
else
    echo "[FAIL] API is not responding. HTTP Status: $HTTP_STATUS"
fi

# Check Piper Model
if [ -f "/opt/thiruvalluvar/models/tts/ta_IN-ValluvaNeural-medium.onnx.onnx" ]; then
    echo "[OK] Piper TTS Model found"
else
    echo "[FAIL] Piper TTS Model NOT found at /opt/thiruvalluvar/models/tts/"
fi

# Check STT Model
if [ -f "/opt/thiruvalluvar/models/stt/indicconformer_stt_hybrid_rnnt_large.nemo" ]; then
    echo "[OK] STT NeMo Model found"
else
    echo "[FAIL] STT NeMo Model NOT found at /opt/thiruvalluvar/models/stt/"
fi
