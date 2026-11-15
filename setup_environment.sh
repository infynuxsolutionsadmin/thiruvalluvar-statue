#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Thiruvalluvar Voice AI - Automated Environment & Dependency Setup (Linux/macOS/WSL)
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "============================================================"
echo " Setting up Thiruvalluvar Voice AI Environment"
echo "============================================================"

# 1. Check prerequisites
echo ""
echo "[1/5] Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js 18+."
    exit 1
fi
echo "  Found Node.js: $(node --version)"

if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed. Please install Python 3.10 or 3.11."
    exit 1
fi
echo "  Found Python: $(python3 --version)"

# 2. Install Node dependencies
echo ""
echo "[2/5] Installing NestJS backend dependencies (npm install)..."
npm install

# 3. Create Python virtual environment
echo ""
echo "[3/5] Setting up Python virtual environment in stt-test/.venv311..."
STT_DIR="$(pwd)/stt-test"
VENV_DIR="$STT_DIR/.venv311"
VENV_PYTHON="$VENV_DIR/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "  Creating virtual environment at $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
fi

# 4. Install Python requirements
echo ""
echo "[4/5] Installing Python requirements and Piper TTS..."
"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install -r "$STT_DIR/requirements.txt"

NEMO_DIR="$STT_DIR/AI4Bharat-NeMo"
if [ -f "$NEMO_DIR/setup.py" ]; then
    echo "  Installing AI4Bharat-NeMo toolkit..."
    "$VENV_PYTHON" -m pip install -e "$NEMO_DIR" --no-deps
fi

# 5. Download models
echo ""
echo "[5/5] Downloading & verifying AI models..."
"$VENV_PYTHON" scripts/setup_models.py

# 6. Check .env
if [ ! -f ".env" ]; then
    echo ""
    echo "[INFO] Creating .env from .env.example..."
    cp .env.example .env
    echo "  [IMPORTANT] Remember to edit .env and provide your valid MONGO_URI!"
fi

echo ""
echo "============================================================"
echo " Setup Completed Successfully!"
echo "============================================================"
echo "To run the project:"
echo "  Terminal 1:  npm run start"
echo "  Terminal 2:  cd stt-test && source .venv311/bin/activate && python voice_knowledge_test.py"

